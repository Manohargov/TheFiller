"""Abstract base driver for browser automation.

Concrete drivers implement:
  - launch(url, headed, ...)      -> open a fresh browser (with optional user profile)
  - connect(debug_url, ...)       -> attach to an already-running browser tab
  - get_page()                    -> return the active Playwright Page
  - stop()                        -> close/detach
  - browser_name()                -> human readable name
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional


class BaseDriver(ABC):
    @abstractmethod
    async def launch(self, url: Optional[str] = None, headed: bool = True,
                     user_data_dir: Optional[str] = None) -> None:
        """Open a fresh browser instance."""
        ...

    @abstractmethod
    async def connect(self, debug_url: str) -> None:
        """Attach to an already-running browser via its remote-debugging URL."""
        ...

    @abstractmethod
    async def get_page(self):
        """Return the active Playwright Page object."""
        ...

    @abstractmethod
    async def stop(self) -> None:
        """Close browser / detach."""
        ...

    @abstractmethod
    def browser_name(self) -> str:
        ...
