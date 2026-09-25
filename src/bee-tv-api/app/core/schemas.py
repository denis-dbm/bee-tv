"""Shared API schema building blocks."""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    """Base for response/request DTOs: camelCase on the wire, snake_case in Python."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)


class Page[T](ApiModel):
    """Collection envelope; leaves room for pagination metadata without breaking clients."""

    items: list[T]
