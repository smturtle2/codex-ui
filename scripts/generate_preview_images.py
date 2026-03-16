from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"

BG = "#fcfcfc"
PANEL = "#ffffff"
SOFT = "#fafafa"
LINE = "#e4e4e4"
TEXT = "#111111"
MUTED = "#676767"
SOFT_TEXT = "#8a8a8a"
INVERSE = "#ffffff"


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size)


SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"


def rounded(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, **kwargs) -> None:
    draw.rounded_rectangle(box, radius=radius, **kwargs)


def line(draw: ImageDraw.ImageDraw, points: Iterable[tuple[int, int]], width: int = 1, fill: str = LINE) -> None:
    draw.line(list(points), fill=fill, width=width)


def text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    value: str,
    *,
    font: ImageFont.FreeTypeFont,
    fill: str = TEXT,
    anchor: str = "la",
) -> None:
    draw.text(xy, value, font=font, fill=fill, anchor=anchor)


def wrapped(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    value: str,
    *,
    font: ImageFont.FreeTypeFont,
    fill: str = TEXT,
    width: int,
    line_height: int,
) -> int:
    words = value.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if draw.textlength(candidate, font=font) <= width:
            current = candidate
            continue
        lines.append(current)
        current = word
    if current:
      lines.append(current)

    x, y = xy
    for index, entry in enumerate(lines):
      draw.text((x, y + index * line_height), entry, font=font, fill=fill)
    return y + len(lines) * line_height


def desktop_preview() -> None:
    img = Image.new("RGB", (1440, 900), BG)
    draw = ImageDraw.Draw(img)

    rounded(draw, (16, 16, 1424, 884), 26, fill=PANEL, outline=LINE, width=1)
    line(draw, ((36, 150), (1404, 150)), fill=LINE)

    mono_12 = load_font(MONO, 12)
    mono_14 = load_font(MONO, 14)
    mono_18 = load_font(MONO, 18)
    sans_16 = load_font(SANS, 16)
    sans_18 = load_font(SANS, 18)
    serif_26 = load_font(SERIF, 26)
    serif_32 = load_font(SERIF, 32)

    text(draw, (54, 54), "Local-first Codex UI", font=mono_14, fill=SOFT_TEXT)
    text(draw, (54, 94), "Choose a thread or start a clean one.", font=serif_32)
    wrapped(
        draw,
        (54, 134),
        "Home stays minimal: pick an existing thread, set the workspace for a new one, then drop into the transcript.",
        font=sans_16,
        fill=MUTED,
        width=640,
        line_height=26,
    )

    rounded(draw, (1146, 52, 1260, 92), 20, fill=SOFT, outline=LINE)
    text(draw, (1166, 66), "LANGUAGE", font=mono_12, fill=SOFT_TEXT)
    text(draw, (1166, 84), "English", font=sans_16)
    text(draw, (1242, 84), "v", font=mono_14, anchor="ra")

    rounded(draw, (1280, 52, 1386, 92), 20, fill=PANEL, outline=TEXT)
    text(draw, (1333, 73), "READY", font=mono_14, anchor="ma")

    line(draw, ((404, 184), (404, 846)), fill=LINE)

    text(draw, (54, 186), "New thread", font=mono_14, fill=SOFT_TEXT)
    text(draw, (54, 220), "New thread", font=serif_26)
    wrapped(
        draw,
        (54, 250),
        "Set the workspace here. Model and reasoning stay in the chat input once the thread opens.",
        font=sans_16,
        fill=MUTED,
        width=300,
        line_height=24,
    )

    text(draw, (54, 338), "WORKSPACE", font=mono_12, fill=SOFT_TEXT)
    rounded(draw, (54, 354, 362, 404), 12, fill=SOFT, outline=LINE)
    text(draw, (72, 382), "/mnt/s/ProjectForFast/codex-ui", font=sans_16, anchor="lm")

    wrapped(
        draw,
        (54, 430),
        "Recent workspaces appear as suggestions. Leave this as the current workspace if you want the project you launched from.",
        font=sans_16,
        fill=MUTED,
        width=300,
        line_height=24,
    )

    rounded(draw, (54, 534, 210, 574), 20, fill=PANEL, outline=LINE)
    text(draw, (132, 554), "Use current workspace", font=sans_16, anchor="mm")
    rounded(draw, (220, 534, 362, 574), 20, fill=TEXT)
    text(draw, (291, 554), "Start thread", font=sans_16, fill=INVERSE, anchor="mm")

    line(draw, ((54, 626), (362, 626)), fill=LINE)
    text(draw, (54, 654), "Current session", font=mono_14, fill=SOFT_TEXT)
    text(draw, (54, 686), "gpt-5.4 / medium / English", font=serif_26)
    text(draw, (54, 720), "Plan off", font=sans_16, fill=MUTED)
    text(draw, (54, 748), "/mnt/s/ProjectForFast/codex-ui", font=sans_16, fill=MUTED)

    rounded(draw, (432, 186, 1008, 236), 12, fill=SOFT, outline=LINE)
    text(draw, (452, 212), "Search by title, workspace, branch, or source", font=sans_16, fill=SOFT_TEXT, anchor="lm")
    rounded(draw, (1024, 186, 1138, 236), 20, fill=SOFT, outline=TEXT)
    text(draw, (1081, 212), "Recent", font=sans_16, anchor="mm")
    rounded(draw, (1152, 186, 1264, 236), 20, fill=PANEL, outline=LINE)
    text(draw, (1208, 212), "Created", font=sans_16, fill=MUTED, anchor="mm")

    line(draw, ((432, 266), (1388, 266)), fill=TEXT)
    text(draw, (432, 292), "26 threads", font=mono_14, fill=SOFT_TEXT)

    rows = [
        ("Current thread", "codex-ui · landing + workspace flow", "/mnt/s/ProjectForFast/codex-ui", "main · active · CLI", "just now", True),
        ("25 threads", "ws transcript parity audit", "/mnt/s/ProjectForFast/codex-ui", "main · idle · App Server", "8m ago", False),
        ("", "mobile transcript spacing review", "/mnt/s/ProjectForFast/codex-mobile", "feature/mobile · idle · VS Code", "32m ago", False),
        ("", "agent diff folding regression", "/mnt/s/ProjectForFast/agent-bridge", "fix/diff-summary · system error · Exec", "2h ago", False),
        ("", "readme screenshot refresh", "/mnt/s/ProjectForFast/codex-ui", "docs/preview · idle · CLI", "1d ago", False),
    ]

    y = 332
    for group, title_text, path, meta, age, current in rows:
        if group:
            text(draw, (432, y), group, font=mono_14, fill=SOFT_TEXT)
            y += 18

        line(draw, ((432, y + 20), (1388, y + 20)), fill=TEXT if current else LINE)
        text(draw, (432, y + 48), title_text, font=serif_26)
        text(draw, (1328, y + 48), age, font=mono_14, fill=SOFT_TEXT, anchor="ra")
        text(draw, (432, y + 82), path, font=sans_16, fill=MUTED)
        text(draw, (432, y + 108), meta, font=sans_16, fill=MUTED)
        text(draw, (1388, y + 84), "Open", font=mono_14, fill=SOFT_TEXT, anchor="ra")
        y += 132

    img.save(DOCS / "preview-desktop.png")


def mobile_preview() -> None:
    img = Image.new("RGB", (780, 1688), BG)
    draw = ImageDraw.Draw(img)

    rounded(draw, (14, 14, 766, 1674), 34, fill=PANEL, outline=LINE, width=1)

    mono_16 = load_font(MONO, 16)
    mono_18 = load_font(MONO, 18)
    mono_22 = load_font(MONO, 22)
    sans_24 = load_font(SANS, 24)
    serif_30 = load_font(SERIF, 30)

    rounded(draw, (34, 34, 178, 84), 24, fill=SOFT, outline=LINE)
    text(draw, (58, 64), "Home", font=mono_18, anchor="lm")
    text(draw, (138, 64), "26", font=mono_18, fill=SOFT_TEXT, anchor="lm")
    rounded(draw, (598, 34, 736, 84), 24, fill=PANEL, outline=TEXT)
    text(draw, (667, 60), "WORKING", font=mono_16, anchor="mm")

    text(draw, (38, 126), "codex-ui · landing + workspace flow", font=serif_30)
    text(draw, (38, 164), "codex-ui · main · active", font=sans_24, fill=MUTED)
    line(draw, ((34, 196), (746, 196)), fill=LINE)

    y = 232
    text(draw, (390, y), "---", font=mono_22, fill=SOFT_TEXT, anchor="ma")
    y += 62

    text(draw, (38, y), "You", font=mono_18)
    y += 38
    y = wrapped(
        draw,
        (38, y),
        "Audit the current UI and turn it into a transcript-first shell with a real home screen.",
        font=serif_30,
        width=690,
        line_height=42,
    ) + 30

    text(draw, (38, y), "Codex running", font=mono_18)
    text(draw, (742, y), "running", font=mono_18, fill=SOFT_TEXT, anchor="ra")
    y += 38
    y = wrapped(
        draw,
        (38, y),
        "Home first. Workspace-aware thread start. Hidden diffs. Monochrome transcript. Mobile keeps the chat dominant.",
        font=serif_30,
        width=690,
        line_height=42,
    ) + 38

    line(draw, ((38, y), (742, y)), fill=LINE)
    y += 34
    text(draw, (38, y), "Diff", font=mono_18)
    text(draw, (742, y), "Show diff", font=mono_18, anchor="ra")
    y += 38
    text(draw, (38, y), "Edited content hidden · 3 files", font=sans_24, fill=MUTED)
    y += 64

    text(draw, (390, y), "---", font=mono_22, fill=SOFT_TEXT, anchor="ma")
    y += 62

    text(draw, (38, y), "You", font=mono_18)
    y += 38
    y = wrapped(
        draw,
        (38, y),
        "Keep plan mode togglable and let me switch model, reasoning, and language from the input area.",
        font=serif_30,
        width=690,
        line_height=42,
    ) + 30

    text(draw, (38, y), "Codex", font=mono_18)
    y += 38
    wrapped(
        draw,
        (38, y),
        "Those controls stay in the composer. The transcript remains flat, auto-scrolls live, and nothing turns into chat cards.",
        font=serif_30,
        width=690,
        line_height=42,
    )

    composer_top = 1240
    line(draw, ((34, composer_top), (746, composer_top)), fill=TEXT)

    rounded(draw, (34, composer_top + 24, 564, composer_top + 88), 18, fill=SOFT, outline=LINE)
    text(draw, (58, composer_top + 48), "SESSION", font=mono_16, fill=SOFT_TEXT)
    text(draw, (58, composer_top + 72), "gpt-5.4 / medium / English", font=sans_24)
    text(draw, (536, composer_top + 72), "v", font=mono_18, anchor="ra")

    rounded(draw, (582, composer_top + 24, 746, composer_top + 88), 18, fill=TEXT)
    text(draw, (610, composer_top + 48), "PLAN", font=mono_16, fill=INVERSE)
    text(draw, (706, composer_top + 72), "On", font=mono_18, fill=INVERSE, anchor="ra")

    text(draw, (34, composer_top + 150), "Polish the README screenshots next.", font=serif_30, fill=SOFT_TEXT)
    text(draw, (34, composer_top + 226), "Working", font=mono_16)
    text(draw, (34, composer_top + 258), "Streaming live. Diffs stay folded until opened.", font=sans_24, fill=MUTED)

    rounded(draw, (34, composer_top + 294, 228, composer_top + 350), 22, fill=PANEL, outline=LINE)
    text(draw, (131, composer_top + 322), "Interrupt", font=sans_24, anchor="mm")
    rounded(draw, (554, composer_top + 294, 746, composer_top + 350), 22, fill=TEXT)
    text(draw, (650, composer_top + 322), "Send", font=sans_24, fill=INVERSE, anchor="mm")

    img.save(DOCS / "preview-mobile.png")


if __name__ == "__main__":
    desktop_preview()
    mobile_preview()
