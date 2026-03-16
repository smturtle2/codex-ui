#!/usr/bin/env python3

from __future__ import annotations

import argparse
import os
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from playwright.sync_api import Page, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs"
DEFAULT_URL = "http://127.0.0.1:3000"
LANGUAGE_STORAGE_KEY = "codex-ui-language"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Capture README preview screenshots for Codex UI.",
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_URL,
        help=f"Base URL for the running app (default: {DEFAULT_URL}).",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DOCS_DIR),
        help="Directory to write screenshots into.",
    )
    parser.add_argument(
        "--no-server",
        action="store_true",
        help="Do not start `npm run dev` automatically when the app is not running.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=90.0,
        help="Seconds to wait for the app to become reachable.",
    )
    return parser.parse_args()


def server_is_live(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            return 200 <= response.status < 500
    except (urllib.error.URLError, TimeoutError, ValueError):
        return False


def wait_for_server(url: str, timeout: float, process: subprocess.Popen[str] | None) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if server_is_live(url):
            return

        if process is not None and process.poll() is not None:
            raise RuntimeError("`npm run dev` exited before the app became reachable.")

        time.sleep(1)

    raise RuntimeError(f"Timed out waiting for {url}.")


@contextmanager
def ensure_server(url: str, timeout: float, no_server: bool) -> Iterator[None]:
    process: subprocess.Popen[str] | None = None

    if not server_is_live(url):
        if no_server:
            raise RuntimeError(f"{url} is not reachable. Start the app or omit --no-server.")

        process = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.STDOUT,
            text=True,
        )
        wait_for_server(url, timeout, process)

    try:
        yield
    finally:
        if process is None or process.poll() is not None:
            return

        if os.name == "nt":
            process.send_signal(signal.CTRL_BREAK_EVENT)  # type: ignore[attr-defined]
        else:
            process.terminate()

        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()


def prepare_page(page: Page, url: str) -> None:
    page.add_init_script(
        f"window.localStorage.setItem('{LANGUAGE_STORAGE_KEY}', 'system');"
    )
    preview_url = f"{url.rstrip('/')}/?demo=1"
    page.goto(preview_url, wait_until="networkidle")


def close_surface(page: Page) -> None:
    close_button = page.locator(".surface-dialog .plain-action").first
    if close_button.count():
        close_button.click()
        page.wait_for_timeout(200)


def open_chat_from_home(page: Page) -> None:
    thread_rows = page.locator(".home-thread-row")
    if thread_rows.count() > 0:
        thread_rows.first.click()
    else:
        page.locator(".action-button").first.click()

    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(700)


def capture_desktop(page: Page, output_dir: Path) -> None:
    page.screenshot(path=str(output_dir / "preview-home.png"), full_page=True)

    page.locator(".home-header-tools .plain-action").first.click()
    page.wait_for_timeout(300)
    page.screenshot(path=str(output_dir / "preview-settings.png"), full_page=True)
    close_surface(page)

    page.locator(".home-sidebar .home-create-actions .plain-action").first.click()
    page.wait_for_timeout(300)
    page.screenshot(path=str(output_dir / "preview-workspace.png"), full_page=True)
    close_surface(page)

    open_chat_from_home(page)
    page.screenshot(path=str(output_dir / "preview-desktop.png"), full_page=True)


def capture_mobile(page: Page, output_dir: Path) -> None:
    page.screenshot(path=str(output_dir / "preview-mobile-home.png"), full_page=True)

    page.locator(".home-header-tools .plain-action").first.click()
    page.wait_for_timeout(300)
    page.screenshot(path=str(output_dir / "preview-mobile-settings.png"), full_page=True)
    close_surface(page)

    page.locator(".home-mobile-launcher-actions .plain-action").first.click()
    page.wait_for_timeout(300)
    page.screenshot(path=str(output_dir / "preview-mobile-workspace.png"), full_page=True)
    close_surface(page)

    open_chat_from_home(page)
    page.screenshot(path=str(output_dir / "preview-mobile-chat.png"), full_page=True)


def main() -> int:
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    with ensure_server(args.url, args.timeout, args.no_server):
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)

            desktop = browser.new_page(
                viewport={"width": 1440, "height": 1024},
                color_scheme="light",
            )
            prepare_page(desktop, args.url)
            capture_desktop(desktop, output_dir)

            mobile = browser.new_page(
                viewport={"width": 393, "height": 852},
                is_mobile=True,
                has_touch=True,
                color_scheme="light",
            )
            prepare_page(mobile, args.url)
            capture_mobile(mobile, output_dir)

            browser.close()

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
