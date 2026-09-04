import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_multiplayer():
    res = client.get("/api/multiplayer/peers")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    data = res.json()
    assert "peers" in data
    print(f"[PASS] /api/multiplayer/peers returned {data}")

if __name__ == "__main__":
    try:
        test_multiplayer()
        print("[ALL MULTIPLAYER TESTS PASSED]")
    except Exception as e:
        print(f"[TEST FAILED] {e}")
        sys.exit(1)

