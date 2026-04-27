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
    role: Literal["admin", "team"] = "team"
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

class InviteUserIn(BaseModel):
    email: EmailStr
    full_name: str
    role: Literal["admin", "team"] = "team"
    property_assignment: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None  # Admin can set initial password; otherwise auto-generated

class UpdateUserIn(BaseModel):
    full_name: Optional[str] = None
    role: Optional[Literal["admin", "team"]] = None
    property_assignment: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    status: Optional[Literal["Active", "Deactivated"]] = None

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
    checkout_photo_url: Optional[str] = None  # base64 data URI

class CheckinIn(BaseModel):
    asset_id: str  # asset's UUID
    condition: Literal["Good", "Minor Damage", "Major Damage", "Missing Parts"]
    notes: Optional[str] = None
    checkin_photo_url: Optional[str] = None
    condition_photo_url: Optional[str] = None

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
    if user.get("status") == "Deactivated":
        raise HTTPException(status_code=403, detail="Account deactivated. Contact administrator.")
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
    if user["role"] == "team":
        projection.update({"cost": 0, "insurance_value": 0, "maintenance_notes": 0})
    items = await db.assets.find(query, projection).sort("name", 1).to_list(500)
    # Enrich with current holder + checkout info
    open_cos = await db.checkouts.find({"status": "Open"}, {"_id": 0, "asset_uid": 1, "user_name": 1, "user_id": 1, "expected_return_date": 1, "property": 1, "timestamp_created": 1}).to_list(2000)
    co_map = {c["asset_uid"]: c for c in open_cos}
    enriched = []
    for i in items:
        d = serialize_dt(i)
        co = co_map.get(d.get("id"))
        if co:
            d["current_holder"] = co.get("user_name")
            d["current_holder_user_id"] = co.get("user_id")
            d["current_property"] = co.get("property")
            d["expected_return_date"] = co.get("expected_return_date")
            d["checked_out_at"] = co.get("timestamp_created").isoformat() if isinstance(co.get("timestamp_created"), datetime) else co.get("timestamp_created")
        else:
            d["current_holder"] = None
        enriched.append(d)
    return enriched

@api.get("/assets/{asset_id}")
async def get_asset(asset_id: str, user: dict = Depends(get_current_user)):
    projection = {"_id": 0}
    if user["role"] == "team":
        projection.update({"cost": 0, "insurance_value": 0, "maintenance_notes": 0})
    asset = await db.assets.find_one({"id": asset_id}, projection)
    if not asset:
        raise HTTPException(404, "Asset not found")
    out = serialize_dt(asset)
    co = await db.checkouts.find_one({"asset_uid": asset_id, "status": "Open"}, {"_id": 0})
    if co:
        out["current_holder"] = co.get("user_name")
        out["current_holder_user_id"] = co.get("user_id")
        out["current_property"] = co.get("property")
        out["expected_return_date"] = co.get("expected_return_date")
        out["checked_out_at"] = co.get("timestamp_created").isoformat() if isinstance(co.get("timestamp_created"), datetime) else co.get("timestamp_created")
    return out

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
        "checkout_photo_url": payload.checkout_photo_url,
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
    if mine or user["role"] == "team":
        query["user_id"] = user["id"]
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
    # Permission: only the original checker OR an admin can check in
    if user["role"] != "admin" and open_co["user_id"] != user["id"]:
        raise HTTPException(403, f"Only {open_co['user_name']} or an Admin can check in this asset.")
    ci = {
        "id": str(uuid.uuid4()),
        "asset_uid": payload.asset_id,
        "asset_id": asset["asset_id"],
        "asset_name": asset["name"],
        "user_id": user["id"],
        "user_name": user["full_name"],
        "condition": payload.condition,
        "notes": payload.notes,
        "condition_photo_url": payload.condition_photo_url,
        "checkin_photo_url": payload.checkin_photo_url,
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
    if user["role"] == "team":
        query["user_id"] = user["id"]
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
    # Conflict detection: existing approved/pending booking that overlaps OR open checkout
    conflicts = await db.bookings.find({
        "asset_uid": payload.asset_id,
        "status": {"$in": ["Pending", "Approved"]},
        "start_date": {"$lte": payload.end_date},
        "end_date": {"$gte": payload.start_date},
    }).to_list(20)
    open_co = await db.checkouts.find_one({"asset_uid": payload.asset_id, "status": "Open"})
    has_conflict = bool(conflicts) or bool(open_co)
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
        "has_conflict": has_conflict,
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
    if user["role"] == "team":
        query["user_id"] = user["id"]
    items = await db.bookings.find(query, {"_id": 0}).sort("request_date", -1).to_list(500)
    return [await _enrich_booking(i) for i in items]

@api.post("/bookings/{booking_id}/approve")
async def approve_booking(booking_id: str, user: dict = Depends(require_roles("admin"))):
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
async def reject_booking(booking_id: str, payload: BookingDecision, user: dict = Depends(require_roles("admin"))):
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
    co_query: dict = {"status": "Open"}

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
    if user["role"] == "team":
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
    items = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("full_name", 1).to_list(500)
    return [serialize_dt(i) for i in items]

import secrets, string

def _gen_password() -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(10))

@api.post("/users")
async def invite_user(payload: InviteUserIn, admin: dict = Depends(require_roles("admin"))):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "User with that email already exists")
    initial_pw = payload.password or _gen_password()
    new_user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(initial_pw),
        "full_name": payload.full_name,
        "role": payload.role,
        "property_assignment": payload.property_assignment,
        "phone": payload.phone,
        "status": "Active",
        "invited_by": admin["full_name"],
        "created_at": now_utc(),
    }
    await db.users.insert_one(new_user)
    await db.audit.insert_one({
        "id": str(uuid.uuid4()),
        "timestamp": now_utc(),
        "user_id": admin["id"],
        "user_name": admin["full_name"],
        "action": "user_invited",
        "entity": "user",
        "details": f"Invited {payload.full_name} <{email}> as {payload.role}",
    })
    logger.info(f"[INVITE] {admin['full_name']} invited {payload.full_name} <{email}> · role={payload.role} · initial_pw={initial_pw}")
    out = {k: v for k, v in new_user.items() if k not in ("password_hash", "_id")}
    out["initial_password"] = initial_pw  # Return so admin can copy/share
    return serialize_dt(out)

@api.patch("/users/{user_id}")
async def update_user(user_id: str, payload: UpdateUserIn, admin: dict = Depends(require_roles("admin"))):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User not found")
    updates = {}
    for k in ("full_name", "role", "property_assignment", "phone", "status"):
        v = getattr(payload, k)
        if v is not None:
            updates[k] = v
    if payload.password:
        updates["password_hash"] = hash_password(payload.password)
    if not updates:
        raise HTTPException(400, "No fields to update")
    await db.users.update_one({"id": user_id}, {"$set": updates})
    await db.audit.insert_one({
        "id": str(uuid.uuid4()),
        "timestamp": now_utc(),
        "user_id": admin["id"],
        "user_name": admin["full_name"],
        "action": "user_updated",
        "entity": "user",
        "details": f"Updated {target['full_name']}: {list(updates.keys())}",
    })
    out = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return serialize_dt(out)

@api.post("/users/{user_id}/deactivate")
async def deactivate_user(user_id: str, admin: dict = Depends(require_roles("admin"))):
    if user_id == admin["id"]:
        raise HTTPException(400, "You cannot deactivate yourself")
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User not found")
    await db.users.update_one({"id": user_id}, {"$set": {"status": "Deactivated"}})
    await db.audit.insert_one({
        "id": str(uuid.uuid4()),
        "timestamp": now_utc(),
        "user_id": admin["id"],
        "user_name": admin["full_name"],
        "action": "user_deactivated",
        "entity": "user",
        "details": f"Deactivated {target['full_name']}",
    })
    return {"ok": True}

@api.post("/users/{user_id}/reactivate")
async def reactivate_user(user_id: str, admin: dict = Depends(require_roles("admin"))):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User not found")
    await db.users.update_one({"id": user_id}, {"$set": {"status": "Active"}})
    return {"ok": True}

@api.post("/users/{user_id}/reset-password")
async def reset_password(user_id: str, admin: dict = Depends(require_roles("admin"))):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User not found")
    new_pw = _gen_password()
    await db.users.update_one({"id": user_id}, {"$set": {"password_hash": hash_password(new_pw)}})
    logger.info(f"[RESET] {admin['full_name']} reset password for {target['full_name']} → {new_pw}")
    return {"ok": True, "new_password": new_pw}

# ---------- Seed ----------
PROPERTIES = [
    "Warehouse",
    "On Site",
    "30 Matong",
    "79 Lapraik",
    "6 Dagmar",
    "8 Dagmar",
    "119 Buena Vista",
    "96 Newman Avenue",
]

CATEGORIES = [
    "Access",
    "Power Tools",
    "Power Equipment",
    "Power Tool Accessory",
    "Hand Tools",
    "Gardening",
    "Material Handling",
    "Measuring Equipment",
    "Accessory",
]

import json as _json

def _load_seed_assets():
    p = ROOT_DIR / "seed_data" / "assets.json"
    if p.exists():
        with open(p, "r") as f:
            return _json.load(f)
    return []

async def _seed_assets_from_file(force: bool = False):
    """Insert assets from seed_data/assets.json. If force=True, drop existing first."""
    data = _load_seed_assets()
    if not data:
        return 0
    if force:
        await db.assets.delete_many({})
    inserted = 0
    for a in data:
        if not force and await db.assets.find_one({"asset_id": a["asset_id"]}):
            continue
        doc = {
            "id": str(uuid.uuid4()),
            "asset_id": a["asset_id"],
            "name": a["name"],
            "brand": a.get("brand"),
            "model": a.get("model"),
            "serial_no": a.get("serial_no"),
            "category": a.get("category") or "Hand Tools",
            "image_url": a.get("image_url"),
            "location": a.get("location") or "Warehouse",
            "status": "Available",
            "qr_code": f"{a['asset_id']}|{a['name']}",
            "total_checkouts": 0,
            "created_at": now_utc(),
        }
        await db.assets.insert_one(doc)
        inserted += 1
    return inserted

async def seed():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.assets.create_index("id", unique=True)
    await db.assets.create_index("asset_id", unique=True)
    await db.checkouts.create_index("id", unique=True)
    await db.checkins.create_index("id", unique=True)
    await db.bookings.create_index("id", unique=True)

    # Properties — replace if changed
    if await db.properties.count_documents({}) == 0:
        for p in PROPERTIES:
            await db.properties.insert_one({"id": str(uuid.uuid4()), "name": p, "address": "", "status": "Active"})

    # Categories
    if await db.categories.count_documents({}) == 0:
        for c in CATEGORIES:
            await db.categories.insert_one({"id": str(uuid.uuid4()), "name": c, "description": "", "status": "Active"})

    # Migrate any old users with role 'supervisor' or 'trade' → 'team'
    await db.users.update_many({"role": {"$in": ["supervisor", "trade"]}}, {"$set": {"role": "team"}})

    # Seed admin user (idempotent)
    seed_users = [
        {"email": os.environ.get("ADMIN_EMAIL", "naomi@sabdia.com"), "password": os.environ.get("ADMIN_PASSWORD", "Admin123!"), "full_name": "Naomi Durcau", "role": "admin"},
        {"email": "johnny@sabdia.com", "password": "Team123!", "full_name": "Johnny Fainges", "role": "team"},
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
                "property_assignment": None,
                "phone": None,
                "status": "Active",
                "created_at": now_utc(),
            })
        else:
            # Reset password if doesn't match (only for seed defaults)
            if not verify_password(u["password"], existing["password_hash"]):
                await db.users.update_one(
                    {"email": u["email"].lower()},
                    {"$set": {"password_hash": hash_password(u["password"]), "role": u["role"], "status": "Active"}},
                )

    # Re-seed assets from new XLSX-derived JSON.
    # Strategy: if collection empty, seed; otherwise, only add NEW asset_ids.
    if await db.assets.count_documents({}) == 0:
        await _seed_assets_from_file(force=False)
    else:
        # Add any new assets from updated file without dropping existing
        await _seed_assets_from_file(force=False)


# Admin-only utility to wipe + re-seed assets
@api.post("/admin/reseed-assets")
async def reseed_assets(admin: dict = Depends(require_roles("admin"))):
    # Cancel any open checkouts/bookings tied to deleted assets
    await db.checkouts.delete_many({})
    await db.checkins.delete_many({})
    await db.bookings.delete_many({})
    n = await _seed_assets_from_file(force=True)
    await db.audit.insert_one({
        "id": str(uuid.uuid4()),
        "timestamp": now_utc(),
        "user_id": admin["id"],
        "user_name": admin["full_name"],
        "action": "assets_reseeded",
        "entity": "asset",
        "details": f"Re-seeded {n} assets from XLSX",
    })
    return {"ok": True, "inserted": n}

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
