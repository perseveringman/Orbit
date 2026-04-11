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

// ---- Helpers ----

function getDesktopBridge(): any {
  return (window as any).orbitDesktop;
}

/** Build auth headers for a provider entry. */
function buildAuthHeaders(entry: ProviderCatalogEntry, apiKey: string): Record<string, string> {
  if (!apiKey) return {};
  // MiniMax and similar providers use Bearer auth even on Anthropic-compatible endpoints
  if (entry.useBearerAuth) {
    return { 'Authorization': `Bearer ${apiKey}` };
  }
  // Anthropic native endpoints use x-api-key
  if (entry.usesXApiKey || entry.transport === 'anthropic_messages') {
    return { 'x-api-key': apiKey };
  }
  // OpenAI-compatible uses Bearer
  return { 'Authorization': `Bearer ${apiKey}` };
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

    // If enabling this provider, disable all others
    if (config.enabled) {
      for (const c of all) {
        if (c.providerId !== config.providerId && c.enabled) {
          const idx = all.indexOf(c);
          all[idx] = { ...c, enabled: false };
        }
      }
    }

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
   * Test connectivity for a provider.
   *
   * Strategy:
   * - If the provider has a healthCheckUrl → GET that endpoint
   * - For Anthropic-transport providers without healthCheckUrl (e.g. MiniMax),
   *   POST an empty body to the messages endpoint. A 401 means the endpoint
   *   is reachable (key is wrong); a 400 means key + endpoint both work.
   * - Otherwise fallback to GET {baseUrl}/models
   */
  static async testConnectivity(
    entry: ProviderCatalogEntry,
    config: LLMProviderUserConfig,
  ): Promise<ConnectivityResult> {
    const baseUrl = (config.baseUrl || entry.defaultBaseUrl).replace(/\/+$/, '');

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

    // Decide URL and method
    const isAnthropicWithoutHealthCheck =
      entry.transport === 'anthropic_messages' && !entry.healthCheckUrl;

    let healthUrl: string;
    let method: 'GET' | 'POST';
    let body: string | undefined;

    if (isAnthropicWithoutHealthCheck) {
      // MiniMax/Kimi etc.: probe the messages endpoint with a minimal POST
      healthUrl = baseUrl.endsWith('/v1')
        ? `${baseUrl}/messages`
        : `${baseUrl}/v1/messages`;
      method = 'POST';
      body = JSON.stringify({
        model: entry.defaultModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
    } else {
      healthUrl = entry.healthCheckUrl ?? `${baseUrl}/models`;
      method = 'GET';
    }

    const start = performance.now();

    try {
      const reqHeaders: Record<string, string> = {
        ...buildAuthHeaders(entry, config.apiKey),
      };
      // Anthropic API always requires anthropic-version header
      if (entry.transport === 'anthropic_messages') {
        reqHeaders['anthropic-version'] = '2023-06-01';
      }
      if (method === 'POST') {
        reqHeaders['Content-Type'] = 'application/json';
      }

      const bridge = getDesktopBridge();
      let status: number;
      let responseBody = '';

      if (bridge?.llmProxy) {
        const proxyResult = await bridge.llmProxy({
          url: healthUrl,
          method,
          headers: reqHeaders,
          body,
          timeoutMs: 10_000,
        });
        status = proxyResult.status;
        responseBody = proxyResult.body;
        // IPC proxy returns status 0 on network errors
        if (status === 0) {
          const latencyMs = Math.round(performance.now() - start);
          let detail = '';
          try { detail = JSON.parse(responseBody)?.error ?? ''; } catch {}
          return { status: 'error', latencyMs, message: `网络错误: ${detail || proxyResult.statusText || '无法连接'}` };
        }
      } else {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        const response = await fetch(healthUrl, {
          method,
          headers: reqHeaders,
          body,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        status = response.status;
        responseBody = await response.text().catch(() => '');
      }

      const latencyMs = Math.round(performance.now() - start);

      // For the POST-probe strategy: any non-404 response proves the endpoint exists
      if (isAnthropicWithoutHealthCheck) {
        if (status === 401 || status === 403) {
          return { status: 'auth_error', latencyMs, message: `连接成功，但认证失败 (HTTP ${status}) — 请检查 API Key` };
        }
        if (status >= 200 && status < 500) {
          // 200, 400 (bad request body) etc. all mean the endpoint is reachable
          return { status: 'success', latencyMs, message: `连接成功 (${latencyMs}ms)` };
        }
        return { status: 'error', latencyMs, message: `HTTP ${status}: ${responseBody.slice(0, 200)}` };
      }

      // Standard GET /models health check
      if (status >= 200 && status < 300) {
        let modelCount: number | undefined;
        try {
          const json = JSON.parse(responseBody) as Record<string, unknown>;
          const data = json['data'] as unknown[] | undefined;
          if (Array.isArray(data)) modelCount = data.length;
        } catch {}
        return {
          status: 'success',
          latencyMs,
          message: modelCount ? `连接成功 — ${modelCount} 个模型可用` : '连接成功',
          modelCount,
        };
      }

      if (status === 401 || status === 403) {
        return { status: 'auth_error', latencyMs, message: `认证失败 (HTTP ${status}) — 请检查 API Key` };
      }

      return { status: 'error', latencyMs, message: `HTTP ${status}: ${responseBody.slice(0, 200)}` };
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
        return new AnthropicProvider({
          ...providerConfig,
          useBearerAuth: entry.useBearerAuth ?? false,
        });

      case 'codex_responses':
        // Codex Responses API not implemented — uses different protocol
        return null;

      default:
        return null;
    }
  }

  /**
   * Quick chat completion test — sends a minimal message via IPC proxy.
   */
  static async testChatCompletion(
    entry: ProviderCatalogEntry,
    config: LLMProviderUserConfig,
  ): Promise<{ success: boolean; response?: string; error?: string; latencyMs: number }> {
    if (entry.transport === 'codex_responses') {
      return { success: false, error: `Transport "${entry.transport}" 不支持直接调用`, latencyMs: 0 };
    }

    const start = performance.now();
    const baseUrl = (config.baseUrl || entry.defaultBaseUrl).replace(/\/+$/, '');
    const model = config.defaultModel || entry.defaultModel;

    try {
      const isAnthropic = entry.transport === 'anthropic_messages';
      const url = isAnthropic
        ? (baseUrl.endsWith('/v1') ? `${baseUrl}/messages` : `${baseUrl}/v1/messages`)
        : `${baseUrl}/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(entry, config.apiKey),
      };
      if (isAnthropic) {
        headers['anthropic-version'] = '2023-06-01';
      }

      const body = isAnthropic
        ? JSON.stringify({
            model,
            max_tokens: 256,
            messages: [{ role: 'user', content: 'Say "Hello from Orbit!" in one short sentence.' }],
          })
        : JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Say "Hello from Orbit!" in one short sentence.' }],
          });

      const bridge = getDesktopBridge();
      let responseBody: string;

      if (bridge?.llmProxy) {
        const proxyResult = await bridge.llmProxy({ url, method: 'POST', headers, body, timeoutMs: 30_000 });
        if (proxyResult.status === 0) {
          const latencyMs = Math.round(performance.now() - start);
          let detail = '';
          try { detail = JSON.parse(proxyResult.body)?.error ?? ''; } catch {}
          return { success: false, error: `网络错误: ${detail || '无法连接'}`, latencyMs };
        }
        if (!proxyResult.ok) {
          const latencyMs = Math.round(performance.now() - start);
          return { success: false, error: `HTTP ${proxyResult.status}: ${proxyResult.body.slice(0, 200)}`, latencyMs };
        }
        responseBody = proxyResult.body;
      } else {
        const resp = await fetch(url, { method: 'POST', headers, body });
        if (!resp.ok) {
          const latencyMs = Math.round(performance.now() - start);
          const errText = await resp.text().catch(() => '');
          return { success: false, error: `HTTP ${resp.status}: ${errText.slice(0, 200)}`, latencyMs };
        }
        responseBody = await resp.text();
      }

      const latencyMs = Math.round(performance.now() - start);
      const json = JSON.parse(responseBody) as Record<string, unknown>;

      // Parse response based on transport
      let text: string;
      if (isAnthropic) {
        const content = json['content'] as readonly Record<string, unknown>[] | undefined;
        text = content?.map((b) => (b['text'] as string) ?? '').join('') ?? '(empty)';
      } else {
        const choices = json['choices'] as readonly Record<string, unknown>[] | undefined;
        const msg = choices?.[0]?.['message'] as Record<string, unknown> | undefined;
        text = (msg?.['content'] as string) ?? '(empty)';
      }

      return { success: true, response: text, latencyMs };
    } catch (error) {
      const latencyMs = Math.round(performance.now() - start);
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg, latencyMs };
    }
  }

  /**
   * Send a chat completion via IPC proxy. Returns the full response text.
   * Used by DevAgentService for real LLM calls.
   */
  static async chatViaProxy(
    config: LLMProviderUserConfig,
    messages: Array<{ role: string; content: string }>,
  ): Promise<{ text: string; latencyMs: number }> {
    const entry = getCatalogEntry(config.providerId);
    if (!entry) throw new Error(`Unknown provider: ${config.providerId}`);

    const baseUrl = (config.baseUrl || entry.defaultBaseUrl).replace(/\/+$/, '');
    const model = config.defaultModel || entry.defaultModel;
    const isAnthropic = entry.transport === 'anthropic_messages';

    const url = isAnthropic
      ? (baseUrl.endsWith('/v1') ? `${baseUrl}/messages` : `${baseUrl}/v1/messages`)
      : `${baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(entry, config.apiKey),
    };
    if (isAnthropic) {
      headers['anthropic-version'] = '2023-06-01';
    }

    // Build request body
    const systemMsgs = messages.filter((m) => m.role === 'system');
    const nonSystemMsgs = messages.filter((m) => m.role !== 'system');

    const body = isAnthropic
      ? JSON.stringify({
          model,
          max_tokens: 4096,
          ...(systemMsgs.length > 0 ? { system: systemMsgs.map((m) => m.content).join('\n\n') } : {}),
          messages: nonSystemMsgs.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
        })
      : JSON.stringify({
          model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });

    const start = performance.now();
    const bridge = getDesktopBridge();
    let responseBody: string;

    if (bridge?.llmProxy) {
      const proxyResult = await bridge.llmProxy({ url, method: 'POST', headers, body, timeoutMs: 60_000 });
      if (proxyResult.status === 0) {
        let detail = '';
        try { detail = JSON.parse(proxyResult.body)?.error ?? ''; } catch {}
        throw new Error(`网络错误: ${detail || '无法连接'}`);
      }
      if (!proxyResult.ok) {
        throw new Error(`HTTP ${proxyResult.status}: ${proxyResult.body.slice(0, 300)}`);
      }
      responseBody = proxyResult.body;
    } else {
      const resp = await fetch(url, { method: 'POST', headers, body });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${errText.slice(0, 300)}`);
      }
      responseBody = await resp.text();
    }

    const latencyMs = Math.round(performance.now() - start);
    const json = JSON.parse(responseBody) as Record<string, unknown>;

    let text: string;
    if (isAnthropic) {
      const content = json['content'] as readonly Record<string, unknown>[] | undefined;
      text = content?.map((b) => (b['text'] as string) ?? '').join('') ?? '';
    } else {
      const choices = json['choices'] as readonly Record<string, unknown>[] | undefined;
      const msg = choices?.[0]?.['message'] as Record<string, unknown> | undefined;
      text = (msg?.['content'] as string) ?? '';
    }

    return { text, latencyMs };
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
