"""End-to-end verification script for the Irminsul FastAPI backend."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def run_tests() -> None:
    health = client.get("/health")
    assert health.status_code == 200, f"Health check failed: {health.text}"
    assert health.json()["status"] == "healthy"

    chars = client.get("/api/characters")
    assert chars.status_code == 200, f"Characters list failed: {chars.text}"
    items = chars.json()
    assert len(items) > 0, "Expected non-empty character catalog"

    first_id = items[0]["id"]
    detail = client.get(f"/api/characters/{first_id}")
    assert detail.status_code == 200, f"Character detail failed: {detail.text}"
    assert detail.json()["id"] == first_id

    advisor = client.post("/api/advisor", json={"characterName": items[0]["name"]})
    assert advisor.status_code == 200, f"Advisor failed: {advisor.text}"
    assert "overallGrade" in advisor.json()

    bad_uid = client.post("/api/auth/connect", json={"uid": "123"})
    assert bad_uid.status_code in (400, 422)

    print(f"All Irminsul backend checks passed! Catalog count: {len(items)}")


if __name__ == "__main__":
    run_tests()
