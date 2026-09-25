"""Current-user resolution.

Authentication is out of the MVP scope: every request acts on behalf of a mocked guest.
Swapping this dependency for a real identity provider is the only change required later.
"""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends


@dataclass(frozen=True, slots=True)
class CurrentUser:
    id: str
    display_name: str


GUEST_USER = CurrentUser(id="guest", display_name="Guest")


def get_current_user() -> CurrentUser:
    return GUEST_USER


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
