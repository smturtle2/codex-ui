"use client";

import type { SlashCommandAction, SlashCommandDefinition } from "@/lib/shared";
import { BUILTIN_COMMANDS } from "@/lib/shared";

export type UiLanguage = "system" | "en" | "ko";
export type UiLocale = "en" | "ko";

export const LANGUAGE_STORAGE_KEY = "codex-ui-language";

const UI_COPY = {
  en: {
    languageOptions: {
      system: "System",
      en: "English",
      ko: "Korean",
    },
    header: {
      threads: "Threads",
      ready: "ready",
      working: "working",
      pendingRequest: "pending request",
      connecting: "connecting",
      reconnecting: "reconnecting",
      error: "error",
    },
    composer: {
      session: "Session",
      model: "Model",
      reasoning: "Reasoning",
      language: "Language",
      status: "Status",
      shortcuts: "Shortcuts",
      plan: "Plan",
      on: "On",
      off: "Off",
      placeholder: "Message Codex",
      send: "Send",
      interrupt: "Interrupt",
      ready: "Ready",
      readyPlan: "Ready · plan",
      working: "Working",
      connecting: "Connecting",
      reconnecting: "Reconnecting",
      helperReconnect: "WebSocket reconnects automatically.",
      helperSlash:
        "Arrow keys move. Enter runs. Tab completes. Esc hides.",
      helperStreaming: "Streaming live. Diffs stay folded until opened.",
      helperIdle: "/ commands. Enter sends. Shift+Enter adds a newline.",
      sessionAria: (
        selectedModelLabel: string,
        selectedEffortLabel: string,
        selectedLanguageLabel: string,
      ) =>
        `Model, reasoning, and language controls. Current model ${selectedModelLabel}. Current reasoning ${selectedEffortLabel}. Current language ${selectedLanguageLabel}.`,
    },
    transcript: {
      noTranscriptYet: "No transcript yet",
      noActiveSession: "No active session",
      sendFirstTurn: "Send the first turn to begin.",
      typeMessageOrOpenThreadDrawer:
        "Type a message or open the thread drawer.",
      you: "You",
      codex: "Codex",
      codexRunning: "Codex running",
      codexError: "Codex error",
      editedContentHidden: (count: number) =>
        count > 0
          ? `Edited content hidden · ${count} file${count === 1 ? "" : "s"}`
          : "Edited content hidden",
      reasoningHidden: "Reasoning hidden",
      planHidden: "Plan hidden",
      approvalNeeded: "Approval needed",
      show: "Show",
      showDiff: "Show diff",
      hide: "Hide",
      turnSeparator: "Turn separator",
    },
    common: {
      close: "Close",
      cancel: "Cancel",
      current: "Current",
      recent: "Recent",
      none: "none",
      on: "on",
      off: "off",
      unavailable: "Unavailable",
      unknownSlashCommand: (value: string) => `Unknown slash command: ${value}`,
      noActiveThreadToFork: "No active thread to fork.",
      invalidJson: "Invalid JSON for server request response.",
      bootstrapError: "Failed to load bootstrap.",
    },
    actions: {
      startingThread: "Starting thread",
      sendingTurn: "Sending turn",
      forkingThread: "Forking thread",
      startingReview: "Starting review",
      resumingThread: "Resuming thread",
      interruptingTurn: "Interrupting turn",
      updatingSessionSettings: "Updating session settings",
      respondingToServerRequest: "Responding to server request",
    },
    threadDrawer: {
      sessions: (count: number) => `${count} sessions`,
      search: "Search threads",
      searchPlaceholder: "Search title, workspace, branch, or source",
      newThread: "New thread",
      threadControls: "Thread controls",
      sortThreads: "Sort threads",
      recentAvailable: (count: number) => `${count} available`,
      noMatchingThreads: "No matching threads.",
      noOtherThreads: "No other threads to switch to yet.",
      recentSort: "Recent",
      createdSort: "Created",
    },
    surface: {
      overlay: "Overlay",
      statusTitle: "Status",
      statusFooter: "Esc closes this overlay.",
      shortcutsTitle: "Shortcuts",
      shortcutsSubtitle:
        "Keyboard help that matches the current browser behavior.",
      shortcutsFooter:
        "Browser-reserved shortcuts keep visible fallback controls in the shell.",
    },
    approval: {
      approval: "Approval",
      runCommandTitle: "Run command?",
      approveFilesTitle: "Approve file changes?",
      updatePermissionsTitle: "Update permissions?",
      additionalInputTitle: "Additional input required",
      serverRequestTitle: "Server request",
      runCommandIntro: "Codex wants to run the following command.",
      editFilesIntro: "Codex wants to make the following edits.",
      updatePermissionsIntro: "Codex wants to update model permissions.",
      footerChoose: "Use ↑/↓ then Enter to choose.",
      footerChooseWithEsc: "Use ↑/↓ then Enter to choose. Esc cancels.",
      footerSubmit: "Fill in the answers, then submit.",
      reason: "Reason",
      typeAnswer: "Type an answer",
      advancedJson: "Advanced response JSON",
      sendJson: "Send JSON response",
      submitAnswers: "Submit answers",
      accept: "Yes, proceed",
      acceptForSession: "Yes, proceed for this session",
      decline: "No, and tell Codex what to do differently",
      allowNetworkRule: "Allow the proposed network rule",
      acceptEdits: "Yes, make the edits",
      acceptEditsForSession: "Yes, allow edits for this session",
      acceptWithoutAskingPrefix:
        "Yes, and don't ask again for commands that start with",
    },
    commandDescriptions: {
      model:
        "Choose the current session model, reasoning effort, and UI language.",
      review: "Run an inline review against uncommitted changes.",
      new: "Start a fresh thread in the current browser session.",
      resume: "Open the thread drawer for previous local sessions.",
      fork: "Fork the active thread into a new branchable session.",
      status: "Open the runtime and bridge status panel.",
      clear: "Clear the working surface by starting a new thread.",
    } as Record<SlashCommandAction, string>,
    statusPanel: {
      bridge: "bridge",
      connection: "connection",
      activeThread: "active thread",
      model: "model",
      reasoning: "reasoning",
      planMode: "plan mode",
      uiLanguage: "ui language",
      pendingRequests: "pending requests",
      runtime: "runtime",
      lastError: "last error",
      live: "live",
      sessions: (count: number) => `${count} sessions`,
      plan: "plan",
      phase: {
        starting: "starting",
        ready: "ready",
        error: "error",
      },
    },
    shortcutsPanel: {
      lines: [
        "Enter            send current turn",
        "Shift + Enter    insert newline",
        "Esc              close overlays / interrupt / hide slash suggestions",
        "?                open shortcut panel",
        "/                trigger slash command suggestions",
      ],
    },
    timeline: {
      kinds: {
        thread: "Thread",
        turn: "Turn",
        message: "Message",
        reasoning: "Reasoning",
        plan: "Plan",
        command: "Command",
        diff: "Diff",
        review: "Review",
        tool: "Tool",
        approval: "Approval",
        input: "Input",
        system: "System",
      },
      status: {
        running: "running",
        pending: "pending",
        error: "error",
        completed: "completed",
        idle: "idle",
      },
      time: {
        justNow: "just now",
        minutesAgo: (value: number) => `${value}m ago`,
        hoursAgo: (value: number) => `${value}h ago`,
        daysAgo: (value: number) => `${value}d ago`,
      },
    },
  },
  ko: {
    languageOptions: {
      system: "시스템",
      en: "English",
      ko: "한국어",
    },
    header: {
      threads: "Threads",
      ready: "준비됨",
      working: "작업 중",
      pendingRequest: "응답 대기",
      connecting: "연결 중",
      reconnecting: "재연결 중",
      error: "오류",
    },
    composer: {
      session: "Session",
      model: "모델",
      reasoning: "추론",
      language: "언어",
      status: "상태",
      shortcuts: "단축키",
      plan: "Plan",
      on: "켜짐",
      off: "꺼짐",
      placeholder: "Codex에게 메시지 보내기",
      send: "보내기",
      interrupt: "중단",
      ready: "준비됨",
      readyPlan: "준비됨 · plan",
      working: "작업 중",
      connecting: "연결 중",
      reconnecting: "재연결 중",
      helperReconnect: "WebSocket이 자동으로 재연결됩니다.",
      helperSlash:
        "방향키로 이동하고 Enter로 실행합니다. Tab으로 완성하고 Esc로 닫습니다.",
      helperStreaming: "실시간 스트리밍 중입니다. diff는 펼칠 때까지 접혀 있습니다.",
      helperIdle: "/ 명령어 사용 가능. Enter 전송, Shift+Enter 줄바꿈.",
      sessionAria: (
        selectedModelLabel: string,
        selectedEffortLabel: string,
        selectedLanguageLabel: string,
      ) =>
        `모델, 추론, 언어 제어입니다. 현재 모델 ${selectedModelLabel}. 현재 추론 ${selectedEffortLabel}. 현재 언어 ${selectedLanguageLabel}.`,
    },
    transcript: {
      noTranscriptYet: "아직 transcript가 없습니다",
      noActiveSession: "활성 세션이 없습니다",
      sendFirstTurn: "첫 turn을 보내면 시작됩니다.",
      typeMessageOrOpenThreadDrawer:
        "메시지를 입력하거나 thread drawer를 열어보세요.",
      you: "나",
      codex: "Codex",
      codexRunning: "Codex 작업 중",
      codexError: "Codex 오류",
      editedContentHidden: (count: number) =>
        count > 0
          ? `편집 내용 숨김 · ${count}개 파일`
          : "편집 내용 숨김",
      reasoningHidden: "추론 내용 숨김",
      planHidden: "계획 숨김",
      approvalNeeded: "승인 필요",
      show: "펼치기",
      showDiff: "diff 보기",
      hide: "접기",
      turnSeparator: "턴 구분선",
    },
    common: {
      close: "닫기",
      cancel: "취소",
      current: "현재",
      recent: "최근",
      none: "없음",
      on: "켜짐",
      off: "꺼짐",
      unavailable: "사용 불가",
      unknownSlashCommand: (value: string) => `알 수 없는 슬래시 명령어: ${value}`,
      noActiveThreadToFork: "포크할 활성 thread가 없습니다.",
      invalidJson: "서버 요청 응답용 JSON 형식이 올바르지 않습니다.",
      bootstrapError: "초기 상태를 불러오지 못했습니다.",
    },
    actions: {
      startingThread: "thread 시작 중",
      sendingTurn: "turn 전송 중",
      forkingThread: "thread 포크 중",
      startingReview: "리뷰 시작 중",
      resumingThread: "thread 다시 여는 중",
      interruptingTurn: "turn 중단 중",
      updatingSessionSettings: "세션 설정 업데이트 중",
      respondingToServerRequest: "서버 요청에 응답하는 중",
    },
    threadDrawer: {
      sessions: (count: number) => `${count}개 세션`,
      search: "스레드 검색",
      searchPlaceholder: "제목, 워크스페이스, 브랜치, 소스로 검색",
      newThread: "새 thread",
      threadControls: "thread 제어",
      sortThreads: "thread 정렬",
      recentAvailable: (count: number) => `${count}개 사용 가능`,
      noMatchingThreads: "일치하는 thread가 없습니다.",
      noOtherThreads: "전환할 다른 thread가 아직 없습니다.",
      recentSort: "최근순",
      createdSort: "생성순",
    },
    surface: {
      overlay: "오버레이",
      statusTitle: "상태",
      statusFooter: "Esc 키로 이 오버레이를 닫습니다.",
      shortcutsTitle: "단축키",
      shortcutsSubtitle:
        "현재 브라우저 동작에 맞춰 정리한 키보드 도움말입니다.",
      shortcutsFooter:
        "브라우저가 선점하는 단축키는 셸 안의 버튼으로 계속 접근할 수 있습니다.",
    },
    approval: {
      approval: "승인",
      runCommandTitle: "명령을 실행할까요?",
      approveFilesTitle: "파일 변경을 승인할까요?",
      updatePermissionsTitle: "권한을 업데이트할까요?",
      additionalInputTitle: "추가 입력이 필요합니다",
      serverRequestTitle: "서버 요청",
      runCommandIntro: "Codex가 다음 명령을 실행하려고 합니다.",
      editFilesIntro: "Codex가 다음 편집을 적용하려고 합니다.",
      updatePermissionsIntro: "Codex가 모델 권한을 바꾸려고 합니다.",
      footerChoose: "↑/↓로 선택하고 Enter로 결정합니다.",
      footerChooseWithEsc:
        "↑/↓로 선택하고 Enter로 결정합니다. Esc로 취소합니다.",
      footerSubmit: "답을 입력한 뒤 제출하세요.",
      reason: "사유",
      typeAnswer: "답변 입력",
      advancedJson: "고급 응답 JSON",
      sendJson: "JSON 응답 보내기",
      submitAnswers: "답변 제출",
      accept: "예, 진행합니다",
      acceptForSession: "예, 이번 세션에서는 계속 허용합니다",
      decline: "아니요. 대신 Codex에 다른 방법을 알려줍니다",
      allowNetworkRule: "제안된 네트워크 규칙을 허용합니다",
      acceptEdits: "예, 편집을 적용합니다",
      acceptEditsForSession: "예, 이번 세션에서는 편집을 계속 허용합니다",
      acceptWithoutAskingPrefix:
        "예, 다음으로 시작하는 명령은 다시 묻지 않습니다",
    },
    commandDescriptions: {
      model:
        "현재 세션의 모델, 추론 수준, UI 언어를 선택합니다.",
      review: "커밋되지 않은 변경사항에 대해 인라인 리뷰를 실행합니다.",
      new: "현재 브라우저 세션에서 새 thread를 시작합니다.",
      resume: "이전 로컬 세션을 여는 thread drawer를 엽니다.",
      fork: "현재 thread를 새로 이어갈 수 있게 복제합니다.",
      status: "런타임 및 브리지 상태 패널을 엽니다.",
      clear: "새 thread를 시작해 작업 화면을 비웁니다.",
    } as Record<SlashCommandAction, string>,
    statusPanel: {
      bridge: "bridge",
      connection: "연결",
      activeThread: "활성 thread",
      model: "모델",
      reasoning: "추론",
      planMode: "plan mode",
      uiLanguage: "UI 언어",
      pendingRequests: "대기 중 요청",
      runtime: "실행 시간",
      lastError: "마지막 오류",
      live: "실시간 연결",
      sessions: (count: number) => `${count}개 세션`,
      plan: "plan",
      phase: {
        starting: "시작 중",
        ready: "준비됨",
        error: "오류",
      },
    },
    shortcutsPanel: {
      lines: [
        "Enter            현재 turn 전송",
        "Shift + Enter    줄바꿈 삽입",
        "Esc              오버레이 닫기 / 중단 / 슬래시 제안 숨기기",
        "?                단축키 패널 열기",
        "/                슬래시 명령 제안 열기",
      ],
    },
    timeline: {
      kinds: {
        thread: "Thread",
        turn: "Turn",
        message: "메시지",
        reasoning: "추론",
        plan: "계획",
        command: "명령",
        diff: "Diff",
        review: "리뷰",
        tool: "도구",
        approval: "승인",
        input: "입력",
        system: "시스템",
      },
      status: {
        running: "진행 중",
        pending: "대기 중",
        error: "오류",
        completed: "완료",
        idle: "대기",
      },
      time: {
        justNow: "방금 전",
        minutesAgo: (value: number) => `${value}분 전`,
        hoursAgo: (value: number) => `${value}시간 전`,
        daysAgo: (value: number) => `${value}일 전`,
      },
    },
  },
} as const;

export type UiCopy = (typeof UI_COPY)[UiLocale];

export function parseUiLanguage(value: string | null | undefined): UiLanguage {
  if (value === "en" || value === "ko") {
    return value;
  }

  return "system";
}

export function resolveUiLocale(
  language: UiLanguage,
  browserLanguage?: string | null,
): UiLocale {
  if (language === "en" || language === "ko") {
    return language;
  }

  return browserLanguage?.toLowerCase().startsWith("ko") ? "ko" : "en";
}

export function getIntlLocale(locale: UiLocale): string {
  return locale === "ko" ? "ko-KR" : "en-US";
}

export function getUiCopy(locale: UiLocale): UiCopy {
  return UI_COPY[locale];
}

export function getLanguageOptions(locale: UiLocale) {
  const copy = getUiCopy(locale);
  return [
    { value: "system" as const, label: copy.languageOptions.system },
    { value: "en" as const, label: copy.languageOptions.en },
    { value: "ko" as const, label: copy.languageOptions.ko },
  ];
}

export function getLocalizedCommands(locale: UiLocale): SlashCommandDefinition[] {
  const copy = getUiCopy(locale);
  return BUILTIN_COMMANDS.map((command) => ({
    ...command,
    description: copy.commandDescriptions[command.action],
  }));
}
