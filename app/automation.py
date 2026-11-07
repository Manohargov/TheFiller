"""Background Playwright automation controller with multi-browser support.

Uses the drivers/ abstraction so the same UI works for Chrome, Edge, Firefox,
and Safari/WebKit.
"""

import asyncio
import json
import os
import sys
import base64
import threading
from pathlib import Path

from drivers.factory import get_driver, BROWSER_LABELS
from field_mapper import map_fields
from form_filler import inspect_form, fill_form

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("APPDATA", str(Path.home() / ".config"))) / "TheFiller"
DATA_DIR.mkdir(parents=True, exist_ok=True)
PROFILE_PATH = DATA_DIR / "profile.json"
RESOURCE_DIR = Path(sys._MEIPASS) if getattr(sys, "frozen", False) else Path(__file__).resolve().parent.parent
ENGINE_PATH = RESOURCE_DIR / "native" / "fill.js"


def load_profile(path=PROFILE_PATH):
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


class AutomationController:
    def __init__(self):
        self.lock = threading.Lock()
        self.running = False
        self.stop_requested = False
        self.thread = None
        self.logs = []
        self.status = "stopped"  # stopped | running | stopping | idle
        self.current_url = ""
        self.browser = ""
        self.mode = ""  # launch | connect
        self.last_result = {}
        self._driver = None

    def log(self, message):
        self.logs.append(message)
        if len(self.logs) > 300:
            self.logs = self.logs[-300:]

    def get_status(self):
        with self.lock:
            return {
                "running": self.running,
                "status": self.status,
                "browser": self.browser,
                "browser_label": BROWSER_LABELS.get(self.browser, self.browser),
                "mode": self.mode,
                "url": self.current_url,
                "logs": list(self.logs),
                "last_result": self.last_result,
            }

    def start(self, url="", apply=False, headed=True, mode="launch",
              browser="chromium", user_data_dir="", cdp_url=""):
        with self.lock:
            if self.running:
                return False, "Already running"
            self.running = True
            self.stop_requested = False
            self.status = "running"
            self.current_url = url
            self.browser = browser
            self.mode = mode
            self.logs = []
            self.last_result = {}
            self._driver = None

        self.thread = threading.Thread(
            target=self._run,
            args=(url, apply, headed, mode, browser, user_data_dir, cdp_url),
            daemon=True,
        )
        self.thread.start()
        return True, "Started"

    def stop(self):
        with self.lock:
            if not self.running:
                return False, "Not running"
            self.stop_requested = True
            self.status = "stopping"
        return True, "Stopping"

    def _run(self, url, apply, headed, mode, browser, user_data_dir, cdp_url):
        try:
            asyncio.run(
                self._async_run(url, apply, headed, mode, browser, user_data_dir, cdp_url)
            )
        except Exception as exc:  # noqa: BLE001
            self.log(f"Error: {exc}")
            self.last_result = {"error": str(exc)}
        finally:
            with self.lock:
                self.running = False
                self.status = "stopped"

    async def _async_run(self, *args):
        try:
            await self._session_run(*args)
        finally:
            if self._driver:
                await self._driver.stop()
                self._driver = None

    async def _session_run(self, url, apply, headed, mode, browser, user_data_dir, cdp_url):
        driver = get_driver(browser)
        self._driver = driver

        if mode == "connect":
            if not cdp_url:
                cdp_url = "http://127.0.0.1:9222"
            self.log(f"Connecting to {driver.browser_name()} at {cdp_url}")
            await driver.connect(cdp_url)
        else:
            profile_dir = user_data_dir or None
            self.log(f"Launching {driver.browser_name()}...")
            await driver.launch(url=url, headed=headed, user_data_dir=profile_dir)

        page = await driver.get_page()

        if mode == "launch":
            self.current_url = page.url
            self.log(f"Connected to page: {page.url}")
        else:
            self.current_url = page.url
            self.log(f"Attached to tab: {page.url}")

        # Read fields from the current page
        self.log("Detecting form fields on current page...")
        fields = await inspect_form(page)
        self.log(f"Detected {len(fields)} field(s)")

        profile = load_profile()
        mapping = map_fields(fields, profile)

        for entry in mapping:
            if self.stop_requested:
                self.log("Stopped by user")
                break
            mark = "FILL" if entry.get("value") else "SKIP"
            self.log(
                f"[{mark}] {entry['label']} ({entry['type']}) -> {entry['profile_key']}"
            )

        # Fill
        if apply and not self.stop_requested:
            self.log("Filling form fields...")
            resume = None
            resume_path = profile.get("resume_path")
            if resume_path and Path(resume_path).is_file():
                data = Path(resume_path).read_bytes()
                if len(data) > 15 * 1024 * 1024:
                    raise ValueError("Resume exceeds 15 MB")
                resume = {"name": Path(resume_path).name, "base64": base64.b64encode(data).decode("ascii")}
            await page.evaluate(ENGINE_PATH.read_text(encoding="utf-8") + "\n;({profile,resume}) => jobfillerStart(profile,resume,'windows-fill')", {"profile": profile, "resume": resume})
            await page.wait_for_function("window.__theFillerTask && window.__theFillerTask.done", timeout=20000)
            self.last_result = await page.evaluate("window.__theFillerTask.result")
            self.log(str(self.last_result))
            self.log("Form filled. Review the fields and submit manually.")
        elif not apply:
            self.log("Preview complete. Turn Apply ON to fill fields.")

        if headed and mode == "launch":
            self.log("Browser open for review. Turn the switch OFF to close.")
            while not self.stop_requested:
                await asyncio.sleep(1)
