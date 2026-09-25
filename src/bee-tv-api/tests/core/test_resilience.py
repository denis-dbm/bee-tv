import pytest
from app.core.resilience import CircuitBreaker, CircuitOpenError, CircuitState, RetryPolicy


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def state_of(breaker: CircuitBreaker) -> CircuitState:
    """Re-reads the property; defeats mypy's literal narrowing across calls."""
    return breaker.state


async def ok() -> str:
    return "ok"


async def boom() -> str:
    raise RuntimeError("boom")


class TestCircuitBreaker:
    def test_rejects_invalid_threshold(self) -> None:
        with pytest.raises(ValueError, match="failure_threshold"):
            CircuitBreaker("x", failure_threshold=0)

    async def test_stays_closed_below_threshold(self) -> None:
        breaker = CircuitBreaker("x", failure_threshold=2)
        with pytest.raises(RuntimeError):
            await breaker.call(boom)
        assert breaker.state is CircuitState.CLOSED
        assert await breaker.call(ok) == "ok"

    async def test_success_resets_failure_count(self) -> None:
        breaker = CircuitBreaker("x", failure_threshold=2)
        with pytest.raises(RuntimeError):
            await breaker.call(boom)
        await breaker.call(ok)
        with pytest.raises(RuntimeError):
            await breaker.call(boom)
        assert breaker.state is CircuitState.CLOSED

    async def test_opens_at_threshold_and_fails_fast(self) -> None:
        breaker = CircuitBreaker("x", failure_threshold=2, reset_timeout=10, clock=FakeClock())
        for _ in range(2):
            with pytest.raises(RuntimeError):
                await breaker.call(boom)
        assert breaker.state is CircuitState.OPEN
        calls = 0

        async def counted() -> str:
            nonlocal calls
            calls += 1
            return "ok"

        with pytest.raises(CircuitOpenError):
            await breaker.call(counted)
        assert calls == 0

    async def test_half_open_success_closes(self) -> None:
        clock = FakeClock()
        breaker = CircuitBreaker("x", failure_threshold=1, reset_timeout=10, clock=clock)
        with pytest.raises(RuntimeError):
            await breaker.call(boom)
        clock.now = 10
        assert breaker.state is CircuitState.HALF_OPEN
        assert await breaker.call(ok) == "ok"
        assert state_of(breaker) is CircuitState.CLOSED

    async def test_half_open_failure_reopens(self) -> None:
        clock = FakeClock()
        breaker = CircuitBreaker("x", failure_threshold=3, reset_timeout=10, clock=clock)
        for _ in range(3):
            with pytest.raises(RuntimeError):
                await breaker.call(boom)
        clock.now = 11
        with pytest.raises(RuntimeError):
            await breaker.call(boom)
        assert breaker.state is CircuitState.OPEN


class TestRetryPolicy:
    def test_rejects_invalid_attempts(self) -> None:
        with pytest.raises(ValueError, match="max_attempts"):
            RetryPolicy(max_attempts=0)

    def test_exponential_delay_is_capped(self) -> None:
        policy = RetryPolicy(base_delay=0.5, max_delay=1.5)
        assert [policy.delay_for(n) for n in (1, 2, 3, 4)] == [0.5, 1.0, 1.5, 1.5]

    async def test_retries_until_success(self) -> None:
        sleeps: list[float] = []

        async def sleep(delay: float) -> None:
            sleeps.append(delay)

        attempts = 0

        async def flaky() -> str:
            nonlocal attempts
            attempts += 1
            if attempts < 3:
                raise ConnectionError
            return "ok"

        policy = RetryPolicy(
            max_attempts=3, base_delay=0.1, retry_on=(ConnectionError,), sleep=sleep
        )
        assert await policy.run(flaky) == "ok"
        assert attempts == 3
        assert sleeps == [0.1, 0.2]

    async def test_gives_up_after_max_attempts(self) -> None:
        async def sleep(_: float) -> None:
            return None

        policy = RetryPolicy(max_attempts=2, retry_on=(RuntimeError,), sleep=sleep)
        with pytest.raises(RuntimeError):
            await policy.run(boom)

    async def test_does_not_retry_other_errors(self) -> None:
        attempts = 0

        async def wrong() -> str:
            nonlocal attempts
            attempts += 1
            raise KeyError

        policy = RetryPolicy(max_attempts=3, retry_on=(ConnectionError,))
        with pytest.raises(KeyError):
            await policy.run(wrong)
        assert attempts == 1
