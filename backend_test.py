"""
Backend smoke tests for Sabdia Equipment Management API.
Focus: analytics endpoints + reseed with pre-existing checkouts.
"""
import os
import sys
import requests

BASE = os.environ.get("BACKEND_BASE") or "https://equipment-checkout-10.preview.emergentagent.com"
API = f"{BASE}/api"

ADMIN = {"email": "naomi@sabdia.com", "password": "Admin123!"}
TEAM = {"email": "johnny@sabdia.com", "password": "Team123!"}

results = []


def log(name, ok, details=""):
    mark = "PASS" if ok else "FAIL"
    line = f"[{mark}] {name}" + (f" — {details}" if details else "")
    print(line)
    results.append((name, ok, details))


def login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    r.raise_for_status()
    return r.json()["token"]


def hdr(t):
    return {"Authorization": f"Bearer {t}"}


def main():
    admin_tok = login(ADMIN)
    team_tok = login(TEAM)
    log("Admin login", True)
    log("Team login", True)

    # 1. Reseed
    r = requests.post(f"{API}/admin/reseed-assets", headers=hdr(admin_tok), timeout=60)
    ok = r.status_code == 200 and r.json().get("inserted") == 81
    log("POST /admin/reseed-assets → 200 inserted=81", ok,
        f"status={r.status_code} body={r.json() if r.ok else r.text}")

    # Dashboard summary
    r = requests.get(f"{API}/dashboard/summary", headers=hdr(admin_tok), timeout=30)
    body = r.json()
    ok = (r.status_code == 200 and body.get("total_assets") == 81
          and body.get("checked_out") == 23 and body.get("available") == 58)
    log("GET /dashboard/summary totals", ok,
        f"total={body.get('total_assets')} out={body.get('checked_out')} avail={body.get('available')}")

    # Open checkouts list
    r = requests.get(f"{API}/checkouts?open_only=true", headers=hdr(admin_tok), timeout=30)
    cos = r.json()
    log("GET /checkouts?open_only=true returns 23", r.status_code == 200 and len(cos) == 23,
        f"len={len(cos)}")

    # Holder counts
    from collections import Counter
    holder_counts = Counter([c.get("user_name") for c in cos])
    expected = {"Naomi Durcau": 12, "Johnny Fainges": 5, "Tallisha Emes": 5, "Steve Palmer": 1}
    for name, cnt in expected.items():
        got = holder_counts.get(name, 0)
        log(f"Holder count: {name}={cnt}", got == cnt, f"got={got}")

    # 2. Dashboard analytics as admin
    r = requests.get(f"{API}/dashboard/analytics", headers=hdr(admin_tok), timeout=30)
    ok = r.status_code == 200
    body = r.json() if ok else {}
    log("GET /dashboard/analytics admin → 200", ok, f"status={r.status_code}")
    if ok:
        for key in ("by_holder", "by_location", "by_category"):
            log(f"analytics.{key} is list", isinstance(body.get(key), list))
        log("analytics.total_open == 23", body.get("total_open") == 23,
            f"got={body.get('total_open')}")
        naomi = next((h for h in body.get("by_holder", []) if h.get("name") == "Naomi Durcau"), None)
        log("by_holder includes Naomi Durcau count=12", naomi is not None and naomi.get("count") == 12,
            f"entry={naomi}")

    # 3. Dashboard analytics as team
    r = requests.get(f"{API}/dashboard/analytics", headers=hdr(team_tok), timeout=30)
    log("GET /dashboard/analytics team → 403", r.status_code == 403, f"status={r.status_code}")

    # 4. equipment-to-return admin → 23 items
    r = requests.get(f"{API}/dashboard/equipment-to-return", headers=hdr(admin_tok), timeout=30)
    ok = r.status_code == 200
    items = r.json() if ok else []
    log("GET /dashboard/equipment-to-return admin → 200 with 23 items",
        ok and len(items) == 23, f"status={r.status_code} len={len(items)}")
    if ok and items:
        sample = items[0]
        needed = ["asset_id", "asset_name", "user_name", "is_overdue", "is_due_today", "is_due_soon", "asset"]
        missing = [k for k in needed if k not in sample]
        log("equipment-to-return item fields present", not missing, f"missing={missing}")
        a = sample.get("asset") or {}
        log("asset sub-object has name+category", "name" in a and "category" in a,
            f"asset={a}")

    # 5. equipment-to-return as Johnny → exactly 5
    r = requests.get(f"{API}/dashboard/equipment-to-return", headers=hdr(team_tok), timeout=30)
    ok = r.status_code == 200
    items = r.json() if ok else []
    log("GET /dashboard/equipment-to-return johnny → 200 with 5 items",
        ok and len(items) == 5, f"status={r.status_code} len={len(items)}")
    if ok and items:
        all_johnny = all(i.get("user_name") == "Johnny Fainges" for i in items)
        log("All Johnny items have user_name == Johnny Fainges", all_johnny,
            f"unique={set(i.get('user_name') for i in items)}")

    # 6. Asset listing: ACCE-001
    r = requests.get(f"{API}/assets", headers=hdr(admin_tok), timeout=30)
    ok = r.status_code == 200
    assets = r.json() if ok else []
    acce = next((a for a in assets if a.get("asset_id") == "ACCE-001"), None)
    log("ACCE-001 exists", acce is not None)
    if acce:
        log("ACCE-001 name contains 'Platform Ladder Bailey'",
            "Platform Ladder Bailey" in (acce.get("name") or ""),
            f"name={acce.get('name')}")
        log("ACCE-001 current_holder == Naomi Durcau",
            acce.get("current_holder") == "Naomi Durcau",
            f"holder={acce.get('current_holder')}")
        log("ACCE-001 status == 'Checked Out'",
            acce.get("status") == "Checked Out",
            f"status={acce.get('status')}")

    # summary
    total = len(results)
    fails = [r for r in results if not r[1]]
    print("\n----")
    print(f"Ran {total} checks, {len(fails)} failed.")
    for n, _, d in fails:
        print(f"  FAIL: {n} — {d}")
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
