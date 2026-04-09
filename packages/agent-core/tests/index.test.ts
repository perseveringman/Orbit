import { describe, expect, it } from 'vitest';

import { AGENT_HANDOFF_VERSION, createHandoffTitle, isAgentRole } from '../src/index';

describe('agent-core', () => {
  it('生成 handoff 标题并校验角色', () => {
    expect(AGENT_HANDOFF_VERSION).toBe(1);
    expect(createHandoffTitle({ taskId: 'task_1', role: 'planner' })).toBe('[planner] task_1');
    expect(isAgentRole('executor')).toBe(true);
  });
});
