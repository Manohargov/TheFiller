"""Safari / WebKit driver.

Supports launching WebKit via Playwright. Because Apple's Safari app does not
expose Chrome-style CDP, attaching to an open Safari window requires SafariDriver
(Apple's WebDriver) or AppleScript — neither is bundled with Playwright.

Use Launch mode with WebKit for testing; for the real Safari app, enable
SafariDriver (safaridriver --enable) and point this driver at its WebDriver port.
"""

from __future__ import annotations

from typing import Optional

from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from drivers.base import BaseDriver


class SafariDriver(BaseDriver):
    def __init__(self) -> None:
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None

    def browser_name(self) -> str:
        return "Safari (WebKit)"

    async def launch(self, url: Optional[str] = None, headed: bool = True,
                     user_data_dir: Optional[str] = None) -> None:
        self._playwright = await async_playwright().start()

        # Playwright WebKit is the WebKit engine, not the Safari.app binary.
        # There is no persistent-context user_data_dir for WebKit in Playwright.
        self._browser = await self._playwright.webkit.launch(headless=not headed)
        self._context = await self._browser.new_context()
        self._page = await self._context.new_page()

        if url:
            await self._page.goto(url, wait_until="domcontentloaded")
            await self._page.wait_for_timeout(2000)

    async def connect(self, debug_url: str) -> None:
        raise NotImplementedError(
            "Playwright cannot attach to an already-open Safari.app via CDP. "
            "Enable SafariDriver (safaridriver --enable) for WebDriver-based attach."
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
