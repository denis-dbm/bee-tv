"""Deterministic, dependency-free insight generator used as the fallback strategy."""

import re
from dataclasses import dataclass
from enum import StrEnum

from app.features.bee_review.insights import (
    Insight,
    InsightGenerator,
    InsightSource,
    InsightSubject,
    SubjectKind,
)

GENRE_HOOKS: dict[str, str] = {
    "action": "high-octane action",
    "adventure": "sweeping adventure",
    "anime": "distinctive anime storytelling",
    "children": "kid-friendly fun",
    "comedy": "sharp humor",
    "crime": "gripping crime storytelling",
    "drama": "character-driven drama",
    "espionage": "spy-craft intrigue",
    "family": "warm family moments",
    "fantasy": "imaginative world-building",
    "history": "rich historical detail",
    "horror": "chilling scares",
    "legal": "courtroom tension",
    "medical": "high-stakes medical cases",
    "music": "a musical heartbeat",
    "mystery": "puzzles and twists",
    "romance": "heartfelt romance",
    "science-fiction": "mind-bending sci-fi ideas",
    "sports": "competitive spirit",
    "supernatural": "otherworldly mysteries",
    "thriller": "edge-of-your-seat suspense",
    "war": "the weight of conflict",
    "western": "frontier grit",
}

_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")
_WORD = re.compile(r"[a-z']+")
MAX_SENTENCE_CHARS = 220


class Sentiment(StrEnum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    MIXED = "mixed"


@dataclass(frozen=True, slots=True)
class SentimentSummary:
    overall: Sentiment
    positive: int
    negative: int
    total: int


class LexiconSentimentAnalyzer:
    """Tiny lexicon-based sentiment scorer: good enough for a fallback, fully offline."""

    POSITIVE = frozenset({
        "addictive", "amazing", "awesome", "beautiful", "best", "brilliant", "enjoy",
        "enjoyed", "excellent", "fantastic", "favorite", "favourite", "fun", "good", "great",
        "gripping", "incredible", "like", "liked", "love", "loved", "loving", "masterpiece",
        "perfect", "recommend", "wonderful",
    })  # fmt: skip
    NEGATIVE = frozenset({
        "annoying", "awful", "bad", "boring", "confusing", "disappointed", "disappointing",
        "dull", "hate", "hated", "meh", "mess", "overrated", "poor", "slow", "terrible",
        "waste", "weak", "worst",
    })  # fmt: skip

    def score(self, text: str) -> int:
        words = _WORD.findall(text.lower())
        return sum(w in self.POSITIVE for w in words) - sum(w in self.NEGATIVE for w in words)

    def summarize(self, comments: tuple[str, ...]) -> SentimentSummary:
        scores = [self.score(comment) for comment in comments]
        positive = sum(s > 0 for s in scores)
        negative = sum(s < 0 for s in scores)
        if positive > negative and positive >= 2 * negative:
            overall = Sentiment.POSITIVE
        elif negative > positive and negative >= 2 * positive:
            overall = Sentiment.NEGATIVE
        else:
            overall = Sentiment.MIXED
        return SentimentSummary(overall, positive, negative, len(comments))


class RuleBasedInsightGenerator(InsightGenerator):
    name = "bee-rules-v1"

    def __init__(self, sentiment: LexiconSentimentAnalyzer | None = None) -> None:
        self._sentiment = sentiment or LexiconSentimentAnalyzer()

    async def generate(self, subject: InsightSubject) -> Insight:
        parts = [self._opening(subject), self._audience(subject)]
        if subject.comments:
            parts.append(self._viewers(subject.comments))
        return Insight(
            text=" ".join(p for p in parts if p),
            source=InsightSource.FALLBACK,
            generator=self.name,
        )

    @staticmethod
    def _hooks(genres: tuple[str, ...]) -> list[str]:
        return [GENRE_HOOKS[g.lower()] for g in genres if g.lower() in GENRE_HOOKS][:2]

    @staticmethod
    def _first_sentence(summary: str) -> str:
        sentence = _SENTENCE_END.split(summary.strip(), maxsplit=1)[0] if summary else ""
        if len(sentence) > MAX_SENTENCE_CHARS:
            sentence = sentence[:MAX_SENTENCE_CHARS].rsplit(" ", 1)[0] + "…"
        return sentence

    def _opening(self, subject: InsightSubject) -> str:
        noun = "This series" if subject.kind is SubjectKind.SERIES else "This episode"
        hooks = self._hooks(subject.genres)
        focus = f"{noun} delivers {' and '.join(hooks)}." if hooks else ""
        premise = self._first_sentence(subject.summary)
        if premise:
            return f"{focus} {premise}".strip()
        return focus or f"{noun} has no synopsis yet, so it is a perfect pick for explorers."

    @staticmethod
    def _audience(subject: InsightSubject) -> str:
        genres = [g.lower() for g in subject.genres[:3]]
        if not genres:
            return "A good fit for viewers who enjoy discovering something new."
        listed = genres[0] if len(genres) == 1 else f"{', '.join(genres[:-1])} and {genres[-1]}"
        return f"Recommended for fans of {listed}."

    def _viewers(self, comments: tuple[str, ...]) -> str:
        summary = self._sentiment.summarize(comments)
        noun = "comment" if summary.total == 1 else "comments"
        if summary.overall is Sentiment.POSITIVE:
            mood = "Bee TV viewers are mostly enthusiastic"
        elif summary.overall is Sentiment.NEGATIVE:
            mood = "Bee TV viewers are mostly critical"
        else:
            mood = "Bee TV viewers have mixed feelings"
        return f"{mood} ({summary.total} {noun} considered)."
