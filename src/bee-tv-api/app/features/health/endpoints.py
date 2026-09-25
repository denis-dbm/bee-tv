"""Feature: liveness/readiness probe used by Docker healthchecks."""

import logging
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.core.db import Database, get_database
from app.core.schemas import ApiModel

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


class HealthResponse(ApiModel):
    status: Literal["ok", "degraded"]
    database: Literal["up", "down"]


@router.get("/health", response_model=HealthResponse, summary="Service health")
async def health(database: Annotated[Database, Depends(get_database)]) -> JSONResponse:
    try:
        await database.ping()
    except Exception:
        logger.exception("Health check: database unreachable")
        body = HealthResponse(status="degraded", database="down")
        return JSONResponse(status_code=503, content=body.model_dump(by_alias=True))
    return JSONResponse(
        content=HealthResponse(status="ok", database="up").model_dump(by_alias=True)
    )
