"""Flask application serving the web UI and automation API.

Endpoints:
  GET  /                -> index.html
  GET  /api/status      -> controller status + logs
  POST  /api/toggle     -> start / stop automation (browser, mode, apply, etc.)
  GET  /api/browsers    -> list supported browsers
  GET  /api/profile     -> read profile.json
  POST /api/profile     -> save profile.json
  GET  /api/cdp-check   -> check default Chrome remote-debugging port (9222)
"""

import json
import os
import shutil
import socket
import sys
import threading
import urllib.request
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from automation import AutomationController, load_profile, PROFILE_PATH
from drivers.factory import get_driver, BROWSER_LABELS

controller = AutomationController()


def _webui_dir():
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS) / "webui"
    return Path(__file__).resolve().parent / "webui"


WEBUI_DIR = _webui_dir()


def create_app():
    app = Flask(__name__, static_folder=str(WEBUI_DIR), static_url_path="")

    @app.get("/")
    def index():
        return send_from_directory(str(WEBUI_DIR), "index.html")

    @app.get("/api/status")
    def status():
        return jsonify(controller.get_status())

    @app.get("/api/browsers")
    def browsers():
        return jsonify({
            "items": [
                {"key": k, "label": v} for k, v in BROWSER_LABELS.items()
            ],
        })

    @app.post("/api/toggle")
    def toggle():
        data = request.get_json(silent=True) or {}
        action = data.get("action")

        if action == "on":
            url = (data.get("url") or "").strip()
            mode = data.get("mode", "launch")
            browser = data.get("browser", "chromium")
            apply = bool(data.get("apply", False))
            headed = bool(data.get("headed", True))
            user_data_dir = (data.get("user_data_dir") or "").strip()
            cdp_url = (data.get("cdp_url") or "").strip()

            if mode == "connect" and not cdp_url:
                cdp_url = "http://127.0.0.1:9222"

            ok, msg = controller.start(
                url=url,
                apply=apply,
                headed=headed,
                mode=mode,
                browser=browser,
                user_data_dir=user_data_dir,
                cdp_url=cdp_url,
            )
            return jsonify({"ok": ok, "message": msg})

        if action == "off":
            ok, msg = controller.stop()
            return jsonify({"ok": ok, "message": msg})

        return jsonify({"ok": False, "error": "Unknown action"}), 400

    @app.get("/api/profile")
    def profile():
        prof = load_profile()
        return jsonify(prof)

    @app.post("/api/profile")
    def save_profile():
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"ok": False, "error": "Invalid JSON"}), 400
        try:
            with open(PROFILE_PATH, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            return jsonify({"ok": True})
        except Exception as exc:  # noqa: BLE001
            return jsonify({"ok": False, "error": str(exc)}), 500

    @app.get("/api/cdp-check")
    def cdp_check():
        return _probe_cdp("http://127.0.0.1:9222/json/version")

    @app.post("/api/cdp-check")
    def cdp_check_custom():
        data = request.get_json(silent=True) or {}
        cdp_url = (data.get("cdp_url") or "http://127.0.0.1:9222").rstrip("/")
        return _probe_cdp(f"{cdp_url}/json/version")

    return app


def _probe_cdp(url):
    try:
        with urllib.request.urlopen(url, timeout=3) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return jsonify({"ok": True, "cdp": url, "info": data})
    except Exception as exc:  # noqa: BLE001
        return jsonify({"ok": False, "error": str(exc)}), 503


def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _ensure_profile():
    if getattr(sys, "frozen", False):
        example = Path(sys._MEIPASS) / "profile.example.json"
    else:
        example = Path(__file__).resolve().parent.parent / "config" / "profile.example.json"
    if not PROFILE_PATH.exists() and example.exists():
        shutil.copy(example, PROFILE_PATH)


def main():
    _ensure_profile()
    port = int(os.environ.get("PORT", find_free_port()))
    app = create_app()

    server = threading.Thread(
        target=lambda: app.run(host="127.0.0.1", port=port, threaded=True, use_reloader=False),
        daemon=True,
    )
    server.start()

    import time
    import webbrowser

    time.sleep(1.5)
    webbrowser.open(f"http://127.0.0.1:{port}")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
