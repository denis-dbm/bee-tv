"""Resilience primitives: circuit breaker and retry with exponential backoff.

Both are deliberately small, dependency-free and clock-injectable so that they are
deterministic under test. Each integration composes them according to its own context.
"""

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable
from enum import StrEnum

logger = logging.getLogger(__name__)

type Clock = Callable[[], float]
type Sleeper = Callable[[float], Awaitable[None]]


class CircuitState(StrEnum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitOpenError(Exception):
    """Raised when a call is short-circuited because the breaker is open."""


class CircuitBreaker:
    """Classic three-state circuit breaker.

    CLOSED: calls flow; consecutive failures are counted.
    OPEN: calls fail fast until `reset_timeout` elapses.
    HALF_OPEN: one trial call decides whether to close or re-open.
    """

    def __init__(
        self,
        name: str,
        failure_threshold: int = 3,
        reset_timeout: float = 30.0,
        clock: Clock = time.monotonic,
    ) -> None:
        if failure_threshold < 1:
            raise ValueError("failure_threshold must be >= 1")
        self.name = name
        self._failure_threshold = failure_threshold
        self._reset_timeout = reset_timeout
        self._clock = clock
        self._failures = 0
        self._opened_at: float | None = None

    @property
    def state(self) -> CircuitState:
        if self._opened_at is None:
            return CircuitState.CLOSED
        if self._clock() - self._opened_at >= self._reset_timeout:
            return CircuitState.HALF_OPEN
        return CircuitState.OPEN

    async def call[T](self, operation: Callable[[], Awaitable[T]]) -> T:
        if self.state is CircuitState.OPEN:
            raise CircuitOpenError(f"Circuit '{self.name}' is open")
        try:
            result = await operation()
        except Exception:
            self._record_failure()
            raise
        self._record_success()
        return result

    def _record_success(self) -> None:
        if self._opened_at is not None:
            logger.info("Circuit '%s' closed", self.name)
        self._failures = 0
        self._opened_at = None

    def _record_failure(self) -> None:
        was_half_open = self.state is CircuitState.HALF_OPEN
        self._failures += 1
        if was_half_open or self._failures >= self._failure_threshold:
            self._opened_at = self._clock()
            logger.warning("Circuit '%s' opened after %d failure(s)", self.name, self._failures)


class RetryPolicy:
    """Retries an async operation on selected exceptions with exponential backoff."""

    def __init__(
        self,
        max_attempts: int = 3,
        base_delay: float = 0.2,
        max_delay: float = 2.0,
        retry_on: tuple[type[BaseException], ...] = (Exception,),
        sleep: Sleeper = asyncio.sleep,
    ) -> None:
        if max_attempts < 1:
            raise ValueError("max_attempts must be >= 1")
        self._max_attempts = max_attempts
        self._base_delay = base_delay
        self._max_delay = max_delay
        self._retry_on = retry_on
        self._sleep = sleep

    def delay_for(self, attempt: int) -> float:
        return float(min(self._max_delay, self._base_delay * (2 ** (attempt - 1))))

    async def run[T](self, operation: Callable[[], Awaitable[T]]) -> T:
        attempt = 1
        while True:
            try:
                return await operation()
            except self._retry_on as exc:
                if attempt >= self._max_attempts:
                    raise
                delay = self.delay_for(attempt)
                logger.warning(
                    "Attempt %d/%d failed (%s); retrying in %.2fs",
                    attempt,
                    self._max_attempts,
                    type(exc).__name__,
                    delay,
                )
                await self._sleep(delay)
                attempt += 1
