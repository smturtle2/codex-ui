#!/usr/bin/env python3

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

from playwright.sync_api import BrowserContext, Page, sync_playwright


BASE_URL = os.environ.get("CODEX_UI_BASE_URL", "http://127.0.0.1:3000")
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "docs"


def wait_for_shell(page: Page) -> None:
    page.wait_for_load_state("load")
    page.wait_for_selector(".tui-page")
    page.wait_for_timeout(900)


def open_demo(page: Page) -> None:
    page.goto(f"{BASE_URL}/?demo=1", wait_until="domcontentloaded")
    wait_for_shell(page)


def close_overlay_if_open(page: Page) -> None:
    close_button = page.get_by_role("button", name=re.compile(r"^(Close|닫기)$"))
    if close_button.count() > 0 and close_button.first.is_visible():
        close_button.first.click()
        wait_for_shell(page)


def ensure_output_dir() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def capture_desktop(context: BrowserContext) -> None:
    page = context.new_page()
    page.set_viewport_size({"width": 1440, "height": 1080})

    open_demo(page)
    page.screenshot(path=str(OUTPUT_DIR / "preview-home.png"), full_page=True)

    page.get_by_role("button", name=re.compile(r"^(Settings|설정)$")).first.click()
    wait_for_shell(page)
    page.screenshot(path=str(OUTPUT_DIR / "preview-settings.png"), full_page=True)
    close_overlay_if_open(page)

    page.get_by_role("button", name=re.compile(r"^(Workspace|워크스페이스)$")).first.click()
    wait_for_shell(page)
    page.screenshot(path=str(OUTPUT_DIR / "preview-workspace.png"), full_page=True)
    close_overlay_if_open(page)

    page.get_by_role("button", name=re.compile(r"^(Threads|스레드)")).first.click()
    wait_for_shell(page)
    page.screenshot(path=str(OUTPUT_DIR / "preview-desktop.png"), full_page=True)
    page.close()


def capture_mobile(context: BrowserContext) -> None:
    page = context.new_page()
    page.set_viewport_size({"width": 430, "height": 932})

    open_demo(page)
    page.screenshot(path=str(OUTPUT_DIR / "preview-mobile-home.png"), full_page=True)

    page.get_by_role("button", name=re.compile(r"^(Settings|설정)$")).first.click()
    wait_for_shell(page)
    page.screenshot(path=str(OUTPUT_DIR / "preview-mobile-settings.png"), full_page=True)
    close_overlay_if_open(page)

    page.get_by_role("button", name=re.compile(r"^(Workspace|워크스페이스)$")).first.click()
    wait_for_shell(page)
    page.screenshot(path=str(OUTPUT_DIR / "preview-mobile-workspace.png"), full_page=True)
    close_overlay_if_open(page)

    page.get_by_role("button", name=re.compile(r"^(Threads|스레드)")).first.click()
    wait_for_shell(page)
    page.screenshot(path=str(OUTPUT_DIR / "preview-mobile-chat.png"), full_page=True)
    page.close()


def main() -> int:
    ensure_output_dir()

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(locale="en-US")
        try:
            capture_desktop(context)
            capture_mobile(context)
        finally:
            context.close()
            browser.close()

    print(f"Preview images written to {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # pragma: no cover - CLI failure path
        print(f"Failed to generate preview images: {error}", file=sys.stderr)
        raise SystemExit(1)
