# Codex UI

[English](./README.md) | [한국어](./README.ko.md)

![Next.js](https://img.shields.io/badge/Next.js-16-111111?logo=nextdotjs&labelColor=ffffff)
![WebSocket](https://img.shields.io/badge/Transport-WebSocket-111111?labelColor=ffffff)
![UI](https://img.shields.io/badge/Theme-Black%20%26%20White-111111?labelColor=ffffff)
![Workflow](https://img.shields.io/badge/Workflow-Transcript%20First-111111?labelColor=ffffff)

실제 `codex app-server`를 위한 흑백 transcript 중심 로컬 UI입니다.

`codex-ui`는 Codex를 대시보드처럼 과하게 포장하지 않고, 터미널에 가까운 흐름을 브라우저로 옮깁니다. Home에서 시작해 새 thread용 workspace 선택과 기존 thread 전환을 같은 런처 안에 두고, 모바일에서는 그 흐름을 세로로 재배치하며, `Model`, `Reasoning`, `Fast`, `Plan` 제어는 모두 채팅 composer 안에 유지하고, 언어는 별도 설정 패널로 분리하며, WebSocket으로 revision 스냅샷을 스트리밍해 오래된 클라이언트 상태는 재시도 루프 대신 무시합니다.

상세 변경 내역은 [RELEASE_NOTES.md](./RELEASE_NOTES.md)에 정리했습니다.

## Preview

### Desktop

<table>
  <tr>
    <td align="center"><strong>Home</strong></td>
    <td align="center"><strong>Settings</strong></td>
  </tr>
  <tr>
    <td><img src="./docs/preview-home.png" alt="Home preview" width="100%" /></td>
    <td><img src="./docs/preview-settings.png" alt="Settings preview" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Workspace Picker</strong></td>
    <td align="center"><strong>Desktop Chat</strong></td>
  </tr>
  <tr>
    <td><img src="./docs/preview-workspace.png" alt="Workspace picker preview" width="100%" /></td>
    <td><img src="./docs/preview-desktop.png" alt="Desktop chat preview" width="100%" /></td>
  </tr>
</table>

### Mobile

<table>
  <tr>
    <td align="center"><strong>Home</strong></td>
    <td align="center"><strong>Settings</strong></td>
  </tr>
  <tr>
    <td><img src="./docs/preview-mobile-home.png" alt="Mobile home preview" width="100%" /></td>
    <td><img src="./docs/preview-mobile-settings.png" alt="Mobile settings preview" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Workspace Picker</strong></td>
    <td align="center"><strong>Chat</strong></td>
  </tr>
  <tr>
    <td><img src="./docs/preview-mobile-workspace.png" alt="Mobile workspace picker preview" width="100%" /></td>
    <td><img src="./docs/preview-mobile-chat.png" alt="Mobile chat preview" width="100%" /></td>
  </tr>
</table>

## 핵심 특징

- 런처 중심 시작 흐름: Home에서 workspace 선택과 thread 전환을 함께 처리하고, 모바일에서도 한 화면 안에서 세로로 자연스럽게 이어집니다.
- transcript 중심 채팅: 메시지는 카드 없이 평평하게 유지하고, 편집된 내용은 기본 접힘 상태로 두며, 모바일 헤더와 composer 높이를 줄여 transcript를 가장 크게 확보합니다.
- composer 안의 세션 제어: `Model`, `Reasoning`은 드롭다운으로 유지하고, `Fast`, `Plan`은 서로 보이는 독립 on/off 토글로 노출합니다.
- 전용 설정 패널: 인터페이스 언어는 composer나 런처가 아니라 별도 settings surface에서 관리합니다.
- 전용 workspace picker: 새 thread는 디렉토리 브라우저로 시작하고, 서버도 선택된 workspace를 검증한 뒤 thread를 생성합니다.
- 실시간 일관성: bootstrap, `thread/read`, 수동 액션, live streaming이 같은 transcript 구조로 합쳐지고, live diff/plan은 canonical thread read를 통해 다시 맞춰집니다.
- 빈 thread 유지: 새 thread를 만든 직후 첫 메시지를 보내기 전에도 `No active session`으로 되돌아가지 않고 현재 thread를 유지합니다.
- 수동 재연결만 허용: websocket은 재연결 루프를 돌지 않고, 끊기면 명시적인 reconnect 액션만 노출합니다.
- Funnel 한 줄 실행: `npm run up --funnel` 한 번으로 앱 실행, Tailscale Funnel 활성화, 외부 공개 URL 출력까지 이어집니다.
- deterministic preview: `python scripts/generate_preview_images.py`가 `/?demo=1` 기준으로 README 스크린샷을 다시 생성합니다.

## 아키텍처

```text
Browser UI
  ├─ Next.js app router shell
  ├─ WebSocket snapshot stream (/ws)
  └─ HTTP actions (/api/*)

Local bridge
  ├─ server/index.ts
  └─ server/codex-bridge.ts
       ├─ codex app-server over stdio JSON-RPC
       └─ bootstrap, thread/read, live delta를 함께 쓰는 정규화 계층
```

## 요구사항

- Node.js 20+
- `PATH`에 있는 `codex`
- 로그인된 로컬 Codex 세션
- `--funnel` 사용 시: `tailscale`, `bash`, `python`, `curl`

## 빠른 시작

```bash
npm run up
```

브라우저에서 `http://127.0.0.1:3000`을 열면 됩니다.

## 외부 접속

Tailscale Funnel로 로컬 UI를 한 줄로 외부에 공개할 수 있습니다.

```bash
npm run up --funnel
```

- `--funnel`은 `npm run dev --funnel`, `npm run start --funnel`에서도 동일하게 사용할 수 있습니다.
- `npm run up --funnel`은 의존성 설치, 로컬 서버 실행, repo-local Funnel helper 실행까지 한 번에 처리합니다.
- 성공하면 helper가 `Public URL: https://...` 형식으로 외부 주소를 바로 출력합니다.
- 현재 tailnet 노드에 Funnel이 아직 활성화되지 않았다면 helper가 바로 enable URL을 출력합니다.
- `Access denied: serve config denied`가 보이면 tailnet 승인 문제는 끝났고, 현재 로컬 사용자에게 Tailscale serve config를 바꿀 권한이 없는 상태입니다. `sudo tailscale set --operator=$USER`를 한 번 실행하거나, `sudo tailscale funnel --bg --yes 3000`을 직접 실행하세요.
- Funnel 설정이 실패해도 로컬 앱은 `http://127.0.0.1:3000`에서 계속 실행되고, 외부 공개 단계만 실패합니다.
- `npm run funnel:status`로 현재 Funnel 매핑을 확인할 수 있습니다.
- `npm run funnel:off`로 이 노드의 Funnel 설정을 초기화할 수 있습니다.

참고 문서:
- [Tailscale Funnel docs](https://tailscale.com/kb/1223/tailscale-funnel/)
- [Tailscale CLI funnel reference](https://tailscale.com/docs/reference/tailscale-cli/funnel)

## 개발

```bash
npm run typecheck
npm run build
npm run check
python -m pip install playwright
python -m playwright install chromium
python scripts/generate_preview_images.py
```

`python scripts/generate_preview_images.py`를 실행하면 README에 쓰는 데스크톱/모바일 스크린샷 세트를 다시 생성합니다.
이 스크립트는 `/?demo=1`을 열기 때문에 실제 로컬 transcript 내용에 영향받지 않고 같은 preview 자산을 다시 만들 수 있습니다.
