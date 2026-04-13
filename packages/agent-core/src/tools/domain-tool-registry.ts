// ---------------------------------------------------------------------------
// @orbit/agent-core – Domain Tool Registry
// ---------------------------------------------------------------------------

import { TASK_DOMAIN_TOOLSETS } from './task-domain-tools.js';
import { READER_DOMAIN_TOOLSETS } from './reader-domain-tools.js';
import { JOURNAL_DOMAIN_TOOLSETS } from './journal-domain-tools.js';
import { VISION_DOMAIN_TOOLSETS } from './vision-domain-tools.js';
import type { Toolset } from './toolset-registry.js';

export const DOMAIN_TOOLSETS: Toolset[] = [
  ...TASK_DOMAIN_TOOLSETS,
  ...READER_DOMAIN_TOOLSETS,
  ...JOURNAL_DOMAIN_TOOLSETS,
  ...VISION_DOMAIN_TOOLSETS,
];

export { TASK_DOMAIN_TOOLSETS, READER_DOMAIN_TOOLSETS, JOURNAL_DOMAIN_TOOLSETS, VISION_DOMAIN_TOOLSETS };
