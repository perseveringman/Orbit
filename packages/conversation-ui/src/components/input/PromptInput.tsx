// ---------------------------------------------------------------------------
// PromptInput – Multi-line textarea with send/cancel and history recall
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';

import { InputFooter } from './InputFooter.js';

// ---- Props ----------------------------------------------------------------

export interface PromptInputProps {
  readonly onSend: (message: string) => void;
  readonly onCancel?: () => void;
  readonly isStreaming?: boolean;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly modelName?: string;
  readonly toolCount?: number;
  readonly tokenCount?: number;
}

// ---- Helpers --------------------------------------------------------------

/** Resize the textarea to fit its content, clamped to 50 vh. */
function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  const maxHeight = window.innerHeight * 0.5;
  el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
}

// ---- Component ------------------------------------------------------------

export const PromptInput = React.memo(function PromptInput({
  onSend,
  onCancel,
  isStreaming = false,
  disabled = false,
  placeholder = '输入消息…',
  modelName,
  toolCount,
  tokenCount,
}: PromptInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Local history state
  const [sentMessages, setSentMessages] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Keep a snapshot of the in-progress draft when the user starts browsing history
  const draftRef = useRef('');

  // ---- Auto-resize on value change ----------------------------------------
  useEffect(() => {
    if (textareaRef.current) autoResize(textareaRef.current);
  }, [value]);

  // ---- Send handler -------------------------------------------------------
  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setSentMessages((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);
    onSend(trimmed);
    setValue('');
  }, [value, onSend]);

  // ---- Key handler --------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+C while streaming → cancel
      if (e.key === 'c' && e.ctrlKey && isStreaming) {
        e.preventDefault();
        onCancel?.();
        return;
      }

      // Enter (without Shift) → send
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        if (!isStreaming && !disabled) handleSend();
        return;
      }

      // Arrow-up when the input is empty → recall history
      if (e.key === 'ArrowUp' && value === '' && sentMessages.length > 0) {
        e.preventDefault();
        const nextIndex =
          historyIndex === -1 ? sentMessages.length - 1 : Math.max(0, historyIndex - 1);

        if (historyIndex === -1) {
          draftRef.current = value;
        }

        setHistoryIndex(nextIndex);
        setValue(sentMessages[nextIndex]);
        return;
      }

      // Arrow-down when browsing history → move forward / restore draft
      if (e.key === 'ArrowDown' && historyIndex !== -1) {
        e.preventDefault();
        const nextIndex = historyIndex + 1;
        if (nextIndex >= sentMessages.length) {
          setHistoryIndex(-1);
          setValue(draftRef.current);
        } else {
          setHistoryIndex(nextIndex);
          setValue(sentMessages[nextIndex]);
        }
      }
    },
    [value, isStreaming, disabled, onCancel, handleSend, sentMessages, historyIndex],
  );

  // ---- Render -------------------------------------------------------------
  return (
    <div className="border-t border-divider bg-default-50">
      <div className="flex items-end gap-2 px-3 pt-3">
        <textarea
          ref={textareaRef}
          className="min-h-[2.5rem] max-h-[50vh] flex-1 resize-none rounded-lg bg-default-100 px-3 py-2 text-sm text-foreground placeholder:text-default-400 outline-none focus:ring-2 focus:ring-primary/40"
          rows={1}
          value={value}
          disabled={disabled && !isStreaming}
          placeholder={placeholder}
          onChange={(e) => {
            setValue(e.target.value);
            setHistoryIndex(-1);
          }}
          onKeyDown={handleKeyDown}
        />

        {isStreaming ? (
          <Button
            variant="danger"
            size="sm"
            className="mb-0.5 shrink-0"
            onPress={onCancel}
            aria-label="取消"
          >
            取消
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            className="mb-0.5 shrink-0"
            isDisabled={disabled || value.trim() === ''}
            onPress={handleSend}
            aria-label="发送"
          >
            发送
          </Button>
        )}
      </div>

      <InputFooter modelName={modelName} toolCount={toolCount} tokenCount={tokenCount} />
    </div>
  );
});
