"""Driver factory.

Maps a browser name to the concrete driver class.
"""

from drivers.chromium import ChromiumDriver
from drivers.firefox import FirefoxDriver
from drivers.safari import SafariDriver

_DRIVERS = {
    "chromium": ChromiumDriver,   # Chrome, Edge, Brave
    "firefox": FirefoxDriver,
    "safari": SafariDriver,       # WebKit engine (Playwright)
}

BROWSER_LABELS = {
    "chromium": "Chrome / Edge (Chromium)",
    "firefox": "Firefox",
    "safari": "Safari / WebKit",
}


def get_driver(browser: str) -> object:
    key = (browser or "chromium").lower()
    if key not in _DRIVERS:
        raise ValueError(f"Unsupported browser: {browser}. Choose: {', '.join(_DRIVERS)}")
    return _DRIVERS[key]()
