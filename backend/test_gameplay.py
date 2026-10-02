import uuid
from fastapi.testclient import TestClient
from app.main import app

def test_gameplay_logic():
    client = TestClient(app)
    
    # Register user
    test_id = uuid.uuid4().hex[:6]
    valid_username = f"cadet_{test_id}"
    res_reg = client.post("/api/auth/register", json={
        "email": f"{valid_username}@cit.edu.in",
        "username": valid_username,
        "password": "Password123!",
        "role": "STUDENT",
        "department": "CSE"
    })
    assert res_reg.status_code == 201
    user_token = res_reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {user_token}"}
    
    # Get user to check energy
    res_me = client.get("/api/auth/me", headers=headers)
    assert res_me.status_code == 200
    assert res_me.json()["energy"] >= 10
    
    # 1. Successful catch (ByteFalcon at valid coords)
    res_catch1 = client.post("/api/gameplay/catch", json={
        "creature_name": "ByteFalcon",
        "rarity": "COMMON",
        "latitude": 11.028420,
        "longitude": 77.026510
    }, headers=headers)
    assert res_catch1.status_code == 200
    
    # 2. Double capture (should fail)
    res_catch2 = client.post("/api/gameplay/catch", json={
        "creature_name": "ByteFalcon",
        "rarity": "COMMON",
        "latitude": 11.028420,
        "longitude": 77.026510
    }, headers=headers)
    assert res_catch2.status_code == 400
    assert "already registered in your Bestiary" in res_catch2.text
    
    # 3. Invalid states / edge cases (distance exactly 35m?)
    # Create new user to bypass the anti-spoofing speed limit
    res_reg2 = client.post("/api/auth/register", json={
        "email": f"cadet2_{test_id}@cit.edu.in",
        "username": f"cadet2_{test_id}",
        "password": "Password123!",
        "role": "STUDENT",
        "department": "CSE"
    })
    headers2 = {"Authorization": f"Bearer {res_reg2.json()['access_token']}"}
    
    # Target: 11.028420, 77.026510
    # 0.0003 lat is ~33 meters. Let's try 11.028420 + 0.0003 = 11.028720
    res_catch3 = client.post("/api/gameplay/catch", json={
        "creature_name": "SiliconTitan",
        "rarity": "COMMON",
        "latitude": 11.026200, # Actual is 11.026200
        "longitude": 77.028300 # Actual is 77.028000. diff = 0.0003 (~33m)
    }, headers=headers2)
    assert res_catch3.status_code == 200 # within 50m tolerance!
    
    # 4. Out of range (diff = 0.001 deg ~ 111m)
    res_catch4 = client.post("/api/gameplay/catch", json={
        "creature_name": "CampusOwl",
        "rarity": "COMMON",
        "latitude": 11.026610,
        "longitude": 77.027020 # Actual is 77.028020
    }, headers=headers2)
    assert res_catch4.status_code == 403
    assert "Radar limit is 35m" in res_catch4.text
    
    print("Gameplay tests passed!")

if __name__ == "__main__":
    test_gameplay_logic()
