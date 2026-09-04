from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_expansion_features():
    # 1. Login or register a test cadet
    username = "cit_expansion_tester"
    client.post("/api/auth/register", json={
        "email": f"{username}@cit.edu.in",
        "username": username,
        "password": "Password123!",
        "department": "CSE"
    })
    
    login_res = client.post("/api/auth/login", json={
        "email": f"{username}@cit.edu.in",
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Test GET /api/turf/strongholds
    strongholds_res = client.get("/api/turf/strongholds")
    assert strongholds_res.status_code == 200
    strongholds = strongholds_res.json()["strongholds"]
    assert len(strongholds) == 4
    print(f"[PASS] /api/turf/strongholds returned {len(strongholds)} CIT Strongholds")

    # 3. Test POST /api/turf/defend
    defend_res = client.post("/api/turf/defend", json={
        "stronghold_id": "stronghold-1",
        "creature_name": "ByteFalcon",
        "defense_contribution": 200
    }, headers=headers)
    assert defend_res.status_code == 200
    assert defend_res.json()["success"] is True
    print(f"[PASS] /api/turf/defend successfully stationed creature")

    # 4. Test GET /api/turf/leaderboard
    leaderboard_res = client.get("/api/turf/leaderboard")
    assert leaderboard_res.status_code == 200
    assert len(leaderboard_res.json()["leaderboard"]) >= 5
    print(f"[PASS] /api/turf/leaderboard returned department rankings")

    # 5. Test POST /api/gameplay/qr-scan
    qr_res = client.post("/api/gameplay/qr-scan", json={
        "qr_code": "cit-bulletin-station-mech"
    }, headers=headers)
    assert qr_res.status_code == 200
    assert qr_res.json()["success"] is True
    print(f"[PASS] /api/gameplay/qr-scan verified physical campus QR station")

    # 6. Test POST /api/pvp/duel
    duel_res = client.post("/api/pvp/duel", json={
        "opponent_id": "cit-peer-1",
        "opponent_name": "Karthik",
        "player_creature": "CircuitPhoenix",
        "rounds": ["OVERCLOCK", "FIREWALL", "EMP"]
    }, headers=headers)
    assert duel_res.status_code == 200
    duel_data = duel_res.json()
    assert duel_data["success"] is True
    assert len(duel_data["rounds"]) == 3
    print(f"[PASS] /api/pvp/duel executed 3-turn tactical duel with score {duel_data['player_score']}-{duel_data['opponent_score']}")

    print("[ALL EXPANSION BACKEND TESTS PASSED]")

if __name__ == "__main__":
    test_expansion_features()

