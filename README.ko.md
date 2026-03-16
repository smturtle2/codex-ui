# Codex UI

[English](./README.md) | [한국어](./README.ko.md)

![Next.js](https://img.shields.io/badge/Next.js-16-111111?logo=nextdotjs&labelColor=ffffff)
![WebSocket](https://img.shields.io/badge/Transport-WebSocket-111111?labelColor=ffffff)
![UI](https://img.shields.io/badge/Theme-Black%20%26%20White-111111?labelColor=ffffff)
![Local First](https://img.shields.io/badge/Workflow-Local%20First-111111?labelColor=ffffff)

실제 `codex app-server`를 위한 흑백 transcript 중심 로컬 UI입니다.

`codex-ui`는 Codex를 대시보드처럼 과하게 꾸미지 않고, 터미널에 가까운 작업 흐름을 브라우저로 옮깁니다. 흰 배경, 검은 타이포, 얇은 rail, composer 안의 직접 제어, WebSocket 실시간 갱신, 기본 접힘 diff, 그리고 데스크톱과 모바일 모두에서 transcript가 가장 크게 보이는 구조만 남겼습니다.

## Preview

| Desktop | Mobile |
| --- | --- |
| ![Desktop preview](./docs/preview-desktop.png) | ![Mobile preview](./docs/preview-mobile.png) |

## UX Audit

- 기존 composer가 하단 카드처럼 보여서 transcript-first 인상이 약했습니다.
- 모바일도 동작은 했지만, session controls보다 대화 영역이 더 강하게 우선되어야 했습니다.
- 폰트가 로컬 환경 스택에 의존하고 있어서 한/영 혼용 시 일관성이 보장되지 않았습니다.
- bootstrap hydration, `thread/read`, live delta가 항상 같은 transcript 모양을 유지해야 했습니다.

## 이번에 바뀐 점

- 셸을 더 평평하게 만들었습니다. header와 composer가 카드 더미처럼 보이지 않고 rail처럼 읽히도록 정리했습니다.
- 모바일을 더 적응형으로 바꿨습니다. session controls는 compact summary row로 접고, transcript가 세로 공간을 더 많이 차지합니다.
- `next/font`로 `IBM Plex Sans KR`와 `IBM Plex Mono`를 실제 로드해서 한/영 혼용 렌더링을 안정화했습니다.
- `Model`, `Reasoning`, `Language`, `Plan`은 그대로 composer 안에서 바로 제어할 수 있게 유지했습니다.
- bootstrap, `thread/read`, live delta를 같은 정규화 경로에 두어 thread를 다시 열어도 출력 모양이 어긋나지 않게 했습니다.
- diff는 기본 접힘, reasoning/plan 흔적은 저잡음 유지, 런타임 잡음은 숨김으로 두어 실제 대화가 앞에 오게 했습니다.

## 설계 원칙

- transcript 우선. 대화면이 가장 크고 가장 읽기 쉬워야 합니다.
- 채팅 카드 금지. 메시지는 flat transcript row와 역할 라벨, `---` turn 구분으로 읽습니다.
- 흑백만 사용. 색 대신 대비, 간격, 타이포로 구조를 만듭니다.
- 직접 제어. `Model`, `Reasoning`, `Language`, `Plan`을 composer 안에 둡니다.
- 같은 출력 형태 유지. thread를 불러와도, 실시간으로 봐도 transcript 구조가 같아야 합니다.
- 잡음은 숨김. file edit는 기본 접힘이고, 내부 로그성 이벤트는 화면을 지배하지 않게 둡니다.
- 반응형은 축소가 아니라 재구성입니다. 모바일은 별도 구조로 transcript를 보호합니다.

## 핵심 UX

- 새로고침 폴링이 아닌 WebSocket 기반 실시간 업데이트
- user/assistant 메시지를 그룹화한 flat transcript row
- composer 안의 직접 드롭다운으로 `Model`, `Reasoning`, `Language` 제어
- 입력 흐름 안에 놓인 `Plan` 토글 버튼
- 스트리밍 중 자동으로 최신 transcript를 따라가는 스크롤
- command, file change, permission, `request_user_input` 를 브라우저 안에서 처리
- 검색, 정렬, 재개, 새 thread 생성을 포함한 로컬 thread drawer

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

1. 앱을 시작하고 `Threads` 에서 기존 thread를 열거나 새로 만듭니다.
2. composer 제어줄에서 `Model`, `Reasoning`, `Language` 를 바로 선택합니다.
3. 다음 turn을 plan collaboration mode로 보내고 싶다면 `Plan` 버튼을 토글합니다.
4. 메시지를 보내고 WebSocket으로 갱신되는 transcript를 그대로 따라갑니다.
5. 필요할 때만 `Status` 와 `Shortcuts` 를 열고, transcript는 메인 화면에 그대로 둡니다.
6. diff는 필요할 때만 펼치고 approval은 같은 흐름 안에서 처리합니다.

## 개발

```bash
npm run typecheck
npm run build
npm run check
```

## 참고

- thread drawer는 로컬 Codex 세션을 읽기 때문에 다른 워크스페이스의 thread도 보일 수 있습니다.
- 기본 주소는 `127.0.0.1:3000` 입니다.
- 포트를 바꾸려면 `PORT=3001 node --import tsx server/index.ts` 를 사용하면 됩니다.
