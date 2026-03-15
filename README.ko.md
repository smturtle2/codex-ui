# Codex UI

[English](./README.md) | [한국어](./README.ko.md)

실제 `codex app-server` 위에서 동작하는 흑백 로컬 WebUI입니다.

Codex UI는 Codex를 일반 채팅 앱처럼 포장하기보다, 원래 워크플로우를 브라우저에서 더 읽기 좋게 유지하는 데 집중합니다. thread, approval, model 선택, reasoning 레벨, plan mode, live transcript를 하나의 절제된 흑백 인터페이스 안에 담았습니다.

## 미리보기

| Desktop | Mobile |
| --- | --- |
| ![Desktop preview](./docs/preview-desktop.png) | ![Mobile preview](./docs/preview-mobile.png) |

## 왜 만들었나

- 터미널 워크플로우는 강력하지만, 긴 세션은 시각적으로 추적할 수 있는 transcript가 더 편할 때가 있습니다.
- 많은 웹 UI가 실제 실행 흐름을 숨기고, 장식적인 카드와 로그로 화면을 복잡하게 만듭니다.
- 이 프로젝트는 반대로 흰 배경, 검은 텍스트, 얇은 선, 높은 밀도, 실시간 스트리밍, 불필요한 장식 제거를 목표로 합니다.

## 핵심 특징

- 페이지 새로고침이 아닌 WebSocket 기반 실시간 업데이트
- composer 안에서 바로 바꾸는 `Model`, `Reasoning`, `Plan`
- 메시지마다 카드가 반복되지 않고, 연속 발화가 그룹화되는 transcript
- turn 구분을 `---` 로만 처리하는 단순한 흐름
- 기본적으로 접혀 있고 필요할 때만 펼치는 diff
- 성공한 command 로그를 메인 transcript에서 숨겨 대화 가독성 유지
- 내부 스크롤이 정상 동작하는 thread drawer와 모바일 대응 레이아웃
- 브라우저 안에서 처리하는 approval 및 `request_user_input`

## 화면 구성

| 영역 | 역할 |
| --- | --- |
| Header | 현재 thread, 작업 경로, 연결/실행 상태 |
| Transcript | 그룹화된 user/assistant 메시지, turn 경계, 접을 수 있는 plan/diff 이벤트 |
| Composer | 입력창, model 드롭다운, reasoning 드롭다운, plan 토글 |
| Thread Drawer | 검색, 정렬, 새 thread 생성, 기존 세션 재개 |
| Approval Modal | 명령 승인, 파일 편집 승인, 권한 요청, 사용자 입력 |

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
2. `Threads`에서 기존 세션을 열거나 새 thread를 시작합니다.
3. composer 안에서 `Model`, `Reasoning`, `Plan`을 설정합니다.
4. 메시지를 보내고 transcript가 WebSocket으로 갱신되는 것을 확인합니다.
5. diff는 필요할 때만 펼치고, approval은 모달에서 바로 처리합니다.

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
- [`server/codex-bridge.ts`](./server/codex-bridge.ts)가 브라우저 액션을 실제 Codex app-server RPC 호출로 변환합니다.
- 저장소에 포함된 generated type을 사용해 UI와 Codex 프로토콜을 맞춥니다.

## 참고

- thread drawer는 로컬 Codex home을 읽기 때문에 다른 저장소의 세션도 함께 보일 수 있습니다.
- 기본 주소는 `127.0.0.1:3000` 입니다.
- 포트를 바꾸려면 `PORT=3001 npm run up`을 사용하면 됩니다.
