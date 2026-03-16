from __future__ import annotations

import os
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
BASE_URL = os.environ.get("UI_BASE_URL", "http://127.0.0.1:3000")
PROMPT = os.environ.get("UI_PREVIEW_PROMPT", "Reply with exactly OK.")


def wait_for_server(timeout_seconds: int = 30) -> None:
    deadline = time.time() + timeout_seconds
    last_error: Exception | None = None

    while time.time() < deadline:
        try:
            with urlopen(BASE_URL, timeout=2):
                return
        except URLError as exc:
            last_error = exc
            time.sleep(0.5)

    raise RuntimeError(f"UI server did not respond at {BASE_URL}") from last_error


def wait_for_reply(page) -> None:
    try:
        page.wait_for_function(
            """
            () => {
              const assistantReady = Array.from(
                document.querySelectorAll('.history-message-group.role-assistant .history-message-line')
              ).some((node) => node.textContent?.trim() === 'OK');
              const interruptVisible = Array.from(document.querySelectorAll('button')).some(
                (node) => node.textContent?.trim() === 'Interrupt'
              );
              return assistantReady && !interruptVisible;
            }
            """,
            timeout=60000,
        )
    except PlaywrightTimeoutError:
        page.wait_for_timeout(3000)


def open_chat_preview(page) -> None:
    thread_rows = page.locator(".home-thread-row")
    thread_count = thread_rows.count()

    if thread_count > 0:
        target_index = 1 if thread_count > 1 else 0
        thread_rows.nth(target_index).click()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(800)
        return

    page.get_by_role("button", name="Start thread").click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(900)

    composer = page.locator("textarea")
    composer.fill(PROMPT)
    page.get_by_role("button", name="Send").click()
    wait_for_reply(page)
    page.wait_for_timeout(800)


def capture_desktop(browser) -> None:
    page = browser.new_page(viewport={"width": 1440, "height": 960})
    page.goto(BASE_URL, wait_until="networkidle")

    page.screenshot(path=str(DOCS / "preview-home.png"), full_page=True)

    page.get_by_role("button", name="Settings").click()
    page.wait_for_timeout(400)
    page.screenshot(path=str(DOCS / "preview-settings.png"), full_page=True)
    page.get_by_role("button", name="Close").click()

    page.get_by_role("button", name="Choose directory").click()
    page.wait_for_timeout(700)
    page.screenshot(path=str(DOCS / "preview-workspace.png"), full_page=True)
    page.get_by_role("button", name="Close").click()

    open_chat_preview(page)
    page.screenshot(path=str(DOCS / "preview-desktop.png"), full_page=True)
    page.close()


def capture_mobile(browser) -> None:
    page = browser.new_page(
        viewport={"width": 393, "height": 852},
        is_mobile=True,
        has_touch=True,
    )
    page.goto(BASE_URL, wait_until="networkidle")
    page.screenshot(path=str(DOCS / "preview-mobile-home.png"), full_page=True)

    page.get_by_role("button", name="Settings").click()
    page.wait_for_timeout(400)
    page.screenshot(path=str(DOCS / "preview-mobile-settings.png"), full_page=True)
    page.get_by_role("button", name="Close").click()

    page.get_by_role("button", name="Choose directory").click()
    page.wait_for_timeout(700)
    page.screenshot(path=str(DOCS / "preview-mobile-workspace.png"), full_page=True)
    page.get_by_role("button", name="Close").click()

    open_chat_preview(page)
    page.screenshot(path=str(DOCS / "preview-mobile-chat.png"), full_page=True)
    page.close()


def main() -> None:
    DOCS.mkdir(parents=True, exist_ok=True)
    wait_for_server()

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            capture_desktop(browser)
            capture_mobile(browser)
        finally:
            browser.close()


if __name__ == "__main__":
    main()
