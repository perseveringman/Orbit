// ---------------------------------------------------------------------------
// @orbit/agent-core – Interaction Tools (M8)
// ---------------------------------------------------------------------------

import type { BuiltinTool, ToolOutput } from './types.js';

// ---- ask_user ----

export const askUserTool: BuiltinTool = {
  name: 'ask_user',
  description: 'Ask the user a question and wait for their response.',
  category: 'interaction',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'The question to ask' },
      choices: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional list of choices for the user to select from',
      },
    },
    required: ['question'],
  },

  async execute(args): Promise<ToolOutput> {
    const question = args.question;
    if (typeof question !== 'string' || question.trim() === '') {
      return {
        success: false,
        output: 'Error: "question" argument is required and must be a non-empty string.',
      };
    }

    const choices = Array.isArray(args.choices)
      ? (args.choices as unknown[]).filter((c): c is string => typeof c === 'string')
      : undefined;

    return {
      success: true,
      output: `[WAITING_FOR_USER] ${question}`,
      metadata: {
        requiresUserInput: true,
        question,
        ...(choices && choices.length > 0 ? { choices } : {}),
      },
    };
  },
};
