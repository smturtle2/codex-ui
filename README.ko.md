# Codex WebUI

[English](./README.md) | [한국어](./README.ko.md)

Codex를 위한 라이트 모드 터미널 충실형 로컬 WebUI입니다.

Codex WebUI는 로컬에서 실제 `codex app-server`를 실행하고, 그 위에 브라우저 셸을 올리는 방식으로 동작합니다. 목표는 Codex를 일반적인 채팅 앱처럼 포장하는 것이 아니라, TUI의 워크플로우 모델을 브라우저에서도 그대로 유지하는 것입니다. thread, turn, approval, diff, review, logs, runtime state를 숨기지 않고 보여줍니다.

## 빠른 시작

저장소 루트에서 아래 한 줄만 실행하면 됩니다.

```bash
npm run up
```

그다음 브라우저에서 `http://127.0.0.1:3000` 을 엽니다.

`npm run up`은 필요한 의존성을 설치한 뒤 로컬 브리지와 Next.js 앱을 함께 시작합니다.

## 요구사항

- Node.js 20 이상
- `PATH` 에서 실행 가능한 `codex`
- 로컬에서 이미 사용할 수 있는 Codex 로그인 상태

`codex`가 설치되어 있지 않거나 인증되지 않은 상태라면, WebUI는 시작할 수 없습니다. 이 앱은 실제 로컬 `codex app-server`와 직접 통신합니다.

## 지금 동작하는 것

- `codex app-server --listen stdio://` 에 붙는 로컬 Node 브리지
- 라이트 모드 Codex TUI 셸 브라우저 UI
- thread/turn 활동을 보여주는 transcript timeline
- slash command를 지원하는 하단 composer
- 기존 로컬 Codex 세션을 여는 resume picker
- model 및 reasoning effort picker
- thread fork, inline review 시작, interrupt
- approval 및 `request_user_input` 모달 처리
- runtime status와 bridge log overlay

## 사용 방법

1. `npm run up`을 실행합니다.
2. `http://127.0.0.1:3000` 을 엽니다.
3. 새 thread를 시작하거나 `Resume`으로 기존 로컬 Codex 세션을 엽니다.
4. composer에 바로 입력하거나 `/new`, `/resume`, `/fork`, `/model`, `/review`, `/status` 같은 slash command를 사용합니다.
5. Codex가 승인이나 추가 입력을 요청하면 터미널이 아니라 모달에서 응답합니다.

## UI 구조

- Codex TUI 메타데이터 줄을 따르는 세션 헤더
- thread, turn, reasoning, command, diff, system 이벤트를 보여주는 중앙 transcript
- 새 turn과 slash command를 처리하는 하단 composer
- resume, model, transcript, shortcuts, runtime status용 전체 화면 overlay
- approval 및 `request_user_input` 전용 모달

## 키보드 단축키

- `Enter` 현재 turn 전송
- `Shift+Enter` 줄바꿈
- `Ctrl/Cmd+T` transcript overlay 열기
- `?` 단축키 패널 열기
- `Esc` overlay 닫기, composer에서는 active turn interrupt

## 명령어

- `npm run up` 필요 시 설치까지 하고 앱 시작
- `npm run dev` 의존성 설치 후 개발 서버 시작
- `npm run typecheck` TypeScript 검사
- `npm run build` 프로덕션 빌드
- `npm run check` typecheck와 build를 함께 실행

## 아키텍처

- Next.js가 브라우저 UI를 렌더링합니다.
- 로컬 Node 서버가 브라우저용 HTTP와 WebSocket API를 가집니다.
- 브리지는 이 저장소에 vendoring된 generated app-server 타입을 사용해 stdio로 Codex와 통신합니다.

즉, UI가 별도 상태 모델을 꾸며내는 대신 실제 Codex 프로토콜에 맞춰 동작합니다.

## 참고

- resume picker는 로컬 Codex 세션을 읽기 때문에, 같은 Codex home을 쓰는 다른 저장소 thread도 보일 수 있습니다.
- 기본 주소는 `127.0.0.1:3000` 입니다.
- 포트를 바꾸려면 `PORT=3001 npm run up`을 사용하면 됩니다.
