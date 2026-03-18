# WebPty

[English](./README.md) | [한국어](./README.ko.md)

![Rust](https://img.shields.io/badge/Runtime-Rust-111111?logo=rust&labelColor=ffffff)
![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-111111?logo=nextdotjs&labelColor=ffffff)
![Theme](https://img.shields.io/badge/Theme-Windows%2011%20Terminal-111111?labelColor=ffffff)
![Config](https://img.shields.io/badge/Config-Windows%20Terminal%20JSON-111111?labelColor=ffffff)

`webpty`는 Rust 런타임, 우측 좁은 탭 레일, 전체 화면 검은 터미널 본체, Windows Terminal 호환 `settings.json` 편집을 갖춘 Codex 셸입니다.

기본 UI는 평평한 흑백으로 고정됩니다. 터미널 본체는 검은색, 우측 탭은 흰색, 상단 바는 없고, 기본 폰트는 `Cascadia Mono`입니다. 설정은 우측 Settings 탭에서 열고, Windows Terminal 형태의 JSON 파일로 저장합니다.

상세 변경 내역은 [RELEASE_NOTES.md](./RELEASE_NOTES.md)에 정리했습니다.

## Preview

### Desktop

<table>
  <tr>
    <td align="center"><strong>Shell</strong></td>
    <td align="center"><strong>Settings</strong></td>
  </tr>
  <tr>
    <td><img src="./docs/preview-home.png" alt="Shell preview" width="100%" /></td>
    <td><img src="./docs/preview-settings.png" alt="Settings preview" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Workspace</strong></td>
    <td align="center"><strong>Threads</strong></td>
  </tr>
  <tr>
    <td><img src="./docs/preview-workspace.png" alt="Workspace preview" width="100%" /></td>
    <td><img src="./docs/preview-desktop.png" alt="Threads preview" width="100%" /></td>
  </tr>
</table>

### Mobile

<table>
  <tr>
    <td align="center"><strong>Shell</strong></td>
    <td align="center"><strong>Settings</strong></td>
  </tr>
  <tr>
    <td><img src="./docs/preview-mobile-home.png" alt="Mobile shell preview" width="100%" /></td>
    <td><img src="./docs/preview-mobile-settings.png" alt="Mobile settings preview" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Workspace</strong></td>
    <td align="center"><strong>Threads</strong></td>
  </tr>
  <tr>
    <td><img src="./docs/preview-mobile-workspace.png" alt="Mobile workspace preview" width="100%" /></td>
    <td><img src="./docs/preview-mobile-chat.png" alt="Mobile threads preview" width="100%" /></td>
  </tr>
</table>

## 핵심 특징

- Rust 엔트리포인트: 기본 실행 경로는 `webpty up`입니다.
- Windows Terminal 스타일 셸: 상단 바 없이 전체 화면 transcript와 우측 좁은 탭 레일을 사용합니다.
- Windows Terminal JSON 설정: `defaultProfile`, `profiles`, `schemes`, `theme`, `themes` 구조를 Settings 탭에서 다룹니다.
- 기본 시각 규약: 검은 터미널 본체, 흰 탭 레일, 평평한 보더, `Cascadia Mono`.
- Tailscale Funnel: `webpty up --funnel` 한 줄로 외부 공개를 시도합니다.
- 워크스페이스 중심 thread 시작: 새 thread는 여전히 디렉토리 브라우징과 검증을 거친 뒤 시작합니다.
- 정적 프런트 번들: Next.js 셸을 `out/`으로 export해서 Rust 런타임이 직접 서빙합니다.

## 아키텍처

```text
Browser UI
  ├─ static Next.js export (out/)
  ├─ HTTP actions (/api/*)
  └─ WebSocket snapshots (/ws)

Rust runtime
  ├─ webpty up
  ├─ static frontend 서빙
  ├─ Funnel 시작 처리
  └─ /api/*, /ws 를 로컬 legacy bridge로 프록시

Legacy bridge
  ├─ server/legacy-bridge.ts
  └─ server/codex-bridge.ts
       ├─ codex app-server stdio JSON-RPC
       └─ thread, turn, approval, live delta 스냅샷 정규화
```

## 요구사항

- Rust toolchain (`cargo`)
- Node.js 20+
- `PATH`에 있는 `codex`
- 로그인된 로컬 Codex 세션
- `--funnel` 사용 시 `tailscale`

## 글로벌 설치

한 줄로 전역 설치:

```bash
cargo install --git https://github.com/smturtle2/codex-ui webpty
```

로컬 clone에서 바로 설치하려면:

```bash
cargo install --path .
```

## 빠른 시작

```bash
webpty up
```

브라우저에서 `http://127.0.0.1:3000`을 열면 됩니다.

## 외부 접속

Tailscale Funnel로 로컬 셸을 외부에 공개:

```bash
webpty up --funnel
```

- Funnel이 성공하면 런타임이 외부 URL을 출력합니다.
- Funnel이 실패해도 로컬 셸은 계속 살아 있고 공개 단계만 실패합니다.
- 현재 노드에 Funnel이 아직 켜져 있지 않으면 `webpty`가 enable URL을 출력합니다.
- 로컬 사용자가 serve config를 바꿀 권한이 없으면 `sudo tailscale set --operator=$USER`를 한 번 실행하거나, 권한 있는 사용자로 Funnel을 실행하세요.

참고:
- [Tailscale Funnel docs](https://tailscale.com/kb/1223/tailscale-funnel/)
- [Tailscale CLI funnel reference](https://tailscale.com/docs/reference/tailscale-cli/funnel)

## 개발

```bash
npm run typecheck
npm run build
cargo check
cargo run -- up --port 3000
python scripts/generate_preview_images.py
```

`npm run build`는 프런트를 `out/`으로 export하고, `cargo run -- up`은 그 결과를 Rust 런타임으로 서빙합니다.

`python scripts/generate_preview_images.py`는 `/?demo=1` 기준으로 `docs/` 스크린샷을 갱신합니다.
