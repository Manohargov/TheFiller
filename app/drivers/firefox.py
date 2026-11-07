"""Firefox driver.

Supports launching Firefox via Playwright, including a persistent context that
reuses the user's real Firefox profile (so cookies/logins carry over).

Notes:
  - Playwright does NOT expose connect_over_cdp for Firefox. To attach to an
    already-open Firefox window you would need geckodriver/Selenium, which is
    not bundled here. Use "Launch" mode with a Firefox profile directory instead.
"""

from __future__ import annotations

from typing import Optional

from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from drivers.base import BaseDriver


class FirefoxDriver(BaseDriver):
    def __init__(self) -> None:
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None

    def browser_name(self) -> str:
        return "Firefox"

    async def launch(self, url: Optional[str] = None, headed: bool = True,
                     user_data_dir: Optional[str] = None) -> None:
        self._playwright = await async_playwright().start()

        if user_data_dir:
            # Reuse the user's actual Firefox profile
            self._context = await self._playwright.firefox.launch_persistent_context(
                user_data_dir=user_data_dir,
                headless=not headed,
            )
            pages = self._context.pages
            self._page = pages[0] if pages else await self._context.new_page()
        else:
            self._browser = await self._playwright.firefox.launch(headless=not headed)
            self._context = await self._browser.new_context()
            self._page = await self._context.new_page()

        if url:
            await self._page.goto(url, wait_until="domcontentloaded")
            await self._page.wait_for_timeout(2000)

    async def connect(self, debug_url: str) -> None:
        raise NotImplementedError(
            "Playwright cannot attach to an already-open Firefox via CDP. "
            "Use Launch mode with your Firefox profile directory instead."
        )

    async def get_page(self) -> Page:
        if not self._page:
            raise RuntimeError("No active page. Call launch() first.")
        return self._page

    async def stop(self) -> None:
        try:
            if self._context:
                await self._context.close()
        except Exception:  # noqa: BLE001
            pass
        try:
            if self._browser:
                await self._browser.close()
        except Exception:  # noqa: BLE001
            pass
        try:
            if self._playwright:
                await self._playwright.stop()
        except Exception:  # noqa: BLE001
            pass
        self._page = None
        self._context = None
        self._browser = None
        self._playwright = None
