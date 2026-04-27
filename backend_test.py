"""
Backend smoke tests for Custom Fields module.
Credentials from /app/memory/test_credentials.md.
"""
import sys
import requests

BASE = "https://equipment-checkout-10.preview.emergentagent.com/api"
ADMIN = {"email": "naomi@sabdia.com", "password": "Admin123!"}
TEAM = {"email": "johnny@sabdia.com", "password": "Team123!"}

results = []

def record(step, ok, msg):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {step}: {msg}")
    results.append((step, ok, msg))

def login(creds):
    r = requests.post(f"{BASE}/auth/login", json=creds, timeout=20)
    r.raise_for_status()
    return r.json()["token"]

def H(tok):
    return {"Authorization": f"Bearer {tok}"}

def main():
    try:
        admin_tok = login(ADMIN)
        record("0a", True, "admin login ok")
    except Exception as e:
        record("0a", False, f"admin login failed: {e}")
        return
    try:
        team_tok = login(TEAM)
        record("0b", True, "team login ok")
    except Exception as e:
        record("0b", False, f"team login failed: {e}")
        return

    # Clean any residue from previous runs so keys don't collide.
    try:
        from pymongo import MongoClient
        mongo_url = None
        db_name = None
        with open("/app/backend/.env") as f:
            for line in f:
                if line.startswith("MONGO_URL="):
                    mongo_url = line.split("=", 1)[1].strip().strip('"').strip("'")
                if line.startswith("DB_NAME="):
                    db_name = line.split("=", 1)[1].strip().strip('"').strip("'")
        mc = MongoClient(mongo_url)
        dbh = mc[db_name]
        dbh.custom_fields.delete_many({
            "key": {"$in": ["compliance_expiry", "compliance_due", "service_status", "test_select"]},
            "applies_to": "asset",
        })
        dbh.assets.update_many({}, {"$unset": {"custom_fields": ""}})
        record("0c", True, "clean slate done")
    except Exception as e:
        record("0c", False, f"clean slate failed: {e}")

    # Step 2
    r = requests.post(f"{BASE}/custom-fields", headers=H(admin_tok), json={
        "label": "Compliance Expiry",
        "field_type": "date",
        "required": True,
        "order": 1,
        "applies_to": "asset",
    }, timeout=20)
    ok = r.status_code == 200 and r.json().get("key") == "compliance_expiry"
    record("2", ok, f"status={r.status_code} body={r.text[:200]}")
    compliance_field_id = r.json().get("id") if r.status_code == 200 else None

    # Step 3
    r = requests.post(f"{BASE}/custom-fields", headers=H(admin_tok), json={
        "label": "Compliance Expiry",
        "field_type": "date",
        "applies_to": "asset",
    }, timeout=20)
    ok = r.status_code == 400 and "already exists" in r.text.lower()
    record("3", ok, f"dup-prevention status={r.status_code} body={r.text[:200]}")

    # Step 4
    r = requests.post(f"{BASE}/custom-fields", headers=H(admin_tok), json={
        "label": "Test Select",
        "field_type": "select",
        "applies_to": "asset",
    }, timeout=20)
    ok = r.status_code == 400 and "at least one option" in r.text.lower()
    record("4", ok, f"status={r.status_code} body={r.text[:200]}")

    # Step 5
    r = requests.post(f"{BASE}/custom-fields", headers=H(admin_tok), json={
        "label": "Service Status",
        "field_type": "select",
        "options": ["Up to date", "Service due"],
        "order": 2,
        "applies_to": "asset",
    }, timeout=20)
    ok = r.status_code == 200 and r.json().get("key") == "service_status"
    record("5", ok, f"status={r.status_code} body={r.text[:200]}")

    # Step 6
    r = requests.get(f"{BASE}/custom-fields?applies_to=asset", headers=H(admin_tok), timeout=20)
    fields = r.json() if r.status_code == 200 else []
    keys = [f["key"] for f in fields]
    orders = [f["order"] for f in fields]
    has_both = "compliance_expiry" in keys and "service_status" in keys
    sorted_asc = orders == sorted(orders)
    ok = r.status_code == 200 and has_both and sorted_asc and len(fields) >= 2
    record("6", ok, f"status={r.status_code} count={len(fields)} keys={keys} orders={orders}")

    # Step 7
    r = requests.get(f"{BASE}/assets", headers=H(admin_tok), timeout=20)
    assets = r.json() if r.status_code == 200 else []
    asset = assets[0] if assets else None
    record("7", asset is not None, f"picked asset_id={asset and asset.get('asset_id')} id={asset and asset.get('id')}")
    if not asset:
        return
    asset_uid = asset["id"]

    # Step 8
    r = requests.put(f"{BASE}/assets/{asset_uid}/custom-fields", headers=H(admin_tok), json={
        "values": {
            "compliance_expiry": "2027-03-01",
            "service_status": "Up to date",
            "unknown_key": "ignored",
        }
    }, timeout=20)
    body = r.json() if r.status_code == 200 else {}
    cf = body.get("custom_fields", {})
    ok = (
        r.status_code == 200
        and "unknown_key" not in cf
        and cf.get("compliance_expiry") == "2027-03-01"
        and cf.get("service_status") == "Up to date"
    )
    record("8", ok, f"status={r.status_code} custom_fields={cf}")

    # Step 9
    r = requests.get(f"{BASE}/assets/{asset_uid}", headers=H(admin_tok), timeout=20)
    body = r.json() if r.status_code == 200 else {}
    cf = body.get("custom_fields", {})
    ok = (
        r.status_code == 200
        and cf.get("compliance_expiry") == "2027-03-01"
        and cf.get("service_status") == "Up to date"
    )
    record("9", ok, f"status={r.status_code} custom_fields={cf}")

    # Step 10
    r = requests.get(f"{BASE}/custom-fields?applies_to=asset", headers=H(team_tok), timeout=20)
    ok = r.status_code == 200 and isinstance(r.json(), list)
    record("10", ok, f"team GET status={r.status_code} count={len(r.json()) if ok else 'n/a'}")

    # Step 11
    r = requests.post(f"{BASE}/custom-fields", headers=H(team_tok), json={
        "label": "Team Forbidden",
        "field_type": "text",
        "applies_to": "asset",
    }, timeout=20)
    ok = r.status_code == 403
    record("11", ok, f"team POST status={r.status_code} body={r.text[:120]}")

    # Step 12
    r = requests.put(f"{BASE}/assets/{asset_uid}/custom-fields", headers=H(team_tok), json={"values": {}}, timeout=20)
    ok = r.status_code == 403
    record("12", ok, f"team PUT status={r.status_code} body={r.text[:120]}")

    # Step 13
    if compliance_field_id:
        r = requests.delete(f"{BASE}/custom-fields/{compliance_field_id}", headers=H(team_tok), timeout=20)
        ok = r.status_code == 403
        record("13", ok, f"team DELETE status={r.status_code} body={r.text[:120]}")
    else:
        record("13", False, "no compliance_field_id from step 2")

    # Step 14
    if compliance_field_id:
        r = requests.patch(f"{BASE}/custom-fields/{compliance_field_id}", headers=H(admin_tok), json={
            "label": "Compliance Due",
            "placeholder": "YYYY-MM-DD",
        }, timeout=20)
        body = r.json() if r.status_code == 200 else {}
        ok = (
            r.status_code == 200
            and body.get("label") == "Compliance Due"
            and body.get("key") == "compliance_expiry"
            and body.get("placeholder") == "YYYY-MM-DD"
        )
        record("14", ok, f"status={r.status_code} label={body.get('label')} key={body.get('key')} placeholder={body.get('placeholder')}")
    else:
        record("14", False, "no compliance_field_id")

    # Step 15
    if compliance_field_id:
        r = requests.delete(f"{BASE}/custom-fields/{compliance_field_id}", headers=H(admin_tok), timeout=20)
        ok_del = r.status_code == 200 and r.json().get("ok") is True
        r2 = requests.get(f"{BASE}/custom-fields?applies_to=asset", headers=H(admin_tok), timeout=20)
        keys = [f["key"] for f in (r2.json() if r2.status_code == 200 else [])]
        ok_list = "compliance_expiry" not in keys
        ok = ok_del and ok_list
        record("15", ok, f"del_status={r.status_code} list_after_keys={keys}")
    else:
        record("15", False, "no compliance_field_id")

    # Step 16
    r = requests.get(f"{BASE}/assets/{asset_uid}", headers=H(admin_tok), timeout=20)
    body = r.json() if r.status_code == 200 else {}
    cf = body.get("custom_fields", {})
    ok = r.status_code == 200 and cf.get("compliance_expiry") == "2027-03-01"
    record("16", ok, f"status={r.status_code} custom_fields={cf}")

    print("\n======== SUMMARY ========")
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    for s, ok, _ in results:
        print(f"  step {s}: {'PASS' if ok else 'FAIL'}")
    print(f"\n{passed}/{total} passed")
    if passed != total:
        sys.exit(1)


if __name__ == "__main__":
    main()
