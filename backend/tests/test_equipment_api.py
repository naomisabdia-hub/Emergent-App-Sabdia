"""Sabdia Equipment Management - Backend API tests"""
import os
import pytest
import requests

BASE_URL = "https://equipment-checkout-10.preview.emergentagent.com/api"

ADMIN = {"email": "naomi@sabdia.com", "password": "Admin123!"}
SUPER = {"email": "mark@sabdia.com", "password": "Super123!"}
TRADE = {"email": "johnny@sabdia.com", "password": "Trade123!"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    return data


@pytest.fixture(scope="session")
def admin_tok():
    return _login(ADMIN)["token"]


@pytest.fixture(scope="session")
def super_tok():
    return _login(SUPER)["token"]


@pytest.fixture(scope="session")
def trade_tok():
    d = _login(TRADE)
    return d["token"], d["user"]


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- Auth ----------
class TestAuth:
    def test_admin_login(self):
        d = _login(ADMIN)
        assert d["user"]["role"] == "admin"

    def test_supervisor_login(self):
        d = _login(SUPER)
        assert d["user"]["role"] == "supervisor"
        assert d["user"]["property_assignment"] == "96 Newman Avenue"

    def test_trade_login(self):
        d = _login(TRADE)
        assert d["user"]["role"] == "trade"

    def test_bad_password(self):
        r = requests.post(f"{BASE_URL}/auth/login", json={"email": ADMIN["email"], "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, admin_tok):
        r = requests.get(f"{BASE_URL}/auth/me", headers=H(admin_tok))
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_me_no_token(self):
        r = requests.get(f"{BASE_URL}/auth/me")
        assert r.status_code == 401


# ---------- Properties & Categories ----------
class TestLookups:
    def test_properties(self, trade_tok):
        tok, _ = trade_tok
        r = requests.get(f"{BASE_URL}/properties", headers=H(tok))
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 5
        names = [p["name"] for p in items]
        assert "96 Newman Avenue" in names

    def test_categories(self, trade_tok):
        tok, _ = trade_tok
        r = requests.get(f"{BASE_URL}/categories", headers=H(tok))
        assert r.status_code == 200
        assert len(r.json()) == 8


# ---------- Assets ----------
class TestAssets:
    def test_list_assets_admin(self, admin_tok):
        r = requests.get(f"{BASE_URL}/assets", headers=H(admin_tok))
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 10

    def test_trade_no_cost_fields(self, trade_tok):
        tok, _ = trade_tok
        r = requests.get(f"{BASE_URL}/assets", headers=H(tok))
        assert r.status_code == 200
        for a in r.json():
            assert "cost" not in a
            assert "insurance_value" not in a

    def test_get_single_asset(self, admin_tok):
        r = requests.get(f"{BASE_URL}/assets", headers=H(admin_tok))
        aid = r.json()[0]["id"]
        r2 = requests.get(f"{BASE_URL}/assets/{aid}", headers=H(admin_tok))
        assert r2.status_code == 200
        assert r2.json()["id"] == aid

    def test_get_missing_asset(self, admin_tok):
        r = requests.get(f"{BASE_URL}/assets/not-a-real-id", headers=H(admin_tok))
        assert r.status_code == 404


# ---------- Dashboard ----------
class TestDashboard:
    def test_admin_dashboard(self, admin_tok):
        r = requests.get(f"{BASE_URL}/dashboard/summary", headers=H(admin_tok))
        assert r.status_code == 200
        d = r.json()
        for k in ["total_assets", "available", "checked_out", "open_checkouts", "pending_bookings"]:
            assert k in d

    def test_trade_dashboard_my_open(self, trade_tok):
        tok, _ = trade_tok
        r = requests.get(f"{BASE_URL}/dashboard/summary", headers=H(tok))
        assert r.status_code == 200
        assert "my_open_checkouts" in r.json()


# ---------- Checkout / Checkin Flow ----------
class TestCheckoutFlow:
    def test_full_flow(self, trade_tok, admin_tok):
        tok, _ = trade_tok
        # find Available asset
        assets = requests.get(f"{BASE_URL}/assets", headers=H(admin_tok)).json()
        avail = next(a for a in assets if a["status"] == "Available")
        aid = avail["id"]

        # checkout
        payload = {
            "asset_id": aid,
            "property": "96 Newman Avenue",
            "expected_return_date": "2026-12-31",
            "notes": "TEST_checkout",
        }
        r = requests.post(f"{BASE_URL}/checkouts", headers=H(tok), json=payload)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "Open"

        # asset now Checked Out
        r2 = requests.get(f"{BASE_URL}/assets/{aid}", headers=H(tok))
        assert r2.json()["status"] == "Checked Out"

        # duplicate checkout → 400
        r3 = requests.post(f"{BASE_URL}/checkouts", headers=H(tok), json=payload)
        assert r3.status_code == 400

        # check-in
        ci = {"asset_id": aid, "condition": "Good", "notes": "TEST_checkin"}
        r4 = requests.post(f"{BASE_URL}/checkins", headers=H(tok), json=ci)
        assert r4.status_code == 200, r4.text

        # asset back to Available
        r5 = requests.get(f"{BASE_URL}/assets/{aid}", headers=H(tok))
        assert r5.json()["status"] == "Available"

        # second check-in with no open → 400
        r6 = requests.post(f"{BASE_URL}/checkins", headers=H(tok), json=ci)
        assert r6.status_code == 400

    def test_trade_only_sees_own_checkouts(self, trade_tok):
        tok, user = trade_tok
        r = requests.get(f"{BASE_URL}/checkouts", headers=H(tok))
        assert r.status_code == 200
        for c in r.json():
            assert c["user_id"] == user["id"]


# ---------- Bookings ----------
class TestBookings:
    def _create(self, tok, admin_tok):
        assets = requests.get(f"{BASE_URL}/assets", headers=H(admin_tok)).json()
        aid = assets[0]["id"]
        r = requests.post(f"{BASE_URL}/bookings", headers=H(tok), json={
            "asset_id": aid, "property": "96 Newman Avenue",
            "start_date": "2026-06-01", "end_date": "2026-06-02", "purpose": "TEST_bk"
        })
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "Pending"
        return r.json()["id"]

    def test_trade_cannot_approve(self, trade_tok, admin_tok):
        tok, _ = trade_tok
        bid = self._create(tok, admin_tok)
        r = requests.post(f"{BASE_URL}/bookings/{bid}/approve", headers=H(tok))
        assert r.status_code == 403

    def test_admin_approve(self, trade_tok, admin_tok):
        tok, _ = trade_tok
        bid = self._create(tok, admin_tok)
        r = requests.post(f"{BASE_URL}/bookings/{bid}/approve", headers=H(admin_tok))
        assert r.status_code == 200
        # verify
        lst = requests.get(f"{BASE_URL}/bookings", headers=H(admin_tok)).json()
        bk = next(b for b in lst if b["id"] == bid)
        assert bk["status"] == "Approved"

    def test_supervisor_reject(self, trade_tok, super_tok, admin_tok):
        tok, _ = trade_tok
        bid = self._create(tok, admin_tok)
        r = requests.post(f"{BASE_URL}/bookings/{bid}/reject", headers=H(super_tok),
                          json={"rejection_reason": "TEST_rej"})
        assert r.status_code == 200
        lst = requests.get(f"{BASE_URL}/bookings", headers=H(admin_tok)).json()
        bk = next(b for b in lst if b["id"] == bid)
        assert bk["status"] == "Rejected"


# ---------- RBAC: Audit & Users ----------
class TestRBAC:
    def test_audit_admin(self, admin_tok):
        r = requests.get(f"{BASE_URL}/audit", headers=H(admin_tok))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_audit_trade_forbidden(self, trade_tok):
        tok, _ = trade_tok
        r = requests.get(f"{BASE_URL}/audit", headers=H(tok))
        assert r.status_code == 403

    def test_users_admin(self, admin_tok):
        r = requests.get(f"{BASE_URL}/users", headers=H(admin_tok))
        assert r.status_code == 200
        assert len(r.json()) >= 3

    def test_users_trade_forbidden(self, trade_tok):
        tok, _ = trade_tok
        r = requests.get(f"{BASE_URL}/users", headers=H(tok))
        assert r.status_code == 403
