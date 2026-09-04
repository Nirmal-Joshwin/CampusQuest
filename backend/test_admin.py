import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.models import User
from app.routers.admin import require_admin

# Mock admin dependency for unit testing
mock_admin = User(
    id="test-admin-id",
    email="admin@cit.edu.in",
    username="CIT SuperAdmin",
    role="ADMIN",
    department="CSE"
)

app.dependency_overrides[require_admin] = lambda: mock_admin
client = TestClient(app)

def test_admin():
    # 1. Overview
    res = client.get("/api/admin/overview")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    data = res.json()
    assert data["admin_username"] == "CIT SuperAdmin"
    assert "total_cadets" in data
    print(f"[PASS] /api/admin/overview returned: {data}")

if __name__ == "__main__":
    try:
        test_admin()
        print("[ALL ADMIN TESTS PASSED]")
    except Exception as e:
        print(f"[TEST FAILED] {e}")
        sys.exit(1)

