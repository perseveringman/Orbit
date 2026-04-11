// ---------------------------------------------------------------------------
// Agent DevTools – LLM Config Store
// Persists LLM provider configurations to localStorage and provides
// connectivity testing + real provider instantiation.
// ---------------------------------------------------------------------------

import {
  PROVIDER_CATALOG,
  getCatalogEntry,
  OpenAIProvider,
  AnthropicProvider,
  type ProviderCatalogEntry,
  type LLMProvider,
  type ProviderConfig,
} from '@orbit/agent-core';

// ---- Config Types ----

export interface LLMProviderUserConfig {
  readonly providerId: string;
  readonly apiKey: string;
  readonly baseUrl: string;       // empty = use default from catalog
  readonly enabled: boolean;
  readonly defaultModel: string;  // empty = use catalog default
}

export interface ConnectivityResult {
  readonly status: 'success' | 'error' | 'auth_error' | 'timeout';
  readonly latencyMs: number;
  readonly message: string;
  readonly modelCount?: number;
}

// ---- Storage Key ----

const STORAGE_KEY = 'orbit:agent-devtools:llm-configs';

// ---- LLM Config Store ----

export class LLMConfigStore {

  /** Load all saved configs from localStorage. */
  static getAll(): LLMProviderUserConfig[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as LLMProviderUserConfig[];
    } catch {
      return [];
    }
  }

  /** Get config for a specific provider. */
  static get(providerId: string): LLMProviderUserConfig | null {
    const all = LLMConfigStore.getAll();
    return all.find((c) => c.providerId === providerId) ?? null;
  }

  /** Save/update config for a provider. */
  static set(config: LLMProviderUserConfig): void {
    const all = LLMConfigStore.getAll();
    const idx = all.findIndex((c) => c.providerId === config.providerId);
    if (idx >= 0) {
      all[idx] = config;
    } else {
      all.push(config);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  /** Remove config for a provider. */
  static remove(providerId: string): void {
    const all = LLMConfigStore.getAll().filter((c) => c.providerId !== providerId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  /** Get all configured & enabled providers. */
  static getEnabled(): LLMProviderUserConfig[] {
    return LLMConfigStore.getAll().filter((c) => c.enabled && c.apiKey.length > 0);
  }

  // ---- Connectivity Test ----

  /**
   * Test connectivity for a provider by calling its health check endpoint
   * (typically GET /models).
   */
  static async testConnectivity(
    entry: ProviderCatalogEntry,
    config: LLMProviderUserConfig,
  ): Promise<ConnectivityResult> {
    const baseUrl = config.baseUrl || entry.defaultBaseUrl;
    const healthUrl = entry.healthCheckUrl ?? `${baseUrl}/models`;

    if (baseUrl.startsWith('acp://') || entry.authType === 'external_process') {
      return {
        status: 'error',
        latencyMs: 0,
        message: '此供应商需要外部进程连接，无法在浏览器中测试',
      };
    }

    if (!config.apiKey && entry.authType === 'api_key') {
      return {
        status: 'error',
        latencyMs: 0,
        message: '未配置 API Key',
      };
    }

    const start = performance.now();

    try {
      const headers: Record<string, string> = {};
      if (config.apiKey) {
        if (entry.usesXApiKey) {
          headers['x-api-key'] = config.apiKey;
        } else {
          headers['Authorization'] = `Bearer ${config.apiKey}`;
        }
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(healthUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const latencyMs = Math.round(performance.now() - start);

      if (response.ok) {
        let modelCount: number | undefined;
        try {
          const json = await response.json() as Record<string, unknown>;
          const data = json['data'] as unknown[] | undefined;
          if (Array.isArray(data)) {
            modelCount = data.length;
          }
        } catch {
          // Some endpoints don't return JSON
        }

        return {
          status: 'success',
          latencyMs,
          message: modelCount
            ? `连接成功 — ${modelCount} 个模型可用`
            : '连接成功',
          modelCount,
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          status: 'auth_error',
          latencyMs,
          message: `认证失败 (HTTP ${response.status}) — 请检查 API Key`,
        };
      }

      return {
        status: 'error',
        latencyMs,
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error) {
      const latencyMs = Math.round(performance.now() - start);
      const msg = error instanceof Error ? error.message : String(error);

      if (msg.includes('abort') || msg.includes('AbortError')) {
        return { status: 'timeout', latencyMs, message: '请求超时 (10s)' };
      }

      return { status: 'error', latencyMs, message: `网络错误: ${msg}` };
    }
  }

  // ---- Provider Instantiation ----

  /**
   * Create a real LLMProvider instance from stored config.
   * Returns null if the provider uses an unsupported transport.
   */
  static createProvider(config: LLMProviderUserConfig): LLMProvider | null {
    const entry = getCatalogEntry(config.providerId);
    if (!entry) return null;

    const baseUrl = config.baseUrl || entry.defaultBaseUrl;
    const model = config.defaultModel || entry.defaultModel;

    const providerConfig: Partial<ProviderConfig> & { apiKey?: string } = {
      name: entry.id,
      baseUrl,
      defaultModel: model,
      apiKey: config.apiKey || undefined,
      timeoutMs: 60_000,
      maxRetries: 2,
    };

    switch (entry.transport) {
      case 'openai_chat':
        return new OpenAIProvider(providerConfig);

      case 'anthropic_messages':
        return new AnthropicProvider(providerConfig);

      case 'codex_responses':
        // Codex Responses API not implemented — uses different protocol
        return null;

      default:
        return null;
    }
  }

  /**
   * Quick chat completion test — sends a minimal message and returns the response.
   */
  static async testChatCompletion(
    entry: ProviderCatalogEntry,
    config: LLMProviderUserConfig,
  ): Promise<{ success: boolean; response?: string; error?: string; latencyMs: number }> {
    const start = performance.now();
    const provider = LLMConfigStore.createProvider(config);

    if (!provider) {
      return {
        success: false,
        error: `Transport "${entry.transport}" 不支持直接调用`,
        latencyMs: 0,
      };
    }

    try {
      const model = config.defaultModel || entry.defaultModel;
      const result = await provider.chatCompletion({
        model,
        messages: [
          {
            id: 'test-1',
            role: 'user',
            content: 'Say "Hello from Orbit!" in one short sentence.',
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const latencyMs = Math.round(performance.now() - start);
      const text = result.choices[0]?.message?.content ?? '(empty response)';

      return { success: true, response: text, latencyMs };
    } catch (error) {
      const latencyMs = Math.round(performance.now() - start);
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg, latencyMs };
    }
  }
}

/** Get the full catalog with user config merged in. */
export function getCatalogWithConfigs(): Array<{
  entry: ProviderCatalogEntry;
  config: LLMProviderUserConfig | null;
}> {
  return PROVIDER_CATALOG.map((entry) => ({
    entry,
    config: LLMConfigStore.get(entry.id),
  }));
}
