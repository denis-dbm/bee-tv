from datetime import UTC, datetime

import httpx
import pytest
from fastapi import FastAPI, Query
from sqlalchemy.exc import OperationalError

from app.core.db import as_utc, utc_now
from app.core.errors import (
    PROBLEM_JSON,
    NotFoundError,
    ServiceUnavailableError,
    register_exception_handlers,
)
from app.core.identity import GUEST_USER, get_current_user
from app.core.logging import REQUEST_ID_HEADER, access_log_middleware


class WidgetMissingError(NotFoundError):
    code = "widget_missing"
    title = "Widget missing"


@pytest.fixture
def error_app() -> FastAPI:
    app = FastAPI()
    app.middleware("http")(access_log_middleware)
    register_exception_handlers(app)

    @app.get("/missing")
    async def missing() -> None:
        raise WidgetMissingError("No widget 7")

    @app.get("/down")
    async def down() -> None:
        raise ServiceUnavailableError()

    @app.get("/bug")
    async def bug() -> None:
        raise ZeroDivisionError

    @app.get("/db-down")
    async def db_down() -> None:
        raise OperationalError("SELECT 1", {}, ConnectionRefusedError("Can't connect"))

    @app.get("/typed")
    async def typed(n: int = Query()) -> int:
        return n

    return app


@pytest.fixture
async def http(error_app: FastAPI) -> httpx.AsyncClient:
    transport = httpx.ASGITransport(app=error_app, raise_app_exceptions=False)
    return httpx.AsyncClient(transport=transport, base_url="http://test")


class TestGlobalExceptionHandlers:
    async def test_application_error_becomes_problem_details(self, http: httpx.AsyncClient) -> None:
        response = await http.get("/missing")
        assert response.status_code == 404
        assert response.headers["content-type"] == PROBLEM_JSON
        assert response.json() == {
            "type": "https://bee.tv/problems/widget_missing",
            "title": "Widget missing",
            "status": 404,
            "detail": "No widget 7",
            "code": "widget_missing",
            "instance": "/missing",
        }

    async def test_default_detail_is_title(self, http: httpx.AsyncClient) -> None:
        body = (await http.get("/down")).json()
        assert body["status"] == 503
        assert body["detail"] == ServiceUnavailableError.title

    async def test_unexpected_error_is_hidden(self, http: httpx.AsyncClient) -> None:
        response = await http.get("/bug")
        assert response.status_code == 500
        assert "ZeroDivision" not in response.text
        assert response.json()["code"] == "internal_error"

    async def test_database_outage_is_503(self, http: httpx.AsyncClient) -> None:
        response = await http.get("/db-down")
        assert response.status_code == 503
        assert response.json()["code"] == "database_unavailable"
        assert "Can't connect" not in response.text

    async def test_validation_error(self, http: httpx.AsyncClient) -> None:
        response = await http.get("/typed", params={"n": "abc"})
        assert response.status_code == 422
        body = response.json()
        assert body["code"] == "validation_error"
        assert body["errors"][0]["loc"] == ["query", "n"]

    async def test_unknown_route(self, http: httpx.AsyncClient) -> None:
        response = await http.get("/nope")
        assert response.status_code == 404
        assert response.json()["code"] == "not_found"


class TestAccessLog:
    async def test_generates_request_id(self, http: httpx.AsyncClient) -> None:
        response = await http.get("/typed", params={"n": 1})
        assert len(response.headers[REQUEST_ID_HEADER]) == 32

    async def test_propagates_request_id(self, http: httpx.AsyncClient) -> None:
        response = await http.get("/typed", params={"n": 1}, headers={REQUEST_ID_HEADER: "abc"})
        assert response.headers[REQUEST_ID_HEADER] == "abc"


def test_guest_user_is_mocked_identity() -> None:
    assert get_current_user() is GUEST_USER
    assert GUEST_USER.id == "guest"


def test_as_utc_marks_naive_datetimes_as_utc() -> None:
    naive = datetime(2024, 1, 1, 12, 0)
    assert as_utc(naive).tzinfo is UTC
    aware = utc_now()
    assert as_utc(aware) is aware
