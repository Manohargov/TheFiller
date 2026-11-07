"""Chromium-based driver: Chrome, Edge, Brave, etc.

Supports:
  - launch()      : Playwright chromium.launch (or persistent context with user profile)
  - connect()     : Playwright connect_over_cdp (attach to an open Chrome/Edge tab)
"""

from __future__ import annotations

from typing import Optional

from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from drivers.base import BaseDriver


class ChromiumDriver(BaseDriver):
    def __init__(self) -> None:
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None
        self._mode: str = ""  # "launch" | "connect"

    def browser_name(self) -> str:
        return "Chrome / Edge (Chromium)"

    async def launch(self, url: Optional[str] = None, headed: bool = True,
                     user_data_dir: Optional[str] = None) -> None:
        self._playwright = await async_playwright().start()

        if user_data_dir:
            # Persistent context reuses the user's real profile (cookies, logins, extensions)
            self._context = await self._playwright.chromium.launch_persistent_context(
                user_data_dir=user_data_dir,
                headless=not headed,
            )
            pages = self._context.pages
            self._page = pages[0] if pages else await self._context.new_page()
        else:
            self._browser = await self._playwright.chromium.launch(headless=not headed)
            self._context = await self._browser.new_context()
            self._page = await self._context.new_page()
            if url:
                await self._page.goto(url, wait_until="domcontentloaded")
                await self._page.wait_for_timeout(2000)

        self._mode = "launch"
        if url and not user_data_dir:
            pass  # already navigated above
        elif url:
            await self._page.goto(url, wait_until="domcontentloaded")
            await self._page.wait_for_timeout(2000)

    async def connect(self, debug_url: str) -> None:
        """Connect to an already-running Chromium via CDP (e.g. http://127.0.0.1:9222)."""
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.connect_over_cdp(debug_url)
        contexts = self._browser.contexts
        self._context = contexts[0] if contexts else await self._browser.new_context()
        self._mode = "connect"
        candidates = []
        for context in contexts:
            for page in context.pages:
                if page.url.startswith(("http://", "https://")) and not page.url.startswith("http://127.0.0.1:"):
                    try:
                        if await page.evaluate("document.visibilityState === 'visible'"):
                            candidates.append(page)
                    except Exception:
                        continue
        if len(candidates) != 1:
            raise RuntimeError("Keep one browser window open, with the application tab selected, then retry.")
        self._page = candidates[0]

    async def get_page(self) -> Page:
        if not self._page:
            raise RuntimeError("No active page. Call launch() or connect() first.")
        return self._page

    async def stop(self) -> None:
        try:
            if self._context and self._mode != "connect":
                await self._context.close()
        except Exception:  # noqa: BLE001
            pass
        try:
            if self._browser and self._mode != "connect":
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
        self._mode = ""
