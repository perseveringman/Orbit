import { useState, useRef, useEffect, useCallback } from 'react';
import type { AgentChatViewModel, AgentChatMessageViewModel } from './agent-chat-dom-module';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AgentChatPanelProps {
  viewModel: AgentChatViewModel;
  onSendMessage: (message: string) => void;
  onApprove?: (approvalId: string) => void;
  onReject?: (approvalId: string) => void;
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// CSS custom‑property tokens (inline, framework‑free)
// ---------------------------------------------------------------------------

const VAR = {
  bg: 'oklch(0.17 0.005 260)',
  surface: 'oklch(0.22 0.008 260)',
  text: 'oklch(0.93 0.005 260)',
  textSecondary: 'oklch(0.65 0.01 260)',
  accent: 'oklch(0.65 0.15 250)',
  userBg: 'oklch(0.35 0.06 250)',
  assistantBg: 'oklch(0.25 0.01 260)',
  toolBg: 'oklch(0.20 0.015 280)',
  approvalBg: 'oklch(0.30 0.08 80)',
  border: 'oklch(0.30 0.01 260)',
  radius: '12px',
  font: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

// ---------------------------------------------------------------------------
// Sub‑components (private)
// ---------------------------------------------------------------------------

function DomainBadge({ domain }: { domain: string | null }) {
  if (!domain) return null;
  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 999,
        background: VAR.accent,
        color: VAR.bg,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {domain}
    </span>
  );
}

function ProcessingDot() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        borderRadius: VAR.radius,
        background: VAR.assistantBg,
        color: VAR.textSecondary,
        fontSize: 13,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: VAR.accent,
          animation: 'agent-pulse 1.2s ease-in-out infinite',
        }}
      />
      思考中 …
    </span>
  );
}

function ToolCallCard({
  msg,
  isExpanded,
  onToggle,
}: {
  msg: AgentChatMessageViewModel;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        background: VAR.toolBg,
        borderRadius: VAR.radius,
        border: `1px solid ${VAR.border}`,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={onToggle}
        type="button"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '10px 14px',
          background: 'none',
          border: 'none',
          color: VAR.accent,
          cursor: 'pointer',
          fontSize: 13,
          fontFamily: VAR.font,
          textAlign: 'left',
        }}
      >
        <span style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
        <span style={{ fontWeight: 600 }}>{msg.toolName ?? 'tool'}</span>
        <span style={{ color: VAR.textSecondary, marginLeft: 'auto', fontSize: 11 }}>
          {msg.formattedTime}
        </span>
      </button>
      {isExpanded && (
        <div style={{ padding: '0 14px 12px', fontSize: 12, lineHeight: 1.55 }}>
          {msg.toolArgs && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: VAR.textSecondary, marginBottom: 4, fontWeight: 600 }}>参数</div>
              <pre
                style={{
                  margin: 0,
                  padding: 8,
                  borderRadius: 8,
                  background: VAR.bg,
                  color: VAR.text,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  fontSize: 11,
                }}
              >
                {msg.toolArgs}
              </pre>
            </div>
          )}
          {msg.toolResult && (
            <div>
              <div style={{ color: VAR.textSecondary, marginBottom: 4, fontWeight: 600 }}>结果</div>
              <pre
                style={{
                  margin: 0,
                  padding: 8,
                  borderRadius: 8,
                  background: VAR.bg,
                  color: VAR.text,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  fontSize: 11,
                }}
              >
                {msg.toolResult}
              </pre>
            </div>
          )}
          {msg.content && msg.role !== 'tool' && (
            <p style={{ margin: 0, color: VAR.text }}>{msg.content}</p>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: AgentChatMessageViewModel }) {
  if (msg.role === 'system') {
    return (
      <div style={{ textAlign: 'center', padding: '6px 0' }}>
        <span style={{ fontSize: 12, color: VAR.textSecondary, fontStyle: 'italic' }}>{msg.content}</span>
      </div>
    );
  }

  const isUser = msg.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        gap: 4,
      }}
    >
      <span style={{ fontSize: 11, color: VAR.textSecondary, padding: '0 4px' }}>
        {msg.roleLabel} · {msg.formattedTime}
      </span>
      <div
        style={{
          maxWidth: '85%',
          padding: '10px 14px',
          borderRadius: VAR.radius,
          background: isUser ? VAR.userBg : VAR.assistantBg,
          color: VAR.text,
          fontSize: 14,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {msg.content}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgentChatPanel
// ---------------------------------------------------------------------------

export function AgentChatPanel({
  viewModel,
  onSendMessage,
  onApprove,
  onReject,
  onClose,
}: AgentChatPanelProps): JSX.Element {
  const [draft, setDraft] = useState('');
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto‑scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [viewModel.messages.length, viewModel.isProcessing]);

  const toggleTool = useCallback((id: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || viewModel.isProcessing) return;
    setDraft('');
    onSendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: VAR.bg,
        color: VAR.text,
        fontFamily: VAR.font,
        borderLeft: `1px solid ${VAR.border}`,
        overflow: 'hidden',
      }}
    >
      {/* Pulse animation */}
      <style>{`@keyframes agent-pulse{0%,100%{opacity:.35}50%{opacity:1}}`}</style>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 16px',
          borderBottom: `1px solid ${VAR.border}`,
          background: VAR.surface,
          flexShrink: 0,
        }}
      >
        <strong style={{ fontSize: 15 }}>{viewModel.surfaceLabel}</strong>
        <DomainBadge domain={viewModel.currentDomain} />
        <span style={{ flex: 1 }} />
        {onClose && (
          <button
            onClick={onClose}
            type="button"
            aria-label="关闭"
            style={{
              background: 'none',
              border: 'none',
              color: VAR.textSecondary,
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: '2px 6px',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Approval banner */}
      {viewModel.pendingApprovals.length > 0 && (
        <div
          style={{
            padding: '10px 16px',
            background: VAR.approvalBg,
            borderBottom: `1px solid ${VAR.border}`,
            flexShrink: 0,
          }}
        >
          {viewModel.pendingApprovals.map((a) => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 13, flex: 1 }}>
                <strong>{a.capabilityLabel}</strong>：{a.reason}
              </span>
              {onApprove && (
                <button
                  onClick={() => onApprove(a.id)}
                  type="button"
                  style={{
                    padding: '4px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'oklch(0.55 0.14 145)',
                    color: '#fff',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  批准
                </button>
              )}
              {onReject && (
                <button
                  onClick={() => onReject(a.id)}
                  type="button"
                  style={{
                    padding: '4px 12px',
                    borderRadius: 8,
                    border: `1px solid ${VAR.border}`,
                    background: 'none',
                    color: VAR.text,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  拒绝
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Message list */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {viewModel.messages.length === 0 && !viewModel.isProcessing && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: VAR.textSecondary,
              fontSize: 14,
              textAlign: 'center',
              padding: '40px 20px',
            }}
          >
            {viewModel.emptyStateMessage}
          </div>
        )}

        {viewModel.messages.map((msg) =>
          msg.isToolCall ? (
            <ToolCallCard
              key={msg.id}
              msg={msg}
              isExpanded={expandedTools.has(msg.id)}
              onToggle={() => toggleTool(msg.id)}
            />
          ) : (
            <MessageBubble key={msg.id} msg={msg} />
          ),
        )}

        {viewModel.isProcessing && <ProcessingDot />}
      </div>

      {/* Input area */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: `1px solid ${VAR.border}`,
          background: VAR.surface,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息 …"
            disabled={viewModel.isProcessing}
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              padding: '10px 14px',
              borderRadius: VAR.radius,
              border: `1px solid ${VAR.border}`,
              background: VAR.bg,
              color: VAR.text,
              fontSize: 14,
              fontFamily: VAR.font,
              outline: 'none',
              lineHeight: 1.5,
              maxHeight: 120,
              overflow: 'auto',
            }}
          />
          <button
            onClick={handleSend}
            disabled={viewModel.isProcessing || !draft.trim()}
            type="button"
            style={{
              padding: '10px 18px',
              borderRadius: VAR.radius,
              border: 'none',
              background: viewModel.isProcessing || !draft.trim() ? VAR.border : VAR.accent,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: viewModel.isProcessing || !draft.trim() ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              fontFamily: VAR.font,
            }}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
