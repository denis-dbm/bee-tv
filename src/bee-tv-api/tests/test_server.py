from typing import Any

import pytest
from pydantic import ValidationError

from app import __main__ as server
from app.core.config import Settings


def test_serves_on_configured_host_and_port(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}
    monkeypatch.setattr("uvicorn.run", lambda _app, **kwargs: captured.update(kwargs))

    server.main(Settings(_env_file=None, api_host="127.0.0.1", api_port=9123))

    assert captured["host"] == "127.0.0.1"
    assert captured["port"] == 9123
    assert captured["proxy_headers"] is True


def test_port_is_read_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BEE_API_PORT", "8088")
    assert Settings(_env_file=None).api_port == 8088


@pytest.mark.parametrize("port", [0, 70000])
def test_rejects_invalid_ports(port: int) -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, api_port=port)
