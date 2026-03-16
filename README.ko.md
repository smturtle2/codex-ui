# Codex UI

[English](./README.md) | [한국어](./README.ko.md)

![Next.js](https://img.shields.io/badge/Next.js-16-111111?logo=nextdotjs&labelColor=ffffff)
![WebSocket](https://img.shields.io/badge/Transport-WebSocket-111111?labelColor=ffffff)
![UI](https://img.shields.io/badge/Theme-Black%20%26%20White-111111?labelColor=ffffff)
![Workflow](https://img.shields.io/badge/Workflow-Transcript%20First-111111?labelColor=ffffff)

실제 `codex app-server`를 위한 흑백 transcript 중심 로컬 UI입니다.

`codex-ui`는 Codex를 대시보드처럼 과하게 포장하지 않고, 터미널에 가까운 흐름을 브라우저로 옮깁니다. 런처 화면에서 시작하고, 새 thread를 만들기 전에 workspace를 고를 수 있으며, `Model`, `Reasoning`, `Plan`은 채팅 입력부에 두고, 언어는 별도 설정 패널로 분리하며, WebSocket 스트리밍과 히스토리 로딩이 같은 transcript 구조를 유지합니다.

상세 변경 내역은 [RELEASE_NOTES.md](./RELEASE_NOTES.md)에 정리했습니다.

## Preview

| Home | Settings |
| --- | --- |
| ![Home preview](./docs/preview-home.png) | ![Settings preview](./docs/preview-settings.png) |

| Workspace Picker | Desktop Chat |
| --- | --- |
| ![Workspace picker preview](./docs/preview-workspace.png) | ![Desktop chat preview](./docs/preview-desktop.png) |

![Mobile chat preview](./docs/preview-mobile.png)

## 핵심 특징

- 런처 우선 흐름: 전용 홈 화면에서 기존 thread를 열거나 새 thread를 시작합니다.
- 전용 workspace picker: 경로를 직접 입력하지 않고 디렉토리를 탐색해서 선택합니다.
- transcript 우선 셸: 채팅 영역이 가장 크게 보이고, 메시지는 flat row로 유지되며, turn은 `---`로만 구분합니다.
- 직접 세션 제어: `Model`, `Reasoning`, `Plan`을 composer 안에서 바로 바꿉니다.
- 전용 설정 패널: 언어 설정은 채팅 입력부가 아니라 별도 settings surface에서 관리합니다.
- 실시간 일관성: bootstrap, `thread/read`, live streaming이 같은 transcript 구조로 정규화됩니다.
- 모바일 재구성: 홈에서는 thread 목록을 먼저 보여주고, 채팅에서는 transcript 영역을 가장 크게 남깁니다.

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

## 빠른 시작

```bash
npm install
npm run dev
```

브라우저에서 `http://127.0.0.1:3000`을 열면 됩니다.

## 개발

```bash
npm run typecheck
npm run build
npm run check
```
