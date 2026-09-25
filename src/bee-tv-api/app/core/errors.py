"""Application error hierarchy and global exception handlers.

Errors carry their own HTTP semantics (status, title, code), so the handler is generic:
adding a new error type never requires touching the handler (Open/Closed).
Responses follow RFC 9457 (Problem Details for HTTP APIs).
"""

import logging
from http import HTTPStatus
from typing import Any, ClassVar

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

PROBLEM_JSON = "application/problem+json"


class ApplicationError(Exception):
    status_code: ClassVar[int] = HTTPStatus.INTERNAL_SERVER_ERROR
    code: ClassVar[str] = "internal_error"
    title: ClassVar[str] = "Something went wrong"

    def __init__(self, detail: str | None = None) -> None:
        super().__init__(detail or self.title)
        self.detail = detail or self.title


class NotFoundError(ApplicationError):
    status_code = HTTPStatus.NOT_FOUND
    code = "not_found"
    title = "Resource not found"


class ServiceUnavailableError(ApplicationError):
    status_code = HTTPStatus.SERVICE_UNAVAILABLE
    code = "service_unavailable"
    title = "A partner service is temporarily unavailable"


def problem(
    status: int, title: str, detail: str, code: str, instance: str, **extra: Any
) -> JSONResponse:
    body: dict[str, Any] = {
        "type": f"https://bee.tv/problems/{code}",
        "title": title,
        "status": status,
        "detail": detail,
        "code": code,
        "instance": instance,
        **extra,
    }
    return JSONResponse(status_code=status, content=body, media_type=PROBLEM_JSON)


async def handle_application_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, ApplicationError)  # noqa: S101 - narrowed by registration
    log = logger.error if exc.status_code >= HTTPStatus.INTERNAL_SERVER_ERROR else logger.info
    log("%s %s -> %s (%s)", request.method, request.url.path, exc.status_code, exc.detail)
    return problem(exc.status_code, exc.title, exc.detail, exc.code, request.url.path)


async def handle_validation_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)  # noqa: S101
    errors = [
        {"loc": list(err.get("loc", ())), "msg": err.get("msg", ""), "type": err.get("type", "")}
        for err in exc.errors()
    ]
    return problem(
        HTTPStatus.UNPROCESSABLE_CONTENT,
        "Invalid request",
        "One or more request parameters are invalid.",
        "validation_error",
        request.url.path,
        errors=errors,
    )


async def handle_http_exception(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)  # noqa: S101
    status = HTTPStatus(exc.status_code)
    return problem(
        status,
        status.phrase,
        str(exc.detail),
        status.phrase.lower().replace(" ", "_"),
        request.url.path,
    )


async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return problem(
        HTTPStatus.INTERNAL_SERVER_ERROR,
        ApplicationError.title,
        "An unexpected error occurred. Please try again later.",
        ApplicationError.code,
        request.url.path,
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApplicationError, handle_application_error)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(StarletteHTTPException, handle_http_exception)
    app.add_exception_handler(Exception, handle_unexpected_error)
