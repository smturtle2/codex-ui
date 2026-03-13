import { getDefaultSourceKinds } from "@/lib/source-filter";
import { CompatibilityState, GlobalSnapshot } from "@/lib/types";
import { JsonRpcClient } from "@/server/bridge/json-rpc-client";

interface AccountConfigServiceOptions {
  compatibility: CompatibilityState;
  sessionSecret: string;
  sessionId: string;
  launcherCwd: string;
}

function isThreadNotFoundError(error: unknown) {
  return error instanceof Error && error.message.includes("thread not found:");
}

export class AccountConfigService {
  private account: GlobalSnapshot["account"] = {
    account: null,
    requiresOpenaiAuth: false,
  };

  private config: unknown = null;
  private configRequirements: unknown = null;
  private models: unknown[] = [];

  constructor(private readonly rpc: JsonRpcClient, private readonly options: AccountConfigServiceOptions) {}

  async initialize() {
    await Promise.all([this.refreshAccount(), this.refreshConfig(), this.refreshModels()]);
  }

  async refreshAccount() {
    const result = (await this.rpc.request("account/read", { refreshToken: false })) as {
      account: unknown;
      requiresOpenaiAuth: boolean;
    };
    this.account = {
      account: result.account,
      requiresOpenaiAuth: result.requiresOpenaiAuth,
    };
    return this.account;
  }

  async refreshConfig() {
    const [config, requirements] = await Promise.all([
      this.rpc.request("config/read", {}),
      this.rpc.request("configRequirements/read", undefined),
    ]);

    this.config = (config as { config: unknown }).config;
    this.configRequirements = (requirements as { requirements: unknown }).requirements;
    return {
      config: this.config,
      requirements: this.configRequirements,
    };
  }

  async refreshModels() {
    const result = (await this.rpc.request("model/list", {
      limit: 100,
      includeHidden: false,
    })) as { data: unknown[] };
    this.models = result.data;
    return this.models;
  }

  getCurrentAccount() {
    return this.account;
  }

  getCurrentConfig() {
    return this.config;
  }

  getCurrentConfigRequirements() {
    return this.configRequirements;
  }

  getCurrentModels() {
    return this.models;
  }

  async getSkills(cwd: string) {
    const result = (await this.rpc.request("skills/list", {
      cwds: [cwd],
      forceReload: false,
    })) as { entries?: unknown[]; skills?: unknown[]; data?: unknown[] } | unknown[];
    if (Array.isArray(result)) {
      return result;
    }
    return result.entries ?? result.skills ?? result.data ?? [];
  }

  async getApps(threadId?: string | null) {
    try {
      const result = (await this.rpc.request("app/list", {
        threadId: threadId ?? null,
        limit: 100,
        forceRefetch: false,
      })) as { data?: unknown[] };
      return result.data ?? [];
    } catch (error) {
      if (threadId && isThreadNotFoundError(error)) {
        return [];
      }
      throw error;
    }
  }

  async listRecentWorkspaces() {
    const result = (await this.rpc.request("thread/list", {
      limit: 100,
      sourceKinds: getDefaultSourceKinds(),
    })) as { data?: Array<{ cwd?: string }> };

    const fromThreads = (result.data ?? []).map((thread) => thread.cwd).filter((cwd): cwd is string => typeof cwd === "string");
    const fromProjects =
      this.config && typeof this.config === "object" && this.config !== null && "projects" in this.config
        ? Object.keys(((this.config as { projects?: Record<string, unknown> }).projects ?? {}))
        : [];

    return [...new Set([this.options.launcherCwd, ...fromThreads, ...fromProjects])];
  }

  async buildBootstrap(cwd?: string | null, threadId?: string | null): Promise<GlobalSnapshot> {
    const workspace = cwd ?? this.options.launcherCwd;
    const [skills, apps, recentWorkspaces] = await Promise.all([
      this.getSkills(workspace),
      this.getApps(threadId ?? null),
      this.listRecentWorkspaces(),
    ]);

    const forcedLoginMethod =
      this.config && typeof this.config === "object" && this.config !== null && "forced_login_method" in this.config
        ? ((this.config as { forced_login_method?: "chatgpt" | "api" | null }).forced_login_method ?? null)
        : null;

    return {
      compatibility: this.options.compatibility,
      sessionSecret: this.options.sessionSecret,
      sessionId: this.options.sessionId,
      account: this.account,
      config: this.config,
      configRequirements: this.configRequirements,
      models: this.models,
      pendingRequests: [],
      logs: [],
      defaultWorkspace: workspace,
      recentWorkspaces,
      forcedLoginMethod,
      degradedFeatures:
        this.options.compatibility.mode === "degraded" ? ["request_user_input", "persistExtendedHistory"] : [],
      skills,
      apps,
    };
  }
}
