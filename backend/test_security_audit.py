"""
CampusQuest Security & Defensive Hardening Verification Test Suite
Tests authentication privilege escalation, IDOR, game economy rate limiting,
tampering resistance, and secrets validation.
"""
import os
import sys
import uuid

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.config import settings, Settings, DEFAULT_INSECURE_SECRET
from app.database import Base, engine, SessionLocal
from app.models import User, Friendship

# Initialize test client
client = TestClient(app)

def run_tests():
    print("=" * 60)
    print("RUNNING CAMPUSQUEST DEFENSIVE SECURITY TEST SUITE")
    print("=" * 60)
    passed = 0
    total = 0

    run_id = uuid.uuid4().hex[:6]

    def assert_test(name, condition, details=""):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f"  [PASS] {name}")
        else:
            print(f"  [FAIL] {name}: {details}")

    # --- 1. Production Secrets Validation ---
    print("\n--- 1. Configuration & Secret Validation ---")
    try:
        bad_settings = Settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY=DEFAULT_INSECURE_SECRET
        )
        bad_settings.validate_security()
        assert_test("Production mode rejects default secret key", False, "Failed to raise ValueError")
    except ValueError as e:
        assert_test("Production mode rejects default secret key", "CRITICAL SECURITY ERROR" in str(e))

    # --- 2. Auth: Privilege Escalation Mitigation ---
    print("\n--- 2. Authentication & Privilege Escalation ---")
    # A. Register ADMIN without code
    res = client.post("/api/auth/register", json={
        "email": f"hacker1_{run_id}@cit.edu.in",
        "username": f"Hacker1_{run_id}",
        "password": "Password123!",
        "role": "ADMIN",
        "department": "CSE"
    })
    assert_test("Registration with role=ADMIN without code returns 403", res.status_code == 403)

    # B. Register ADMIN with incorrect code
    res = client.post("/api/auth/register", json={
        "email": f"hacker2_{run_id}@cit.edu.in",
        "username": f"Hacker2_{run_id}",
        "password": "Password123!",
        "role": "ADMIN",
        "admin_code": "WRONG_SECRET",
        "department": "CSE"
    })
    assert_test("Registration with role=ADMIN with wrong code returns 403", res.status_code == 403)

    # C. Register ADMIN with valid admin clearance code
    res = client.post("/api/auth/register", json={
        "email": f"admin_{run_id}@cit.edu.in",
        "username": f"Admin_{run_id}",
        "password": "AdminPassword123!",
        "role": "ADMIN",
        "admin_code": settings.ADMIN_REGISTRATION_KEY,
        "department": "CSE"
    })
    assert_test("Registration with role=ADMIN with valid admin_code succeeds", res.status_code == 201)
    admin_token = res.json().get("access_token") if res.status_code == 201 else None

    # D. Register regular student 1
    res = client.post("/api/auth/register", json={
        "email": f"student1_{run_id}@cit.edu.in",
        "username": f"Cadet1_{run_id}",
        "password": "StudentPassword123!",
        "role": "STUDENT",
        "department": "ECE"
    })
    assert_test("Regular student registration succeeds (201)", res.status_code == 201)
    student1_token = res.json().get("access_token")
    student1_id = res.json().get("user", {}).get("id")

    # Register regular student 2
    res2 = client.post("/api/auth/register", json={
        "email": f"student2_{run_id}@cit.edu.in",
        "username": f"Cadet2_{run_id}",
        "password": "StudentPassword123!",
        "role": "STUDENT",
        "department": "MECH"
    })
    student2_token = res2.json().get("access_token")
    student2_id = res2.json().get("user", {}).get("id")

    # E. Password constraint check (< 8 chars)
    res_weak = client.post("/api/auth/register", json={
        "email": f"weak_{run_id}@cit.edu.in",
        "username": f"Weak_{run_id}",
        "password": "12345",
        "role": "STUDENT"
    })
    assert_test("Weak password (<8 chars) is rejected with 422", res_weak.status_code == 422)

    # --- 3. Access Control (IDOR) ---
    print("\n--- 3. Insecure Direct Object Reference (IDOR) Checks ---")
    db = SessionLocal()
    victim_f_id = f"f-victim-{run_id}"
    unrelated_f = Friendship(
        id=victim_f_id,
        user_id=f"victim1_{run_id}",
        friend_id=f"victim2_{run_id}",
        status="ACCEPTED"
    )
    db.add(unrelated_f)
    db.commit()
    db.close()

    # Student 1 attempts to delete Victim's friendship by ID
    del_res = client.delete(
        f"/api/friends/{victim_f_id}",
        headers={"Authorization": f"Bearer {student1_token}"}
    )
    assert_test("Unauthorized deletion of another user's friendship returns 403", del_res.status_code == 403)

    # --- 4. Multiplayer Raid Security ---
    print("\n--- 4. Multiplayer Raid Protection ---")
    # Create raid as student1
    raid_create_res = client.post(
        "/api/multiplayer/raid/create",
        json={"boss_name": "CIT CyberDragon", "campus_sector": "Tower"},
        headers={"Authorization": f"Bearer {student1_token}"}
    )
    raid_id = raid_create_res.json()["raid"]["raid_id"]

    # Student 2 (not yet joined) attempts to complete raid
    unauth_complete = client.post(
        f"/api/multiplayer/raid/{raid_id}/complete",
        headers={"Authorization": f"Bearer {student2_token}"}
    )
    assert_test("Non-teammate completing raid returns 403", unauth_complete.status_code == 403)

    # Student 1 completes raid
    legit_complete = client.post(
        f"/api/multiplayer/raid/{raid_id}/complete",
        headers={"Authorization": f"Bearer {student1_token}"}
    )
    assert_test("Authorized raid completion succeeds (200)", legit_complete.status_code == 200)

    # Student 1 attempts duplicate completion
    dup_complete = client.post(
        f"/api/multiplayer/raid/{raid_id}/complete",
        headers={"Authorization": f"Bearer {student1_token}"}
    )
    assert_test("Duplicate raid completion rejected (400)", dup_complete.status_code == 400)

    # --- 5. Gameplay Loot Anti-Farming ---
    print("\n--- 5. Game Economy & Loot Anti-Farming ---")
    loot_claim1 = client.post(
        "/api/gameplay/claim-loot",
        json={"crate_id": "cit-loot-1"},
        headers={"Authorization": f"Bearer {student1_token}"}
    )
    assert_test("First loot claim succeeds (200)", loot_claim1.status_code == 200)

    loot_claim_dup = client.post(
        "/api/gameplay/claim-loot",
        json={"crate_id": "cit-loot-1"},
        headers={"Authorization": f"Bearer {student1_token}"}
    )
    assert_test("Immediate second loot claim returns 429 Too Many Requests", loot_claim_dup.status_code == 429)

    # --- 6. QR Scan Validation & Cooldown ---
    print("\n--- 6. QR Code Decryption Hardening ---")
    # Invalid QR prefix
    bad_qr = client.post(
        "/api/gameplay/qr-scan",
        json={"qr_code": "MALICIOUS_UNAUTHORIZED_QR"},
        headers={"Authorization": f"Bearer {student1_token}"}
    )
    assert_test("Non-campus QR code signature returns 400", bad_qr.status_code == 400)

    # Valid QR code
    good_qr = client.post(
        "/api/gameplay/qr-scan",
        json={"qr_code": "CIT-QUEST-LIBRARY-STATION-2026"},
        headers={"Authorization": f"Bearer {student1_token}"}
    )
    assert_test("Valid CIT campus QR scan succeeds (200)", good_qr.status_code == 200)

    # Rapid second QR scan
    spam_qr = client.post(
        "/api/gameplay/qr-scan",
        json={"qr_code": "CIT-QUEST-CANTEEN-STATION-2026"},
        headers={"Authorization": f"Bearer {student1_token}"}
    )
    assert_test("Immediate subsequent QR scan returns 429 cooldown", spam_qr.status_code == 429)

    # --- 7. PVP Duel Anti-Exploit ---
    print("\n--- 7. Cadet PVP Duel Rules ---")
    self_duel = client.post(
        "/api/pvp/duel",
        json={
            "opponent_id": student1_id,
            "opponent_name": "Myself",
            "rounds": ["OVERCLOCK", "FIREWALL", "EMP"]
        },
        headers={"Authorization": f"Bearer {student1_token}"}
    )
    assert_test("Self-dueling is rejected (400)", self_duel.status_code == 400)

    invalid_move = client.post(
        "/api/pvp/duel",
        json={
            "opponent_id": student2_id,
            "opponent_name": "StudentCadet2",
            "rounds": ["ILLEGAL_ATTACK", "FIREWALL", "EMP"]
        },
        headers={"Authorization": f"Bearer {student1_token}"}
    )
    assert_test("Invalid tactical move choice is rejected (400)", invalid_move.status_code == 400)

    valid_duel = client.post(
        "/api/pvp/duel",
        json={
            "opponent_id": student2_id,
            "opponent_name": "StudentCadet2",
            "rounds": ["OVERCLOCK", "FIREWALL", "EMP"]
        },
        headers={"Authorization": f"Bearer {student1_token}"}
    )
    assert_test("Valid friend duel succeeds (200)", valid_duel.status_code == 200)

    # --- 8. Turf Defense Point Tampering ---
    print("\n--- 8. Turf Defense Point Tampering ---")
    tampered_defend = client.post(
        "/api/turf/defend",
        json={
            "stronghold_id": "stronghold-1",
            "creature_name": "CIT CyberDragon",
            "defense_contribution": 99999999
        },
        headers={"Authorization": f"Bearer {student1_token}"}
    )
    assert_test("Tampered defense contribution is capped at standard 150 points",
                tampered_defend.status_code == 200 and "+150 Control Points" in tampered_defend.json().get("message", ""))

    print("\n" + "=" * 60)
    print(f"TEST RESULTS: {passed}/{total} TESTS PASSED")
    print("=" * 60)

    if passed == total:
        print("ALL DEFENSIVE SECURITY & INTEGRITY CHECKS PASSED!\n")
        return 0
    else:
        print("SOME TESTS FAILED!\n")
        return 1

if __name__ == "__main__":
    sys.exit(run_tests())
