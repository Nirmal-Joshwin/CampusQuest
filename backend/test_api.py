import uuid
from fastapi.testclient import TestClient
from app.main import app

def test_api():
    client = TestClient(app)
    
    # 1. Test Root
    res_root = client.get("/")
    assert res_root.status_code == 200
    assert res_root.json()["status"] == "online"
    print("[PASS] Root endpoint returned 200 OK")

    # 2. Test GET /api/spawns
    res_spawns = client.get("/api/spawns?count=10")
    assert res_spawns.status_code == 200
    data = res_spawns.json()
    assert len(data) == 10, f"Expected 10 spawns, got {len(data)}"
    print(f"[PASS] /api/spawns returned {len(data)} canonical story spawns")

    # 3. Test GET /api/gameplay/loot
    res_loot = client.get("/api/gameplay/loot")
    assert res_loot.status_code == 200
    loot_data = res_loot.json()
    assert len(loot_data) >= 3
    print(f"[PASS] /api/gameplay/loot returned {len(loot_data)} campus loot caches")

    print("[ALL CIT CAMPUS GEOFENCE, RARITY, AUTH & GAMEPLAY TESTS PASSED]")

if __name__ == "__main__":
    test_api()
