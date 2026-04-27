from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------- Mongo ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ---------- App ----------
app = FastAPI(title="Sabdia Equipment Management API")
api = APIRouter(prefix="/api")

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
ACCESS_TTL_MIN = 60 * 24 * 7  # 7 days for mobile

bearer_scheme = HTTPBearer(auto_error=False)

# ---------- Helpers ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": now_utc() + timedelta(minutes=ACCESS_TTL_MIN),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def serialize_dt(d: dict) -> dict:
    out = {}
    for k, v in d.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out

async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def require_roles(*roles: str):
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker

# ---------- Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Literal["admin", "supervisor", "trade"] = "trade"
    property_assignment: Optional[str] = None
    phone: Optional[str] = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    property_assignment: Optional[str] = None
    phone: Optional[str] = None
    status: str = "Active"

class AssetIn(BaseModel):
    asset_id: str
    name: str
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_no: Optional[str] = None
    category: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    location: Optional[str] = None

class AssetUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_no: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None

class CheckoutIn(BaseModel):
    asset_id: str
    property: str
    expected_return_date: str  # ISO date
    notes: Optional[str] = None

class CheckinIn(BaseModel):
    asset_id: str  # asset's UUID
    condition: Literal["Good", "Minor Damage", "Major Damage", "Missing Parts"]
    notes: Optional[str] = None
    photo_base64: Optional[str] = None

class BookingIn(BaseModel):
    asset_id: str
    property: str
    start_date: str
    end_date: str
    purpose: Optional[str] = None

class BookingDecision(BaseModel):
    rejection_reason: Optional[str] = None

# ---------- Auth Endpoints ----------
@api.post("/auth/register")
async def register(payload: RegisterIn):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(payload.password),
        "full_name": payload.full_name,
        "role": payload.role,
        "property_assignment": payload.property_assignment,
        "phone": payload.phone,
        "status": "Active",
        "created_at": now_utc(),
    }
    await db.users.insert_one(user)
    token = create_token(user["id"], user["email"], user["role"])
    user_out = {k: v for k, v in user.items() if k not in ("password_hash", "_id", "created_at")}
    return {"token": token, "user": user_out}

@api.post("/auth/login")
async def login(payload: LoginIn):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["email"], user["role"])
    user_out = {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role": user["role"],
        "property_assignment": user.get("property_assignment"),
        "phone": user.get("phone"),
        "status": user.get("status", "Active"),
    }
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_login": now_utc()}})
    return {"token": token, "user": user_out}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# ---------- Properties ----------
@api.get("/properties")
async def list_properties(user: dict = Depends(get_current_user)):
    items = await db.properties.find({}, {"_id": 0}).to_list(500)
    return items

@api.post("/properties")
async def create_property(body: dict, user: dict = Depends(require_roles("admin"))):
    item = {
        "id": str(uuid.uuid4()),
        "name": body["name"],
        "address": body.get("address", ""),
        "status": "Active",
        "created_at": now_utc(),
    }
    await db.properties.insert_one(item)
    return {k: v for k, v in item.items() if k not in ("_id", "created_at")}

# ---------- Categories ----------
@api.get("/categories")
async def list_categories(user: dict = Depends(get_current_user)):
    items = await db.categories.find({}, {"_id": 0}).to_list(500)
    return items

@api.post("/categories")
async def create_category(body: dict, user: dict = Depends(require_roles("admin"))):
    item = {
        "id": str(uuid.uuid4()),
        "name": body["name"],
        "description": body.get("description", ""),
        "status": "Active",
    }
    await db.categories.insert_one(item)
    return {k: v for k, v in item.items() if k != "_id"}

# ---------- Assets ----------
@api.get("/assets")
async def list_assets(
    category: Optional[str] = None,
    status_filter: Optional[str] = None,
    q: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    query: dict = {}
    if category:
        query["category"] = category
    if status_filter:
        query["status"] = status_filter
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"asset_id": {"$regex": q, "$options": "i"}},
            {"brand": {"$regex": q, "$options": "i"}},
        ]
    projection = {"_id": 0}
    if user["role"] == "trade":
        projection.update({"cost": 0, "insurance_value": 0, "maintenance_notes": 0})
    items = await db.assets.find(query, projection).sort("name", 1).to_list(500)
    return [serialize_dt(i) for i in items]

@api.get("/assets/{asset_id}")
async def get_asset(asset_id: str, user: dict = Depends(get_current_user)):
    projection = {"_id": 0}
    if user["role"] == "trade":
        projection.update({"cost": 0, "insurance_value": 0, "maintenance_notes": 0})
    asset = await db.assets.find_one({"id": asset_id}, projection)
    if not asset:
        raise HTTPException(404, "Asset not found")
    return serialize_dt(asset)

@api.post("/assets")
async def create_asset(payload: AssetIn, user: dict = Depends(require_roles("admin"))):
    if await db.assets.find_one({"asset_id": payload.asset_id}):
        raise HTTPException(400, "Asset ID already exists")
    item = {
        "id": str(uuid.uuid4()),
        "asset_id": payload.asset_id,
        "name": payload.name,
        "brand": payload.brand,
        "model": payload.model,
        "serial_no": payload.serial_no,
        "category": payload.category,
        "description": payload.description,
        "image_url": payload.image_url,
        "location": payload.location,
        "status": "Available",
        "qr_code": f"{payload.asset_id}|{payload.name}",
        "total_checkouts": 0,
        "created_at": now_utc(),
    }
    await db.assets.insert_one(item)
    item.pop("_id", None)
    return serialize_dt(item)

@api.patch("/assets/{asset_id}")
async def update_asset(asset_id: str, payload: AssetUpdate, user: dict = Depends(require_roles("admin"))):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    res = await db.assets.update_one({"id": asset_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Asset not found")
    asset = await db.assets.find_one({"id": asset_id}, {"_id": 0})
    return serialize_dt(asset)

# ---------- Checkouts ----------
async def _enrich_checkout(c: dict) -> dict:
    asset = await db.assets.find_one({"id": c["asset_uid"]}, {"_id": 0, "name": 1, "asset_id": 1, "image_url": 1, "brand": 1, "model": 1, "category": 1})
    user = await db.users.find_one({"id": c["user_id"]}, {"_id": 0, "full_name": 1, "email": 1, "phone": 1})
    out = serialize_dt(c)
    out["asset"] = asset
    out["user"] = user
    # overdue calc
    expected = c.get("expected_return_date")
    if expected and c["status"] == "Open":
        try:
            exp_dt = datetime.fromisoformat(expected.replace("Z", "+00:00")) if isinstance(expected, str) else expected
            today = now_utc()
            days_overdue = (today.date() - exp_dt.date()).days if exp_dt else 0
            out["overdue"] = days_overdue > 0
            out["days_overdue"] = max(0, days_overdue)
        except Exception:
            out["overdue"] = False
            out["days_overdue"] = 0
    else:
        out["overdue"] = False
        out["days_overdue"] = 0
    # days out
    created = c.get("timestamp_created")
    if created:
        c_dt = datetime.fromisoformat(created.replace("Z", "+00:00")) if isinstance(created, str) else created
        out["days_out"] = (now_utc().date() - c_dt.date()).days
    return out

@api.post("/checkouts")
async def create_checkout(payload: CheckoutIn, user: dict = Depends(get_current_user)):
    asset = await db.assets.find_one({"id": payload.asset_id})
    if not asset:
        raise HTTPException(404, "Asset not found")
    if asset["status"] not in ("Available", "Booked"):
        raise HTTPException(400, f"Asset is currently {asset['status']}")
    co = {
        "id": str(uuid.uuid4()),
        "asset_uid": payload.asset_id,
        "asset_id": asset["asset_id"],
        "asset_name": asset["name"],
        "user_id": user["id"],
        "user_name": user["full_name"],
        "property": payload.property,
        "expected_return_date": payload.expected_return_date,
        "actual_return_date": None,
        "notes": payload.notes,
        "status": "Open",
        "timestamp_created": now_utc(),
    }
    await db.checkouts.insert_one(co)
    await db.assets.update_one(
        {"id": payload.asset_id},
        {
            "$set": {
                "status": "Checked Out",
                "last_checked_out_by": user["full_name"],
                "last_checked_out_date": now_utc(),
            },
            "$inc": {"total_checkouts": 1},
        },
    )
    await db.audit.insert_one({
        "id": str(uuid.uuid4()),
        "timestamp": now_utc(),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "action": "checkout",
        "entity": "asset",
        "asset_id": asset["asset_id"],
        "asset_name": asset["name"],
        "details": f"Checked out to {payload.property}",
    })
    co.pop("_id", None)
    return serialize_dt(co)

@api.get("/checkouts")
async def list_checkouts(
    open_only: bool = False,
    mine: bool = False,
    user: dict = Depends(get_current_user),
):
    query: dict = {}
    if open_only:
        query["status"] = "Open"
    if mine or user["role"] == "trade":
        query["user_id"] = user["id"]
    elif user["role"] == "supervisor" and user.get("property_assignment") and user.get("property_assignment") != "All Properties":
        query["property"] = user["property_assignment"]
    items = await db.checkouts.find(query, {"_id": 0}).sort("timestamp_created", -1).to_list(500)
    return [await _enrich_checkout(i) for i in items]

# ---------- Checkins ----------
@api.post("/checkins")
async def create_checkin(payload: CheckinIn, user: dict = Depends(get_current_user)):
    asset = await db.assets.find_one({"id": payload.asset_id})
    if not asset:
        raise HTTPException(404, "Asset not found")
    open_co = await db.checkouts.find_one({"asset_uid": payload.asset_id, "status": "Open"})
    if not open_co:
        raise HTTPException(400, "No open checkout for this asset")
    ci = {
        "id": str(uuid.uuid4()),
        "asset_uid": payload.asset_id,
        "asset_id": asset["asset_id"],
        "asset_name": asset["name"],
        "user_id": user["id"],
        "user_name": user["full_name"],
        "condition": payload.condition,
        "notes": payload.notes,
        "photo_base64": payload.photo_base64,
        "linked_checkout_id": open_co["id"],
        "property_returned_at": open_co["property"],
        "timestamp_created": now_utc(),
    }
    await db.checkins.insert_one(ci)
    await db.checkouts.update_one(
        {"id": open_co["id"]},
        {"$set": {"status": "Closed", "actual_return_date": now_utc(), "linked_checkin_id": ci["id"]}},
    )
    new_status = "Available" if payload.condition == "Good" else "Maintenance" if payload.condition in ("Major Damage", "Missing Parts") else "Available"
    await db.assets.update_one({"id": payload.asset_id}, {"$set": {"status": new_status}})
    await db.audit.insert_one({
        "id": str(uuid.uuid4()),
        "timestamp": now_utc(),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "action": "checkin",
        "entity": "asset",
        "asset_id": asset["asset_id"],
        "asset_name": asset["name"],
        "details": f"Returned condition: {payload.condition}",
    })
    ci.pop("_id", None)
    return serialize_dt(ci)

@api.get("/checkins")
async def list_checkins(user: dict = Depends(get_current_user)):
    query: dict = {}
    if user["role"] == "trade":
        query["user_id"] = user["id"]
    elif user["role"] == "supervisor" and user.get("property_assignment") and user.get("property_assignment") != "All Properties":
        query["property_returned_at"] = user["property_assignment"]
    items = await db.checkins.find(query, {"_id": 0}).sort("timestamp_created", -1).to_list(500)
    return [serialize_dt(i) for i in items]

# ---------- Bookings ----------
async def _enrich_booking(b: dict) -> dict:
    asset = await db.assets.find_one({"id": b["asset_uid"]}, {"_id": 0, "name": 1, "asset_id": 1, "image_url": 1, "category": 1})
    user = await db.users.find_one({"id": b["user_id"]}, {"_id": 0, "full_name": 1, "email": 1})
    out = serialize_dt(b)
    out["asset"] = asset
    out["user"] = user
    return out

@api.post("/bookings")
async def create_booking(payload: BookingIn, user: dict = Depends(get_current_user)):
    asset = await db.assets.find_one({"id": payload.asset_id})
    if not asset:
        raise HTTPException(404, "Asset not found")
    bk = {
        "id": str(uuid.uuid4()),
        "asset_uid": payload.asset_id,
        "asset_id": asset["asset_id"],
        "asset_name": asset["name"],
        "user_id": user["id"],
        "user_name": user["full_name"],
        "property": payload.property,
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "purpose": payload.purpose,
        "status": "Pending",
        "request_date": now_utc(),
    }
    await db.bookings.insert_one(bk)
    await db.audit.insert_one({
        "id": str(uuid.uuid4()),
        "timestamp": now_utc(),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "action": "booking_requested",
        "entity": "booking",
        "asset_id": asset["asset_id"],
        "asset_name": asset["name"],
        "details": f"{payload.start_date} → {payload.end_date}",
    })
    bk.pop("_id", None)
    return serialize_dt(bk)

@api.get("/bookings")
async def list_bookings(
    status_filter: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    query: dict = {}
    if status_filter:
        query["status"] = status_filter
    if user["role"] == "trade":
        query["user_id"] = user["id"]
    elif user["role"] == "supervisor" and user.get("property_assignment") and user.get("property_assignment") != "All Properties":
        query["property"] = user["property_assignment"]
    items = await db.bookings.find(query, {"_id": 0}).sort("request_date", -1).to_list(500)
    return [await _enrich_booking(i) for i in items]

@api.post("/bookings/{booking_id}/approve")
async def approve_booking(booking_id: str, user: dict = Depends(require_roles("admin", "supervisor"))):
    bk = await db.bookings.find_one({"id": booking_id})
    if not bk:
        raise HTTPException(404, "Booking not found")
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "Approved", "approved_by": user["full_name"], "approval_date": now_utc()}},
    )
    await db.audit.insert_one({
        "id": str(uuid.uuid4()),
        "timestamp": now_utc(),
        "user_id": user["id"],
        "user_name": user["full_name"],
        "action": "booking_approved",
        "entity": "booking",
        "asset_id": bk["asset_id"],
        "asset_name": bk["asset_name"],
        "details": f"Booking {booking_id[:8]} approved",
    })
    return {"ok": True}

@api.post("/bookings/{booking_id}/reject")
async def reject_booking(booking_id: str, payload: BookingDecision, user: dict = Depends(require_roles("admin", "supervisor"))):
    bk = await db.bookings.find_one({"id": booking_id})
    if not bk:
        raise HTTPException(404, "Booking not found")
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "Rejected", "approved_by": user["full_name"], "rejection_reason": payload.rejection_reason or "Not specified"}},
    )
    return {"ok": True}

# ---------- Dashboard ----------
@api.get("/dashboard/summary")
async def dashboard_summary(user: dict = Depends(get_current_user)):
    asset_query: dict = {}
    co_query: dict = {"status": "Open"}
    if user["role"] == "supervisor" and user.get("property_assignment") and user.get("property_assignment") != "All Properties":
        co_query["property"] = user["property_assignment"]

    total_assets = await db.assets.count_documents({})
    out_count = await db.assets.count_documents({"status": "Checked Out"})
    available_count = await db.assets.count_documents({"status": "Available"})
    maintenance_count = await db.assets.count_documents({"status": "Maintenance"})
    booked_count = await db.assets.count_documents({"status": "Booked"})

    open_checkouts = await db.checkouts.find(co_query, {"_id": 0}).to_list(500)
    today = now_utc().date()
    overdue = 0
    due_today = 0
    for c in open_checkouts:
        try:
            exp = c.get("expected_return_date")
            if not exp:
                continue
            exp_dt = datetime.fromisoformat(exp.replace("Z", "+00:00")) if isinstance(exp, str) else exp
            d = exp_dt.date()
            if d < today:
                overdue += 1
            elif d == today:
                due_today += 1
        except Exception:
            pass

    pending_bookings = await db.bookings.count_documents({"status": "Pending"})

    my_open = 0
    if user["role"] == "trade":
        my_open = await db.checkouts.count_documents({"user_id": user["id"], "status": "Open"})

    return {
        "total_assets": total_assets,
        "available": available_count,
        "checked_out": out_count,
        "maintenance": maintenance_count,
        "booked": booked_count,
        "open_checkouts": len(open_checkouts),
        "overdue": overdue,
        "due_today": due_today,
        "pending_bookings": pending_bookings,
        "my_open_checkouts": my_open,
    }

# ---------- Audit ----------
@api.get("/audit")
async def list_audit(user: dict = Depends(require_roles("admin"))):
    items = await db.audit.find({}, {"_id": 0}).sort("timestamp", -1).limit(200).to_list(200)
    return [serialize_dt(i) for i in items]

# ---------- Users (Admin) ----------
@api.get("/users")
async def list_users(user: dict = Depends(require_roles("admin"))):
    items = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return [serialize_dt(i) for i in items]

# ---------- Seed ----------
PROPERTIES = [
    "96 Newman Avenue",
    "6 & 8 Dagmar",
    "119 Buena Vista",
    "30 Matong",
    "79 Lapraik",
]

CATEGORIES = [
    "Access",
    "Power Tools",
    "Gardening",
    "Power Equipment",
    "Material Handling",
    "Hand Tools",
    "Measuring Equipment",
    "Power Tool Accessory",
]

SAMPLE_ASSETS = [
    {"asset_id": "ACCE-001", "name": "Platform Ladder – Bailey – 3 Metre", "brand": "Bailey", "model": "FS13980", "serial_no": "BAL-3M-001", "category": "Access", "image_url": "https://images.unsplash.com/photo-1603080296081-81f47189df91?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTV8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBsYWRkZXJ8ZW58MHx8fHwxNzc3Mjg1NTk5fDA&ixlib=rb-4.1.0&q=85", "location": "96 Newman Avenue – Storage"},
    {"asset_id": "ACCE-002", "name": "Extension Ladder – 6 Metre", "brand": "Bailey", "model": "FS13881", "serial_no": "BAL-6M-002", "category": "Access", "image_url": "https://images.unsplash.com/photo-1603080296081-81f47189df91?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTV8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBsYWRkZXJ8ZW58MHx8fHwxNzc3Mjg1NTk5fDA&ixlib=rb-4.1.0&q=85", "location": "6 & 8 Dagmar – Garage"},
    {"asset_id": "PTA-001", "name": "Hammer Drill – DeWalt 20V Max", "brand": "DeWalt", "model": "DCD996", "serial_no": "DW-996-101", "category": "Power Tools", "image_url": "https://images.pexels.com/photos/30413424/pexels-photo-30413424.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", "location": "96 Newman Avenue – Tool Room"},
    {"asset_id": "PTA-002", "name": "Circular Saw – Makita 18V", "brand": "Makita", "model": "DSS611Z", "serial_no": "MAK-611-202", "category": "Power Tools", "image_url": "https://images.pexels.com/photos/30413424/pexels-photo-30413424.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", "location": "30 Matong – Site Box"},
    {"asset_id": "GAR-001", "name": "Stihl Brushcutter FS 91 R", "brand": "Stihl", "model": "FS 91 R", "serial_no": "STH-FS91-301", "category": "Gardening", "image_url": "https://images.pexels.com/photos/11397558/pexels-photo-11397558.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", "location": "119 Buena Vista"},
    {"asset_id": "PEQ-001", "name": "Honda Generator EU22i", "brand": "Honda", "model": "EU22i", "serial_no": "HON-EU22-401", "category": "Power Equipment", "image_url": "https://images.pexels.com/photos/5693845/pexels-photo-5693845.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", "location": "79 Lapraik"},
    {"asset_id": "MHA-001", "name": "Electric Pallet Jack – 2T", "brand": "Linde", "model": "T20SP", "serial_no": "LIN-T20-501", "category": "Material Handling", "image_url": "https://images.pexels.com/photos/29491416/pexels-photo-29491416.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", "location": "96 Newman Avenue"},
    {"asset_id": "HTL-001", "name": "Stanley FatMax Hammer 20oz", "brand": "Stanley", "model": "FMHT51305", "serial_no": "STA-FM-601", "category": "Hand Tools", "image_url": "https://images.unsplash.com/photo-1676311396794-f14881e9daaa?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwxfHxoYW1tZXIlMjB3cmVuY2h8ZW58MHx8fHwxNzc3Mjg1NTk5fDA&ixlib=rb-4.1.0&q=85", "location": "6 & 8 Dagmar"},
    {"asset_id": "MEA-001", "name": "Bosch GLM 50 Laser Measure", "brand": "Bosch", "model": "GLM 50", "serial_no": "BOS-GLM-701", "category": "Measuring Equipment", "image_url": "https://images.pexels.com/photos/32942847/pexels-photo-32942847.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", "location": "30 Matong"},
    {"asset_id": "MEA-002", "name": "Stabila Spirit Level – 1.2m", "brand": "Stabila", "model": "96-2 / 120cm", "serial_no": "STB-120-702", "category": "Measuring Equipment", "image_url": "https://images.pexels.com/photos/32942847/pexels-photo-32942847.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940", "location": "119 Buena Vista"},
]

async def seed():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.assets.create_index("id", unique=True)
    await db.assets.create_index("asset_id", unique=True)
    await db.checkouts.create_index("id", unique=True)
    await db.checkins.create_index("id", unique=True)
    await db.bookings.create_index("id", unique=True)

    # Properties
    if await db.properties.count_documents({}) == 0:
        for p in PROPERTIES:
            await db.properties.insert_one({"id": str(uuid.uuid4()), "name": p, "address": "", "status": "Active"})

    # Categories
    if await db.categories.count_documents({}) == 0:
        for c in CATEGORIES:
            await db.categories.insert_one({"id": str(uuid.uuid4()), "name": c, "description": "", "status": "Active"})

    # Users
    seed_users = [
        {"email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"], "full_name": "Naomi Admin", "role": "admin", "property_assignment": "All Properties"},
        {"email": os.environ["SUPERVISOR_EMAIL"], "password": os.environ["SUPERVISOR_PASSWORD"], "full_name": "Mark Supervisor", "role": "supervisor", "property_assignment": "96 Newman Avenue"},
        {"email": os.environ["TRADE_EMAIL"], "password": os.environ["TRADE_PASSWORD"], "full_name": "Johnny Fainges", "role": "trade", "property_assignment": "96 Newman Avenue"},
    ]
    for u in seed_users:
        existing = await db.users.find_one({"email": u["email"].lower()})
        if not existing:
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "email": u["email"].lower(),
                "password_hash": hash_password(u["password"]),
                "full_name": u["full_name"],
                "role": u["role"],
                "property_assignment": u["property_assignment"],
                "phone": None,
                "status": "Active",
                "created_at": now_utc(),
            })
        else:
            if not verify_password(u["password"], existing["password_hash"]):
                await db.users.update_one(
                    {"email": u["email"].lower()},
                    {"$set": {"password_hash": hash_password(u["password"])}},
                )

    # Assets
    if await db.assets.count_documents({}) == 0:
        for a in SAMPLE_ASSETS:
            await db.assets.insert_one({
                "id": str(uuid.uuid4()),
                **a,
                "status": "Available",
                "qr_code": f"{a['asset_id']}|{a['name']}",
                "total_checkouts": 0,
                "created_at": now_utc(),
            })

# ---------- Lifecycle ----------
@app.on_event("startup")
async def on_start():
    await seed()

@app.on_event("shutdown")
async def on_stop():
    client.close()

# ---------- CORS ----------
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sabdia")
