import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_shop_catalog():
    response = client.get("/api/shop/items")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()
    assert len(data) >= 6, "Expected at least 6 shop catalog items"
    assert any(item["id"] == "battery_50" for item in data)
    assert any(item["id"] == "title_pioneer" for item in data)
    print(f"[PASS] /api/shop/items returned {len(data)} redeemable items")

if __name__ == "__main__":
    try:
        test_shop_catalog()
        print("[ALL SHOP TESTS PASSED]")
    except Exception as e:
        print(f"[TEST FAILED] {e}")
        sys.exit(1)

