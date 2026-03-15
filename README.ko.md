# Codex UI

[English](./README.md) | [한국어](./README.ko.md)

실제 `codex app-server` 위에서 동작하는 미니멀 흑백 로컬 WebUI입니다.

Codex UI의 목표는 Codex를 일반 채팅 앱처럼 포장하는 것이 아니라, 실제 워크플로우를 브라우저에서 더 읽기 좋게 유지하는 것입니다. thread, turn, approval, diff, review, 모델 선택, 추론 레벨, plan 모드를 그대로 드러내고, 갱신은 새로고침이 아니라 WebSocket으로 스트리밍합니다.

## 왜 만들었나

- 터미널 워크플로우는 강력하지만 긴 세션을 시각적으로 추적하기는 불편할 수 있습니다.
- 많은 웹 UI가 Codex의 실행 흐름을 숨기고 일반 챗 UI처럼 평평하게 만듭니다.
- 이 프로젝트는 흰 배경, 검은 텍스트, 얇은 선 위주의 절제된 셸을 목표로 합니다.

## 핵심 특징

- 페이지 새로고침 없이 WebSocket으로 실시간 업데이트
- turn 구분을 `---` 로만 처리하는 모노크롬 transcript
- 채팅 입력 영역 안에서 바로 조절하는 model, reasoning, plan 설정
- 기본적으로 접혀 있고 필요할 때만 펼치는 edited content
- 로컬 Codex 세션을 탐색하고 이어서 여는 thread drawer
- 브라우저 안에서 처리하는 approval 및 `request_user_input`
- review 시작, thread fork, interrupt, slash command 지원

## 빠른 시작

```bash
npm run up
```

실행 후 `http://127.0.0.1:3000` 을 열면 됩니다.

`npm run up`은 필요 시 의존성을 설치하고, 로컬 브리지와 Next.js 앱을 함께 시작합니다.

## 요구사항

- Node.js 20 이상
- `PATH` 에서 실행 가능한 `codex`
- 이미 로그인된 로컬 Codex 상태

`codex`가 없거나 인증되지 않았다면 앱은 동작할 수 없습니다. 이 UI는 실제 로컬 app-server와 직접 통신합니다.

## 기본 사용 흐름

1. `npm run up`으로 앱을 시작합니다.
2. 브라우저에서 새 thread를 만들거나 `Threads`에서 기존 세션을 엽니다.
3. composer 안에서 `Model`, `Reasoning`, `Plan`을 바로 설정합니다.
4. 메시지를 보내고 transcript가 실시간으로 갱신되는 것을 확인합니다.
5. 편집된 내용은 필요할 때만 펼쳐서 확인합니다.
6. 승인 요청이나 추가 입력은 모달에서 바로 처리합니다.

## 화면 구성

- Header: 현재 thread, 작업 경로, 실행 상태
- Transcript: 사용자/assistant 메시지, turn 경계, 접을 수 있는 실행 이벤트
- Composer: 입력창, model 드롭다운, reasoning 드롭다운, plan 토글, send/interrupt
- Thread Drawer: 검색, 정렬, 새 thread 생성, 기존 thread 재개
- Overlay: transcript 미러, 상태 요약, 키보드 단축키 도움말
- Approval Modal: 명령 실행 승인, 파일 변경 승인, 권한 변경, 사용자 입력

## 키보드 단축키

- `Enter` 현재 turn 전송
- `Shift+Enter` 줄바꿈
- `Esc` overlay 닫기, slash suggestion 숨기기, active turn interrupt
- `Ctrl/Cmd+T` transcript overlay 열기
- `?` 단축키 도움말 열기

## 개발 명령어

```bash
npm run dev
npm run typecheck
npm run build
npm run check
```

## 아키텍처

- Next.js가 클라이언트 UI를 렌더링합니다.
- 로컬 Node 서버가 브라우저용 HTTP와 WebSocket 엔드포인트를 제공합니다.
- `server/codex-bridge.ts`가 브라우저 액션을 실제 Codex app-server RPC 호출로 변환합니다.
- 이 저장소에 포함된 generated type을 사용해 UI와 Codex 프로토콜을 맞춥니다.

## 참고

- thread drawer는 로컬 Codex home을 읽기 때문에 다른 저장소의 세션도 함께 보일 수 있습니다.
- 기본 주소는 `127.0.0.1:3000` 입니다.
- 포트를 바꾸려면 `PORT=3001 npm run up`을 사용하면 됩니다.
