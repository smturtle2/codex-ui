# Codex UI

[English](./README.md) | [한국어](./README.ko.md)

![Next.js](https://img.shields.io/badge/Next.js-16-111111?logo=nextdotjs&labelColor=ffffff)
![WebSocket](https://img.shields.io/badge/Transport-WebSocket-111111?labelColor=ffffff)
![UI](https://img.shields.io/badge/Theme-Black%20%26%20White-111111?labelColor=ffffff)
![Local First](https://img.shields.io/badge/Workflow-Local%20First-111111?labelColor=ffffff)

실제 `codex app-server`를 위한 흑백 transcript 중심 로컬 UI입니다.

`codex-ui`는 Codex를 대시보드처럼 과하게 꾸미지 않고, 터미널에 가까운 작업 흐름을 브라우저로 옮깁니다. 이제 앱은 실제 Home 화면으로 시작하고, 새 thread 생성 전에 workspace를 고를 수 있으며, 모델과 추론 제어는 채팅 입력 흐름 안에 두고, 히스토리에서 불러온 thread와 실시간 출력이 같은 transcript 모양을 유지합니다.

## Preview

| Home | Desktop Chat | Mobile Chat |
| --- | --- | --- |
| ![Home preview](./docs/preview-home.png) | ![Desktop preview](./docs/preview-desktop.png) | ![Mobile preview](./docs/preview-mobile.png) |

## UX Audit

- 앱이 바로 shell로 들어가서 기존 thread를 고르거나 새로 만드는 시작 단계가 분명하지 않았습니다.
- 새 thread 생성 시 workspace를 먼저 정할 수 없었습니다.
- 모바일에서 controls의 존재감이 아직 transcript보다 컸습니다.
- `thread/read`로 불러온 결과와 실시간 file-change 출력이 어긋날 수 있었습니다.
- 빌드가 원격 폰트 fetch에 의존해서 제한 환경에서 깨질 수 있었습니다.

## 이번에 바뀐 점

- Home을 첫 화면으로 두었습니다. 이제 앱을 켜면 바로 thread 선택과 새 thread 시작 흐름이 보입니다.
- 새 thread 생성이 명시적입니다. 최근 workspace 제안과 함께 원하는 workspace를 먼저 정할 수 있습니다.
- 셸을 더 평평하게 만들었습니다. header와 composer는 rail처럼 읽히고, transcript가 데스크톱과 모바일 모두에서 가장 크게 보입니다.
- 세션 제어는 입력 흐름 안에 남겼습니다. `Model`, `Reasoning`, `Language` 는 composer session 메뉴 안에 있고, `Plan` 은 별도 토글로 유지됩니다.
- transcript 정규화를 더 엄격하게 만들었습니다. bootstrap, `thread/read`, live event가 같은 file-change 경로를 써서 불러온 화면과 실시간 화면이 맞춰집니다.
- 타이포는 로컬 친화적으로 바꿨습니다. 빌드 시 Google Fonts fetch에 의존하지 않습니다.

## 설계 원칙

- transcript 우선. 대화면이 가장 크고 가장 읽기 쉬워야 합니다.
- Home 먼저. 앱을 열자마자 thread와 workspace 선택이 분명해야 합니다.
- 채팅 카드 금지. 메시지는 flat transcript row와 역할 라벨, `---` turn 구분으로 읽습니다.
- 흑백만 사용. 색 대신 대비, 간격, 타이포로 구조를 만듭니다.
- 직접 제어. `Model`, `Reasoning`, `Language`, `Plan`을 composer 안에 둡니다.
- 같은 출력 형태 유지. thread를 불러와도, 실시간으로 봐도 transcript 구조가 같아야 합니다.
- 잡음은 숨김. file edit는 기본 접힘이고, 내부 로그성 이벤트는 화면을 지배하지 않게 둡니다.
- 반응형은 축소가 아니라 재구성입니다. 모바일은 별도 구조로 transcript를 보호합니다.

## 핵심 UX

- 기존 thread를 고르거나 workspace를 정해 새 thread를 시작하는 Home 화면
- 새로고침 폴링이 아닌 WebSocket 기반 실시간 업데이트
- user/assistant 메시지를 그룹화한 flat transcript row
- composer session dropdown으로 `Model`, `Reasoning`, `Language` 제어
- 입력 흐름 안에 놓인 `Plan` 토글 버튼
- 스트리밍 중 자동으로 최신 transcript를 따라가는 스크롤
- command, file change, permission, `request_user_input` 를 브라우저 안에서 처리
- workspace 메타데이터와 함께 검색/정렬/재개가 가능한 로컬 thread 목록

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
       └─ bootstrap hydration, thread/read, live delta 를 함께 쓰는 정규화 계층
```

## 빠른 시작

```bash
npm install
npm run dev
```

브라우저에서 `http://127.0.0.1:3000` 을 열면 됩니다.

## 요구사항

- Node.js 20+
- `PATH` 에 있는 `codex`
- 로그인된 로컬 Codex 세션

## 사용 흐름

1. 앱을 시작하면 Home에서 기존 thread를 고르거나, 원하는 workspace로 새 thread를 시작합니다.
2. composer session 메뉴에서 `Model`, `Reasoning`, `Language` 를 정합니다.
3. 다음 turn을 plan collaboration mode로 보내고 싶다면 `Plan` 을 토글합니다.
4. 메시지를 보내고 WebSocket으로 갱신되는 transcript를 그대로 따라갑니다.
5. diff는 필요할 때만 펼치고 approval은 같은 흐름 안에서 처리합니다.

## 개발

```bash
npm run typecheck
npm run build
npm run check
```

## 참고

- Home 목록은 로컬 Codex 세션을 읽기 때문에 다른 워크스페이스의 thread도 보일 수 있습니다.
- 기본 주소는 `127.0.0.1:3000` 입니다.
- 포트를 바꾸려면 `PORT=3001 node --import tsx server/index.ts` 를 사용하면 됩니다.
