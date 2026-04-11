// ---------------------------------------------------------------------------
// @orbit/agent-core – Provider Catalog
// Defines all supported LLM providers matching hermes-agent's HERMES_OVERLAYS.
// ---------------------------------------------------------------------------

// ---- Types ----

export type TransportType = 'openai_chat' | 'anthropic_messages' | 'codex_responses';
export type AuthType = 'api_key' | 'oauth_device_code' | 'oauth_external' | 'external_process';

export interface ProviderCatalogEntry {
  /** Unique provider identifier (matches hermes-agent). */
  readonly id: string;
  /** Human-readable display name. */
  readonly displayName: string;
  /** Wire protocol — determines which adapter class to use. */
  readonly transport: TransportType;
  /** Authentication method. */
  readonly authType: AuthType;
  /** Whether this provider aggregates multiple upstream providers. */
  readonly isAggregator: boolean;
  /** Default base URL for API requests. Empty if requires user config. */
  readonly defaultBaseUrl: string;
  /** Environment variable name for overriding the base URL. */
  readonly baseUrlEnvVar?: string;
  /** Environment variable names to check for API key (in priority order). */
  readonly apiKeyEnvVars: readonly string[];
  /** URL to GET for connectivity/health check (typically /models endpoint). */
  readonly healthCheckUrl?: string;
  /** Recommended default model. */
  readonly defaultModel: string;
  /** Short description. */
  readonly description: string;
  /** Provider documentation URL. */
  readonly docUrl?: string;
  /** Whether health check uses x-api-key header instead of Bearer. */
  readonly usesXApiKey?: boolean;
  /** Whether to use Authorization: Bearer instead of x-api-key for Anthropic-compatible endpoints. */
  readonly useBearerAuth?: boolean;
}

// ---- Provider Catalog (19 providers matching hermes-agent) ----

export const PROVIDER_CATALOG: readonly ProviderCatalogEntry[] = [
  // 1. OpenRouter — aggregator routing to 100+ providers
  {
    id: 'openrouter',
    displayName: 'OpenRouter',
    transport: 'openai_chat',
    authType: 'api_key',
    isAggregator: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    baseUrlEnvVar: 'OPENROUTER_BASE_URL',
    apiKeyEnvVars: ['OPENROUTER_API_KEY', 'OPENAI_API_KEY'],
    healthCheckUrl: 'https://openrouter.ai/api/v1/models',
    defaultModel: 'anthropic/claude-sonnet-4',
    description: 'AI model aggregator with 100+ models from all major providers',
    docUrl: 'https://openrouter.ai/docs',
  },

  // 2. Anthropic — Claude models
  {
    id: 'anthropic',
    displayName: 'Anthropic',
    transport: 'anthropic_messages',
    authType: 'api_key',
    isAggregator: false,
    defaultBaseUrl: 'https://api.anthropic.com',
    apiKeyEnvVars: ['ANTHROPIC_API_KEY', 'ANTHROPIC_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN'],
    healthCheckUrl: 'https://api.anthropic.com/v1/models',
    defaultModel: 'claude-sonnet-4-20250514',
    description: 'Claude family — Opus, Sonnet, Haiku',
    docUrl: 'https://docs.anthropic.com',
    usesXApiKey: true,
  },

  // 3. DeepSeek
  {
    id: 'deepseek',
    displayName: 'DeepSeek',
    transport: 'openai_chat',
    authType: 'api_key',
    isAggregator: false,
    defaultBaseUrl: 'https://api.deepseek.com',
    baseUrlEnvVar: 'DEEPSEEK_BASE_URL',
    apiKeyEnvVars: ['DEEPSEEK_API_KEY'],
    healthCheckUrl: 'https://api.deepseek.com/models',
    defaultModel: 'deepseek-chat',
    description: 'DeepSeek Reasoner & Chat models',
    docUrl: 'https://platform.deepseek.com/docs',
  },

  // 4. Z.AI / GLM (Zhipu AI)
  {
    id: 'zai',
    displayName: 'Z.AI / GLM',
    transport: 'openai_chat',
    authType: 'api_key',
    isAggregator: false,
    defaultBaseUrl: 'https://api.z.ai/api/coding/paas/v4',
    baseUrlEnvVar: 'GLM_BASE_URL',
    apiKeyEnvVars: ['GLM_API_KEY', 'ZAI_API_KEY', 'Z_AI_API_KEY'],
    healthCheckUrl: 'https://api.z.ai/api/coding/paas/v4/models',
    defaultModel: 'glm-4-plus',
    description: 'Zhipu AI — GLM-4 family',
    docUrl: 'https://open.bigmodel.cn/dev/api',
  },

  // 5. Kimi / Moonshot
  {
    id: 'kimi-for-coding',
    displayName: 'Kimi / Moonshot',
    transport: 'anthropic_messages',
    authType: 'api_key',
    isAggregator: false,
    defaultBaseUrl: 'https://api.kimi.com/coding',
    baseUrlEnvVar: 'KIMI_BASE_URL',
    apiKeyEnvVars: ['KIMI_API_KEY'],
    defaultModel: 'kimi-code',
    description: 'Kimi coding-optimized models (Anthropic Messages API)',
    docUrl: 'https://platform.moonshot.cn/docs',
    useBearerAuth: true,
  },

  // 6. MiniMax (global)
  {
    id: 'minimax',
    displayName: 'MiniMax',
    transport: 'anthropic_messages',
    authType: 'api_key',
    isAggregator: false,
    defaultBaseUrl: 'https://api.minimax.io/anthropic',
    baseUrlEnvVar: 'MINIMAX_BASE_URL',
    apiKeyEnvVars: ['MINIMAX_API_KEY'],
    defaultModel: 'MiniMax-M2.7',
    description: 'MiniMax language models (global endpoint, Bearer auth)',
    docUrl: 'https://platform.minimax.io/docs/api-reference/text-anthropic-api',
    useBearerAuth: true,
  },

  // 7. MiniMax China
  {
    id: 'minimax-cn',
    displayName: 'MiniMax (China)',
    transport: 'anthropic_messages',
    authType: 'api_key',
    isAggregator: false,
    defaultBaseUrl: 'https://api.minimaxi.com/anthropic',
    baseUrlEnvVar: 'MINIMAX_CN_BASE_URL',
    apiKeyEnvVars: ['MINIMAX_CN_API_KEY'],
    defaultModel: 'MiniMax-M2.7',
    description: 'MiniMax — China domestic endpoint (Bearer auth)',
    docUrl: 'https://platform.minimax.io/docs/api-reference/text-anthropic-api',
    useBearerAuth: true,
  },

  // 8. Alibaba / DashScope (Qwen)
  {
    id: 'alibaba',
    displayName: 'Alibaba / DashScope',
    transport: 'openai_chat',
    authType: 'api_key',
    isAggregator: false,
    defaultBaseUrl: 'https://coding-intl.dashscope.aliyuncs.com/v1',
    baseUrlEnvVar: 'DASHSCOPE_BASE_URL',
    apiKeyEnvVars: ['DASHSCOPE_API_KEY'],
    healthCheckUrl: 'https://coding-intl.dashscope.aliyuncs.com/v1/models',
    defaultModel: 'qwen-max',
    description: 'Alibaba Cloud — Qwen series via DashScope',
    docUrl: 'https://help.aliyun.com/zh/dashscope',
  },

  // 9. X.AI / Grok
  {
    id: 'xai',
    displayName: 'X.AI / Grok',
    transport: 'openai_chat',
    authType: 'api_key',
    isAggregator: false,
    defaultBaseUrl: 'https://api.x.ai/v1',
    baseUrlEnvVar: 'XAI_BASE_URL',
    apiKeyEnvVars: ['XAI_API_KEY'],
    healthCheckUrl: 'https://api.x.ai/v1/models',
    defaultModel: 'grok-3',
    description: 'xAI Grok models',
    docUrl: 'https://docs.x.ai',
  },

  // 10. GitHub Copilot
  {
    id: 'github-copilot',
    displayName: 'GitHub Copilot',
    transport: 'openai_chat',
    authType: 'api_key',
    isAggregator: false,
    defaultBaseUrl: 'https://api.githubcopilot.com',
    apiKeyEnvVars: ['COPILOT_GITHUB_TOKEN', 'GH_TOKEN'],
    defaultModel: 'gpt-4o',
    description: 'GitHub Copilot — requires GitHub token',
    docUrl: 'https://docs.github.com/en/copilot',
  },

  // 11. Hugging Face
  {
    id: 'huggingface',
    displayName: 'Hugging Face',
    transport: 'openai_chat',
    authType: 'api_key',
    isAggregator: true,
    defaultBaseUrl: 'https://router.huggingface.co/v1',
    baseUrlEnvVar: 'HF_BASE_URL',
    apiKeyEnvVars: ['HF_TOKEN'],
    healthCheckUrl: 'https://router.huggingface.co/v1/models',
    defaultModel: 'meta-llama/Llama-3.1-8B-Instruct',
    description: 'Hugging Face Inference API — open models',
    docUrl: 'https://huggingface.co/docs/api-inference',
  },

  // 12. Vercel AI Gateway
  {
    id: 'vercel',
    displayName: 'Vercel AI Gateway',
    transport: 'openai_chat',
    authType: 'api_key',
    isAggregator: true,
    defaultBaseUrl: 'https://ai-gateway.vercel.sh/v1',
    apiKeyEnvVars: ['AI_GATEWAY_API_KEY'],
    healthCheckUrl: 'https://ai-gateway.vercel.sh/v1/models',
    defaultModel: 'anthropic/claude-sonnet-4',
    description: 'Vercel AI Gateway — multi-provider routing',
    docUrl: 'https://vercel.com/docs/ai-gateway',
  },

  // 13. OpenCode Zen
  {
    id: 'opencode',
    displayName: 'OpenCode Zen',
    transport: 'openai_chat',
    authType: 'api_key',
    isAggregator: true,
    defaultBaseUrl: 'https://opencode.ai/zen/v1',
    baseUrlEnvVar: 'OPENCODE_ZEN_BASE_URL',
    apiKeyEnvVars: ['OPENCODE_ZEN_API_KEY'],
    defaultModel: 'claude-sonnet-4',
    description: 'OpenCode Zen aggregator',
  },

  // 14. OpenCode Go
  {
    id: 'opencode-go',
    displayName: 'OpenCode Go',
    transport: 'openai_chat',
    authType: 'api_key',
    isAggregator: true,
    defaultBaseUrl: 'https://opencode.ai/zen/go/v1',
    baseUrlEnvVar: 'OPENCODE_GO_BASE_URL',
    apiKeyEnvVars: ['OPENCODE_GO_API_KEY'],
    defaultModel: 'claude-sonnet-4',
    description: 'OpenCode Go aggregator',
  },

  // 15. KiloCode
  {
    id: 'kilo',
    displayName: 'KiloCode',
    transport: 'openai_chat',
    authType: 'api_key',
    isAggregator: true,
    defaultBaseUrl: 'https://api.kilo.ai/api/gateway',
    baseUrlEnvVar: 'KILOCODE_BASE_URL',
    apiKeyEnvVars: ['KILOCODE_API_KEY'],
    defaultModel: 'claude-sonnet-4',
    description: 'KiloCode gateway',
  },

  // 16. Nous Research
  {
    id: 'nous',
    displayName: 'Nous Research',
    transport: 'openai_chat',
    authType: 'oauth_device_code',
    isAggregator: false,
    defaultBaseUrl: 'https://inference-api.nousresearch.com/v1',
    apiKeyEnvVars: [],
    healthCheckUrl: 'https://inference-api.nousresearch.com/v1/models',
    defaultModel: 'hermes-3-llama-3.1-8b',
    description: 'Nous Research Portal — OAuth device code auth',
    docUrl: 'https://nousresearch.com',
  },

  // 17. OpenAI Codex
  {
    id: 'openai-codex',
    displayName: 'OpenAI Codex',
    transport: 'codex_responses',
    authType: 'oauth_external',
    isAggregator: false,
    defaultBaseUrl: 'https://api.openai.com/v1',
    apiKeyEnvVars: ['OPENAI_API_KEY'],
    defaultModel: 'codex-mini',
    description: 'OpenAI Codex Responses API — requires OAuth',
    docUrl: 'https://platform.openai.com/docs',
  },

  // 18. Qwen (OAuth)
  {
    id: 'qwen-oauth',
    displayName: 'Qwen (OAuth)',
    transport: 'openai_chat',
    authType: 'oauth_external',
    isAggregator: false,
    defaultBaseUrl: 'https://portal.qwen.ai/v1',
    baseUrlEnvVar: 'HERMES_QWEN_BASE_URL',
    apiKeyEnvVars: [],
    defaultModel: 'qwen-max',
    description: 'Qwen Portal — OAuth external auth',
    docUrl: 'https://help.aliyun.com/zh/dashscope',
  },

  // 19. GitHub Copilot ACP
  {
    id: 'copilot-acp',
    displayName: 'GitHub Copilot ACP',
    transport: 'codex_responses',
    authType: 'external_process',
    isAggregator: false,
    defaultBaseUrl: 'acp://copilot',
    baseUrlEnvVar: 'COPILOT_ACP_BASE_URL',
    apiKeyEnvVars: [],
    defaultModel: 'claude-sonnet-4',
    description: 'GitHub Copilot Agent Control Protocol — requires copilot CLI',
    docUrl: 'https://docs.github.com/en/copilot',
  },
] as const;

// ---- Lookup Helpers ----

const catalogMap = new Map(PROVIDER_CATALOG.map((e) => [e.id, e]));

/** Get a catalog entry by provider ID. */
export function getCatalogEntry(providerId: string): ProviderCatalogEntry | undefined {
  return catalogMap.get(providerId);
}

/** List provider IDs that support simple API key auth (configurable in UI). */
export function getApiKeyProviders(): readonly ProviderCatalogEntry[] {
  return PROVIDER_CATALOG.filter((e) => e.authType === 'api_key');
}

/** List all provider IDs. */
export function getProviderIds(): readonly string[] {
  return PROVIDER_CATALOG.map((e) => e.id);
}

// ---- Provider Aliases (matching hermes-agent) ----

export const PROVIDER_ALIASES: Readonly<Record<string, string>> = {
  'openai': 'openrouter',
  'glm': 'zai',
  'z-ai': 'zai',
  'zhipu': 'zai',
  'x-ai': 'xai',
  'kimi': 'kimi-for-coding',
  'kimi-coding': 'kimi-for-coding',
  'moonshot': 'kimi-for-coding',
  'minimax-china': 'minimax-cn',
  'claude': 'anthropic',
  'claude-code': 'anthropic',
  'copilot': 'github-copilot',
  'github': 'github-copilot',
  'github-copilot-acp': 'copilot-acp',
  'ai-gateway': 'vercel',
  'aigateway': 'vercel',
  'vercel-ai-gateway': 'vercel',
  'opencode-zen': 'opencode',
  'zen': 'opencode',
  'go': 'opencode-go',
  'kilocode': 'kilo',
  'kilo-code': 'kilo',
  'deep-seek': 'deepseek',
  'dashscope': 'alibaba',
  'aliyun': 'alibaba',
  'qwen': 'alibaba',
  'hf': 'huggingface',
  'hugging-face': 'huggingface',
};

/** Resolve a provider name (supporting aliases). */
export function resolveProviderName(name: string): string {
  const key = name.trim().toLowerCase();
  return PROVIDER_ALIASES[key] ?? key;
}
