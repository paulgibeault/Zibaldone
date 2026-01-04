from fastapi.testclient import TestClient
from app.main import app
from app.exceptions import AppError, ResultNotFound, ServiceUnavailable
from fastapi import APIRouter

client = TestClient(app, raise_server_exceptions=False)

# Create a dummy router to test exception handlers
test_router = APIRouter()

@test_router.get("/test/error/not_found")
def trigger_not_found():
    raise ResultNotFound("Test resource not found")

@test_router.get("/test/error/service_unavailable")
def trigger_service_unavailable():
    raise ServiceUnavailable("Test service down")

@test_router.get("/test/error/generic")
def trigger_generic():
    raise Exception("Unexpected failure")

app.include_router(test_router)

def test_result_not_found_handler():
    response = client.get("/test/error/not_found")
    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "NOT_FOUND"
    assert data["error"]["message"] == "Test resource not found"

def test_service_unavailable_handler():
    response = client.get("/test/error/service_unavailable")
    assert response.status_code == 503
    data = response.json()
    assert data["error"]["code"] == "SERVICE_UNAVAILABLE"
    assert data["error"]["message"] == "Test service down"

def test_generic_exception_handler():
    response = client.get("/test/error/generic")
    assert response.status_code == 500
    data = response.json()
    assert data["error"]["code"] == "INTERNAL_ERROR"
    assert data["error"]["message"] == "An unexpected error occurred."
