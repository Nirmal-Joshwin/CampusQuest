import sys
import os
import uuid
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.config import settings
from app.geofence import is_coordinate_within_cit_bounds, CIT_CANONICAL_STORY_SPAWNS
from app.routers.gameplay import CANONICAL_CAMPUS_LOOT

client = TestClient(app)

def test_security_hardening():
    print("--- 1. Testing Config & Environment Hardening ---")
    assert settings.JWT_SECRET_KEY, "JWT_SECRET_KEY should not be empty"
    assert len(settings.JWT_SECRET_KEY) >= 16, "JWT_SECRET_KEY should be sufficiently long"
    assert isinstance(settings.ALLOWED_ORIGINS, str) and len(settings.ALLOWED_ORIGINS) > 0
    print(f"[PASS] Settings secure: JWT secret configured, CORS raw origins: {settings.ALLOWED_ORIGINS}")

    print("\n--- 2. Testing Authentication & JWT Rejection (401) ---")
    # Missing Auth
    res_no_auth = client.get("/api/auth/me")
    assert res_no_auth.status_code == 401, f"Expected 401 for unauthenticated request, got {res_no_auth.status_code}"
    
    # Fake / Tampered JWT
    res_bad_token = client.get("/api/auth/me", headers={"Authorization": "Bearer fake.tampered.token"})
    assert res_bad_token.status_code == 401, f"Expected 401 for tampered JWT, got {res_bad_token.status_code}"
    print("[PASS] Unauthenticated and tampered JWT requests correctly rejected with 401")

    print("\n--- 3. Testing Input Sanitization & Regex Validation (422) ---")
    xss_payloads = [
        "<script>alert(1)</script>",
        "user<tag>",
        "user name with spaces",
        "drop table users;--",
        "cadet@!#$%",
    ]
    for bad_name in xss_payloads:
        res = client.post("/api/auth/register", json={
            "email": f"hacker_{uuid.uuid4().hex[:6]}@cit.edu.in",
            "username": bad_name,
            "password": "Password123!",
            "department": "CSE"
        })
        assert res.status_code == 422, f"Expected 422 for invalid username '{bad_name}', got {res.status_code}"
    print("[PASS] Malicious/invalid username payloads rejected with 422 Unprocessable Entity")

    # Valid user registration
    test_id = uuid.uuid4().hex[:6]
    valid_username = f"cadet_{test_id}"
    res_reg = client.post("/api/auth/register", json={
        "email": f"{valid_username}@cit.edu.in",
        "username": valid_username,
        "password": "Password123!",
        "role": "STUDENT",
        "department": "CSE"
    })
    assert res_reg.status_code == 201, f"Expected 201 for valid user, got {res_reg.status_code}: {res_reg.text}"
    user_token = res_reg.json()["access_token"]
    student_headers = {"Authorization": f"Bearer {user_token}"}
    print(f"[PASS] Sanitized username '{valid_username}' registered successfully")

    print("\n--- 4. Testing Role-Based Access Control / RBAC (403) ---")
    res_admin_forbidden = client.get("/api/admin/overview", headers=student_headers)
    assert res_admin_forbidden.status_code == 403, f"Expected 403 Forbidden for student accessing admin route, got {res_admin_forbidden.status_code}"
    print("[PASS] Student role rejected from Admin endpoint with 403 Forbidden")

    print("\n--- 5. Testing Anti-Spoofing GPS Coordinates in Catch API ---")
    # 5a. Out of city bounding box (should fail schema validation 422)
    res_out_city = client.post("/api/gameplay/catch", json={
        "creature_name": "ByteFalcon",
        "rarity": "COMMON",
        "latitude": 12.9716, # Bangalore
        "longitude": 77.5946
    }, headers=student_headers)
    assert res_out_city.status_code == 422, f"Expected 422 for out-of-city coordinate, got {res_out_city.status_code}"
    print("[PASS] Out-of-city coordinate rejected at schema level with 422")

    # 5b. In city bounds but outside CIT campus perimeter polygon (fails with 400 geofence rejection)
    res_outside_cit = client.post("/api/gameplay/catch", json={
        "creature_name": "ByteFalcon",
        "rarity": "COMMON",
        "latitude": 11.0150, # Outside CIT perimeter
        "longitude": 77.0150
    }, headers=student_headers)
    assert res_outside_cit.status_code == 400, f"Expected 400 for outside-campus coordinate, got {res_outside_cit.status_code}"
    assert "perimeter" in res_outside_cit.json()["detail"].lower() or "rejected" in res_outside_cit.json()["detail"].lower()
    print(f"[PASS] Outside CIT campus coordinate rejected with 400: '{res_outside_cit.json()['detail']}'")

    # 5c. Valid coordinate inside CIT campus quad (passes geofence)
    res_valid_cit = client.post("/api/gameplay/catch", json={
        "creature_name": "ByteFalcon",
        "rarity": "COMMON",
        "latitude": 11.0280,
        "longitude": 77.0275
    }, headers=student_headers)
    assert res_valid_cit.status_code == 200, f"Expected 200 for inside-campus coordinate, got {res_valid_cit.status_code}: {res_valid_cit.text}"
    assert res_valid_cit.json()["success"] is True
    print(f"[PASS] Inside CIT campus capture succeeded: {res_valid_cit.json()['message']}")

    print("\n--- 6. Testing Campus Boundary & Spatial Containment ---")
    # Check all 10 canonical story spawns
    for spawn in CIT_CANONICAL_STORY_SPAWNS:
        inside = is_coordinate_within_cit_bounds(spawn["latitude"], spawn["longitude"])
        assert inside, f"Spawn '{spawn['name']}' at ({spawn['latitude']}, {spawn['longitude']}) is outside CIT boundary!"
    print(f"[PASS] All {len(CIT_CANONICAL_STORY_SPAWNS)} canonical story spawns are verified 100% inside CIT polygon")

    # Check all loot crates
    for loot in CANONICAL_CAMPUS_LOOT:
        inside = is_coordinate_within_cit_bounds(loot["latitude"], loot["longitude"])
        assert inside, f"Loot '{loot['name']}' at ({loot['latitude']}, {loot['longitude']}) is outside CIT boundary!"
    print(f"[PASS] All {len(CANONICAL_CAMPUS_LOOT)} campus loot crates are verified 100% inside CIT polygon")

    print("\n==========================================")
    print("ALL SECURITY HARDENING & AUDIT TESTS PASSED!")
    print("==========================================")

if __name__ == "__main__":
    test_security_hardening()
