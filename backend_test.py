"""
Sabdia Equipment Management — Backend test suite for role refactor (admin + team).
Tests cover:
  1) Auth & role migration
  2) Asset listing enrichment + 81-asset re-seed
  3) Checkout / Check-in restriction (team owner / admin override)
  4) User management (invite, edit, deactivate, reactivate, reset-password)
  5) Permission negative tests
  6) Reseed admin endpoint
"""
import os
import sys
import uuid
import json
import requests

BASE = os.environ.get("BACKEND_URL", "https://equipment-checkout-10.preview.emergentagent.com").rstrip("/") + "/api"

ADMIN = {"email": "naomi@sabdia.com", "password": "Admin123!"}
TEAM = {"email": "johnny@sabdia.com", "password": "Team123!"}

results = []  # list of (section, name, ok, detail)


def record(section, name, ok, detail=""):
    results.append((section, name, ok, detail))
    flag = "PASS" if ok else "FAIL"
    print(f"[{flag}] {section} :: {name} :: {detail}")


def post(path, data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.post(BASE + path, headers=headers, data=json.dumps(data or {}), timeout=20)


def get(path, token=None, params=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.get(BASE + path, headers=headers, params=params, timeout=20)


def patch(path, data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.patch(BASE + path, headers=headers, data=json.dumps(data or {}), timeout=20)


def login(email, password):
    return post("/auth/login", {"email": email, "password": password})


# 1) AUTH & ROLE MIGRATION
def section_auth():
    s = "1. Auth & Role Migration"
    r = login(**ADMIN)
    ok = r.status_code == 200 and r.json().get("user", {}).get("role") == "admin"
    record(s, "Admin naomi login → 200, role=admin", ok,
           f"status={r.status_code} role={r.json().get('user', {}).get('role') if r.ok else 'n/a'}")
    admin_token = r.json()["token"] if r.ok else None

    r = login(**TEAM)
    ok = r.status_code == 200 and r.json().get("user", {}).get("role") == "team"
    record(s, "Team johnny login → 200, role=team", ok,
           f"status={r.status_code} role={r.json().get('user', {}).get('role') if r.ok else 'n/a'}")
    team_token = r.json()["token"] if r.ok else None

    if admin_token:
        ru = get("/users", token=admin_token)
        if ru.status_code == 200:
            users = ru.json()
            mark = next((u for u in users if u["email"] == "mark@sabdia.com"), None)
            if mark is None:
                record(s, "Old mark@sabdia.com migrated to role=team", True,
                       "Mark not present (acceptable — no legacy supervisor row to migrate).")
            else:
                ok = mark.get("role") == "team"
                record(s, "Old mark@sabdia.com migrated to role=team", ok, f"role={mark.get('role')}")
        else:
            record(s, "GET /users (admin)", False, f"status={ru.status_code}")

    return admin_token, team_token


# 2) ASSET LISTING ENRICHMENT
def section_assets(admin_token):
    s = "2. Asset Listing Enrichment"
    r = get("/assets", token=admin_token)
    if r.status_code != 200:
        record(s, "GET /assets as admin", False, f"status={r.status_code}")
        return None
    assets = r.json()
    record(s, "GET /assets as admin → 200", True, f"count={len(assets)}")
    record(s, "Asset count == 81 (re-seeded)", len(assets) == 81, f"got={len(assets)}")

    required = {"id", "asset_id", "name", "category", "status", "location", "current_holder"}
    missing = []
    for a in assets:
        miss = required - a.keys()
        if miss:
            missing.append((a.get("asset_id"), list(miss)))
    record(s, "Each asset has required fields incl. current_holder", not missing,
           f"missing_examples={missing[:3]}" if missing else f"all {len(assets)} ok")

    avail_sample = next((a for a in assets if a.get("status") == "Available"), None)
    if avail_sample:
        record(s, "Available asset has current_holder=None",
               avail_sample["current_holder"] is None,
               f"asset_id={avail_sample['asset_id']} current_holder={avail_sample['current_holder']}")

    return assets


# 3) CHECKOUT / CHECK-IN RESTRICTION
def section_checkout_restriction(admin_token, team_token, assets):
    s = "3. Checkout/Check-in Restriction"
    target = next((a for a in assets if a["asset_id"] == "ACCE-001"), None)
    if not target or target["status"] != "Available":
        target = next((a for a in assets if a["status"] == "Available"), None)
    if not target:
        record(s, "Find Available asset", False, "")
        return
    asset_uid = target["id"]
    record(s, f"Selected asset {target['asset_id']}", True, f"uid={asset_uid}")

    r = post("/checkouts", {
        "asset_id": asset_uid,
        "property": "Warehouse",
        "expected_return_date": "2026-12-31",
        "notes": "test backend",
    }, token=team_token)
    record(s, f"Johnny POST /checkouts {target['asset_id']} → 200",
           r.status_code == 200, f"status={r.status_code} body={r.text[:120]}")
    if r.status_code != 200:
        return

    rd = get(f"/assets/{asset_uid}", token=admin_token)
    if rd.status_code == 200:
        a = rd.json()
        ok = (a.get("status") == "Checked Out"
              and a.get("current_holder")
              and a.get("expected_return_date")
              and a.get("checked_out_at"))
        record(s, "Asset enriched after checkout (status/current_holder/expected_return_date/checked_out_at)",
               bool(ok),
               f"status={a.get('status')} holder={a.get('current_holder')} ret={a.get('expected_return_date')} at={a.get('checked_out_at')}")

    # Intruder team user
    new_email = f"intruder_{uuid.uuid4().hex[:6]}@sabdia.com"
    inv = post("/users", {"email": new_email, "full_name": "Intruder Test", "role": "team"}, token=admin_token)
    if inv.status_code != 200:
        record(s, "Create intruder team user", False, f"status={inv.status_code}")
        return
    intruder = inv.json()
    li = login(new_email, intruder["initial_password"])
    intruder_token = li.json()["token"] if li.ok else None
    record(s, "Intruder login", li.ok, f"status={li.status_code}")

    rci = post("/checkins", {"asset_id": asset_uid, "condition": "Good"}, token=intruder_token)
    msg = ""
    try:
        msg = rci.json().get("detail", "")
    except Exception:
        pass
    ok = rci.status_code == 403 and ("Johnny" in msg or "Admin" in msg)
    record(s, "Intruder check-in → 403 mentioning Johnny/Admin",
           ok, f"status={rci.status_code} detail={msg}")

    rci2 = post("/checkins", {"asset_id": asset_uid, "condition": "Good"}, token=admin_token)
    record(s, "Admin override check-in → 200",
           rci2.status_code == 200, f"status={rci2.status_code} body={rci2.text[:120]}")
    rd2 = get(f"/assets/{asset_uid}", token=admin_token)
    if rd2.ok:
        record(s, "Asset → Available after admin check-in",
               rd2.json().get("status") == "Available", f"status={rd2.json().get('status')}")

    # Johnny self check-in path
    rA = get("/assets", token=admin_token)
    next_target = None
    if rA.ok:
        next_target = next((a for a in rA.json() if a["status"] == "Available" and a["id"] != asset_uid), None)
    if not next_target:
        record(s, "Find another Available asset", False, "")
        return
    rco = post("/checkouts", {
        "asset_id": next_target["id"],
        "property": "On Site",
        "expected_return_date": "2026-12-31",
    }, token=team_token)
    record(s, f"Johnny checkout {next_target['asset_id']} → 200",
           rco.status_code == 200, f"status={rco.status_code}")
    rci3 = post("/checkins", {"asset_id": next_target["id"], "condition": "Good"}, token=team_token)
    record(s, "Johnny self check-in → 200",
           rci3.status_code == 200, f"status={rci3.status_code} body={rci3.text[:120]}")

    post(f"/users/{intruder['id']}/deactivate", token=admin_token)


# 4) USER MANAGEMENT
def section_user_mgmt(admin_token):
    s = "4. User Management (Admin)"
    sam_email = f"sam_{uuid.uuid4().hex[:6]}@sabdia.com"

    r = post("/users", {"email": sam_email, "full_name": "Sam Test", "role": "team"}, token=admin_token)
    ok = r.status_code == 200 and r.json().get("initial_password")
    record(s, "POST /users invite Sam → 200 with initial_password",
           ok, f"status={r.status_code}")
    if not ok:
        return
    sam = r.json()
    sam_id = sam["id"]
    init_pw = sam["initial_password"]

    li = login(sam_email, init_pw)
    record(s, "Sam login w/ initial password → 200", li.status_code == 200, f"status={li.status_code}")

    rp = patch(f"/users/{sam_id}", {"role": "admin"}, token=admin_token)
    ok = rp.status_code == 200 and rp.json().get("role") == "admin"
    record(s, "PATCH /users/{sam} role=admin → 200",
           ok, f"status={rp.status_code} role={rp.json().get('role') if rp.ok else 'n/a'}")

    rd = post(f"/users/{sam_id}/deactivate", token=admin_token)
    record(s, "POST /users/{sam}/deactivate → 200",
           rd.status_code == 200 and rd.json().get("ok"), f"status={rd.status_code}")

    li2 = login(sam_email, init_pw)
    msg = ""
    try:
        msg = li2.json().get("detail", "")
    except Exception:
        pass
    ok = li2.status_code == 403 and "deactivated" in msg.lower()
    record(s, "Login deactivated Sam → 403 'deactivated'",
           ok, f"status={li2.status_code} detail={msg}")

    rr = post(f"/users/{sam_id}/reactivate", token=admin_token)
    record(s, "POST /users/{sam}/reactivate → 200", rr.status_code == 200, f"status={rr.status_code}")

    rrp = post(f"/users/{sam_id}/reset-password", token=admin_token)
    ok = rrp.status_code == 200 and rrp.json().get("new_password")
    record(s, "POST /users/{sam}/reset-password → 200 with new_password",
           ok, f"status={rrp.status_code}")
    if ok:
        new_pw = rrp.json()["new_password"]
        li3 = login(sam_email, new_pw)
        record(s, "Sam login w/ new_password → 200",
               li3.status_code == 200, f"status={li3.status_code}")

    post(f"/users/{sam_id}/deactivate", token=admin_token)


# 5) PERMISSION NEGATIVE
def section_negatives(team_token):
    s = "5. Permission Negative Tests"
    r = get("/users", token=team_token)
    record(s, "Team GET /users → 403", r.status_code == 403, f"status={r.status_code}")
    r = post("/users", {"email": "x@y.com", "full_name": "X", "role": "team"}, token=team_token)
    record(s, "Team POST /users → 403", r.status_code == 403, f"status={r.status_code}")
    r = post("/admin/reseed-assets", token=team_token)
    record(s, "Team POST /admin/reseed-assets → 403", r.status_code == 403, f"status={r.status_code}")


# 6) RESEED
def section_reseed(admin_token):
    s = "6. Reseed"
    r = post("/admin/reseed-assets", token=admin_token)
    if r.status_code != 200:
        record(s, "Admin POST /admin/reseed-assets → 200", False,
               f"status={r.status_code} body={r.text[:120]}")
        return
    body = r.json()
    ok = body.get("ok") is True and body.get("inserted") == 81
    record(s, "Reseed returns ok=true and inserted=81", ok, f"body={body}")


def main():
    print(f"Testing against: {BASE}\n")
    admin_token, team_token = section_auth()
    if not admin_token or not team_token:
        print("\n!! Cannot proceed — auth failed.")
        sys.exit(1)

    # clean baseline
    rs = post("/admin/reseed-assets", token=admin_token)
    print(f"\n[setup] reseed status={rs.status_code} body={rs.text[:120]}\n")

    assets = section_assets(admin_token)
    if assets:
        section_checkout_restriction(admin_token, team_token, assets)
    section_user_mgmt(admin_token)
    section_negatives(team_token)
    section_reseed(admin_token)

    print("\n" + "=" * 70)
    print("SUMMARY BY SECTION")
    print("=" * 70)
    by_section = {}
    for row in results:
        sec = row[0]
        ok = row[2]
        by_section.setdefault(sec, [0, 0])
        by_section[sec][0] += int(bool(ok))
        by_section[sec][1] += 1
    for sec, (p, t) in by_section.items():
        print(f"  {sec}: {p}/{t} passed")
    total_p = sum(p for p, _ in by_section.values())
    total_t = sum(t for _, t in by_section.values())
    print(f"\nTOTAL: {total_p}/{total_t} passed")

    fails = [(s, n, d) for s, n, ok, d in results if not ok]
    if fails:
        print("\nFAILURES:")
        for s, n, d in fails:
            print(f"  - [{s}] {n} :: {d}")
        sys.exit(1)


if __name__ == "__main__":
    main()
