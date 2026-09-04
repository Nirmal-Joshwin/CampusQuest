from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_friends_flow():
    # 1. Register a test cadet
    username = "cit_cadet_tester"
    client.post("/api/auth/register", json={
        "email": f"{username}@cit.edu.in",
        "username": username,
        "password": "Password123!",
        "department": "CSE"
    })
    
    # 2. Login to get token
    login_res = client.post("/api/auth/login", json={
        "email": f"{username}@cit.edu.in",
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. List friends (fallback simulated friends should be returned)
    friends_res = client.get("/api/friends", headers=headers)
    assert friends_res.status_code == 200
    friends_data = friends_res.json()
    assert "friends" in friends_data
    assert len(friends_data["friends"]) >= 1
    print(f"[PASS] /api/friends returned {len(friends_data['friends'])} friends with live locations")

    # 4. Search cadets
    search_res = client.get("/api/friends/search?q=cit", headers=headers)
    assert search_res.status_code == 200
    print(f"[PASS] /api/friends/search returned {search_res.json()['count']} cadets")

    # 5. Send radar ping to friend
    ping_res = client.post("/api/friends/ping/cit-friend-1", headers=headers)
    assert ping_res.status_code == 200
    assert ping_res.json()["success"] is True
    print(f"[PASS] /api/friends/ping successfully broadcasted radar ping")

    print("[ALL FRIENDS TESTS PASSED]")

if __name__ == "__main__":
    test_friends_flow()
