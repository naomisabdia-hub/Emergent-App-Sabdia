"""
Backend end-to-end tests for Sabdia Equipment Management.
Focus: /api/checkouts (with checkout_photo_url), /api/checkins (with condition_photo_url),
RBAC on /api/audit.
"""
import json
import sys
import requests

BASE = "http://localhost:8001/api"
TRADE = {"email": "johnny@sabdia.com", "password": "Trade123!"}
ADMIN = {"email": "naomi@sabdia.com", "password": "Admin123!"}
PNG_1PX_B64 = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)

results = []


def log(name, ok, detail=""):
    results.append({"name": name, "ok": ok, "detail": detail})
    flag = "PASS" if ok else "FAIL"
    print(f"[{flag}] {name} :: {detail[:400]}")


def login(creds):
    r = requests.post(f"{BASE}/auth/login", json=creds, timeout=15)
    return r


def h(token):
    return {"Authorization": f"Bearer {token}"}


def main():
    # 1. LOGIN (Trade)
    r = login(TRADE)
    if r.status_code != 200:
        log("Trade login", False, f"HTTP {r.status_code} body={r.text}")
        sys.exit(1)
    trade_body = r.json()
    trade_token = trade_body.get("token")
    log("Trade login", bool(trade_token), f"user={trade_body.get('user',{}).get('email')}")

    # 2a. Pick available asset
    r = requests.get(f"{BASE}/assets", params={"status_filter": "Available"}, headers=h(trade_token), timeout=15)
    if r.status_code != 200 or not r.json():
        log("GET /assets?status_filter=Available", False, f"HTTP {r.status_code} body={r.text[:300]}")
        sys.exit(1)
    asset = r.json()[0]
    asset_uid = asset["id"]
    log("GET /assets?status_filter=Available", True, f"picked asset id={asset_uid} name={asset.get('name')}")

    # 2b. Pick property
    r = requests.get(f"{BASE}/properties", headers=h(trade_token), timeout=15)
    if r.status_code != 200 or not r.json():
        log("GET /properties", False, f"HTTP {r.status_code} body={r.text[:300]}")
        sys.exit(1)
    prop_name = r.json()[0]["name"]
    log("GET /properties", True, f"picked property={prop_name}")

    # 2c. POST /checkouts with photo
    checkout_payload = {
        "asset_id": asset_uid,
        "property": prop_name,
        "expected_return_date": "2026-05-15",
        "notes": "Test checkout",
        "checkout_photo_url": PNG_1PX_B64,
    }
    r = requests.post(f"{BASE}/checkouts", json=checkout_payload, headers=h(trade_token), timeout=15)
    checkout_ok = 200 <= r.status_code < 300
    log("POST /checkouts (2xx)", checkout_ok, f"HTTP {r.status_code} body={r.text[:500]}")
    if not checkout_ok:
        sys.exit(1)
    co_body = r.json()

    # Verify checkout_photo_url stored in response
    stored_photo = co_body.get("checkout_photo_url")
    log(
        "POST /checkouts response contains checkout_photo_url",
        bool(stored_photo),
        f"checkout_photo_url present={bool(stored_photo)} (len={len(stored_photo) if stored_photo else 0})",
    )

    # 2d. GET /assets/{id} → Checked Out
    r = requests.get(f"{BASE}/assets/{asset_uid}", headers=h(trade_token), timeout=15)
    asset_after_co = r.json() if r.status_code == 200 else {}
    log(
        "Asset status after checkout == 'Checked Out'",
        asset_after_co.get("status") == "Checked Out",
        f"status={asset_after_co.get('status')}",
    )

    # 3. POST /checkins with damage + photo
    ci_payload = {
        "asset_id": asset_uid,
        "condition": "Minor Damage",
        "notes": "Scratch on side",
        "condition_photo_url": PNG_1PX_B64,
    }
    r = requests.post(f"{BASE}/checkins", json=ci_payload, headers=h(trade_token), timeout=15)
    ci_ok = 200 <= r.status_code < 300
    log("POST /checkins (Minor Damage + photo) (2xx)", ci_ok, f"HTTP {r.status_code} body={r.text[:500]}")

    if ci_ok:
        ci_body = r.json()
        stored_cond_photo = ci_body.get("condition_photo_url")
        log(
            "POST /checkins response contains condition_photo_url",
            bool(stored_cond_photo),
            f"condition_photo_url present={bool(stored_cond_photo)} (len={len(stored_cond_photo) if stored_cond_photo else 0})",
        )

        r = requests.get(f"{BASE}/assets/{asset_uid}", headers=h(trade_token), timeout=15)
        asset_after_ci = r.json() if r.status_code == 200 else {}
        st = asset_after_ci.get("status")
        log(
            "Asset status after Minor Damage checkin (Available or Damaged)",
            st in ("Available", "Damaged", "Maintenance"),
            f"status={st}",
        )
    else:
        # Cleanup attempt: check asset status anyway
        r2 = requests.get(f"{BASE}/assets/{asset_uid}", headers=h(trade_token), timeout=15)
        log("Asset status after failed checkin (diagnostic)", True, f"status={r2.json().get('status') if r2.status_code==200 else r2.text[:200]}")

    # 4. Plain check-in with condition "Good" (requires a fresh checkout)
    # Need to first re-checkout the asset if it's Available (only if prior checkin succeeded).
    r = requests.get(f"{BASE}/assets/{asset_uid}", headers=h(trade_token), timeout=15)
    cur_status = r.json().get("status") if r.status_code == 200 else None
    if cur_status == "Available":
        # Re-checkout
        r = requests.post(
            f"{BASE}/checkouts",
            json={
                "asset_id": asset_uid,
                "property": prop_name,
                "expected_return_date": "2026-06-15",
                "notes": "Second checkout for Good-condition check-in",
            },
            headers=h(trade_token),
            timeout=15,
        )
        if 200 <= r.status_code < 300:
            # Now plain check-in, condition=Good, no photo
            r = requests.post(
                f"{BASE}/checkins",
                json={"asset_id": asset_uid, "condition": "Good", "notes": "All good"},
                headers=h(trade_token),
                timeout=15,
            )
            ok = 200 <= r.status_code < 300
            log("POST /checkins (Good, no photo) (2xx)", ok, f"HTTP {r.status_code} body={r.text[:300]}")
            if ok:
                r = requests.get(f"{BASE}/assets/{asset_uid}", headers=h(trade_token), timeout=15)
                st = r.json().get("status") if r.status_code == 200 else None
                log("Asset returns to 'Available' after Good checkin", st == "Available", f"status={st}")
        else:
            log("Re-checkout for Good-condition test", False, f"HTTP {r.status_code} body={r.text[:300]}")
    else:
        log(
            "Skipping Good-condition checkin (asset not Available)",
            False,
            f"current status={cur_status} — previous checkin likely failed, cannot set up Good-condition test",
        )

    # 5. RBAC: Admin can GET /audit; Trade cannot
    r = login(ADMIN)
    if r.status_code != 200:
        log("Admin login", False, f"HTTP {r.status_code} body={r.text[:300]}")
    else:
        admin_token = r.json()["token"]
        log("Admin login", True, f"user={r.json()['user']['email']}")
        r = requests.get(f"{BASE}/audit", headers=h(admin_token), timeout=15)
        log("Admin GET /audit == 200", r.status_code == 200, f"HTTP {r.status_code}")
        r = requests.get(f"{BASE}/audit", headers=h(trade_token), timeout=15)
        log("Trade GET /audit == 403", r.status_code == 403, f"HTTP {r.status_code} body={r.text[:200]}")

    # Summary
    print("\n" + "=" * 60)
    passed = sum(1 for r in results if r["ok"])
    total = len(results)
    print(f"RESULT: {passed}/{total} passed")
    print("=" * 60)
    for r in results:
        print(f"  [{'OK' if r['ok'] else 'FAIL'}] {r['name']}")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
