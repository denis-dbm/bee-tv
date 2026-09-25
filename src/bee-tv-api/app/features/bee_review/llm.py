"""LLM adapter speaking the OpenAI-compatible Chat Completions protocol.

HuggingFace's Inference Providers router exposes this protocol, and so do OpenAI, Groq,
Together, Ollama, vLLM, and others. Switching provider is just configuration
(base URL, token, model), with no code change.
"""

import logging
from typing import Any

import httpx

from app.core.resilience import CircuitBreaker, CircuitOpenError
from app.features.bee_review.insights import (
    Insight,
    InsightGenerationError,
    InsightGenerator,
    InsightSource,
    InsightSubject,
)
from app.features.bee_review.prompting import PromptBuilder

logger = logging.getLogger(__name__)

MAX_INSIGHT_CHARS = 700


class ChatCompletionInsightGenerator(InsightGenerator):
    """No retries on purpose: a fast fallback is better UX than a slow retry of an LLM call.
    The circuit breaker stops hammering a provider that is down or out of quota."""

    def __init__(
        self,
        client: httpx.AsyncClient,
        model: str,
        breaker: CircuitBreaker,
        prompt_builder: PromptBuilder,
        max_tokens: int = 180,
        temperature: float = 0.6,
    ) -> None:
        self._client = client
        self._model = model
        self._breaker = breaker
        self._prompts = prompt_builder
        self._max_tokens = max_tokens
        self._temperature = temperature
        self.name = model

    async def generate(self, subject: InsightSubject) -> Insight:
        payload = {
            "model": self._model,
            "messages": [
                {"role": m.role, "content": m.content} for m in self._prompts.build(subject)
            ],
            "max_tokens": self._max_tokens,
            "temperature": self._temperature,
        }
        try:
            body = await self._breaker.call(lambda: self._post(payload))
        except CircuitOpenError as exc:
            raise InsightGenerationError(f"Circuit open for {self.name}") from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise InsightGenerationError(f"{self.name} request failed: {exc}") from exc
        return Insight(text=self._extract_text(body), source=InsightSource.AI, generator=self.name)

    async def _post(self, payload: dict[str, Any]) -> Any:
        response = await self._client.post("/chat/completions", json=payload)
        response.raise_for_status()
        return response.json()

    def _extract_text(self, body: Any) -> str:
        try:
            content = body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise InsightGenerationError(f"{self.name} returned an unexpected payload") from exc
        text = " ".join(str(content or "").split()).strip().strip('"').strip()
        if not text:
            raise InsightGenerationError(f"{self.name} returned an empty insight")
        return text[:MAX_INSIGHT_CHARS]
