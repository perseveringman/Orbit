import { useState, useEffect, useRef, useCallback, type ReactElement, type KeyboardEvent, type ChangeEvent } from 'react';
import { Bot, X, Send, RotateCcw, Minus, ListTodo, CalendarCheck, Search, BookOpen } from 'lucide-react';
import { Button } from '@heroui/react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface QuickAction {
  id: string;
  label: string;
  icon: ReactElement;
  prompt: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'create-task', label: '创建任务', icon: <ListTodo size={14} />, prompt: '创建任务' },
  { id: 'today-plan', label: '今日计划', icon: <CalendarCheck size={14} />, prompt: '今日计划' },
  { id: 'search', label: '搜索内容', icon: <Search size={14} />, prompt: '搜索内容' },
  { id: 'journal', label: '写日记', icon: <BookOpen size={14} />, prompt: '写日记' },
];

const QUICK_ACTION_RESPONSES: Record<string, string> = {
  创建任务: '请描述你要创建的任务，我会为你创建并安排到合适的项目中。',
  今日计划: '让我分析你的待办事项和截止日期，为你制定今日计划...',
  搜索内容: '你想搜索什么？我可以在你的阅读库、项目和笔记中查找。',
  写日记: '今天想记录什么？我可以帮你整理思路并写入日记。',
};

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: '你好！我是 Orbit Agent，你的智能助手。有什么我可以帮你的吗？',
  timestamp: Date.now(),
};

let nextId = 0;
function uid(): string {
  return `msg-${Date.now()}-${++nextId}`;
}

/* ------------------------------------------------------------------ */
/*  Mock response generator                                            */
/* ------------------------------------------------------------------ */

function generateMockResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes('任务') || lower.includes('task'))
    return '好的，我来帮你创建任务。请告诉我任务的标题、截止日期和优先级。';
  if (lower.includes('计划') || lower.includes('plan'))
    return '根据你今天的待办事项，建议先处理高优先级任务，然后安排深度工作时段。';
  if (lower.includes('搜索') || lower.includes('search') || lower.includes('找'))
    return '我可以在你的项目、阅读库和笔记中搜索。请告诉我你要找什么？';
  if (lower.includes('日记') || lower.includes('journal'))
    return '开始记录今天的日记吧。你可以写下今天的感悟、完成的事情、或者任何想法。';
  if (lower.includes('你好') || lower.includes('hello') || lower.includes('hi'))
    return '你好！很高兴为你服务。我可以帮你管理任务、制定计划、搜索内容或写日记。';
  return '收到！让我为你处理这个请求。如果需要更多信息，请随时告诉我。';
}

/* ------------------------------------------------------------------ */
/*  MessageBubble                                                      */
/* ------------------------------------------------------------------ */

function MessageBubble({ message }: { message: Message }): ReactElement {
  if (message.role === 'system') {
    return (
      <div className="flex justify-center">
        <span className="text-xs text-muted px-3 py-1">{message.content}</span>
      </div>
    );
  }

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-foreground text-background rounded-2xl rounded-br-sm px-3.5 py-2 max-w-[85%] text-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="flex gap-2 max-w-[85%]">
        <div className="w-6 h-6 rounded-full bg-surface-secondary flex items-center justify-center shrink-0 mt-0.5">
          <Bot size={12} />
        </div>
        <div className="bg-surface-secondary rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm">
          {message.content}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TypingIndicator                                                    */
/* ------------------------------------------------------------------ */

function TypingIndicator(): ReactElement {
  return (
    <div className="flex justify-start">
      <div className="flex gap-2 max-w-[85%]">
        <div className="w-6 h-6 rounded-full bg-surface-secondary flex items-center justify-center shrink-0 mt-0.5">
          <Bot size={12} />
        </div>
        <div className="bg-surface-secondary rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  GlobalAgentWidget                                                  */
/* ------------------------------------------------------------------ */

export function GlobalAgentWidget(): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Auto-scroll on new messages */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  /* Focus textarea when expanded */
  useEffect(() => {
    if (expanded) {
      // Small delay to allow animation to start
      const timer = setTimeout(() => textareaRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [expanded]);

  /* Listen for global toggle event (⌘⇧A) */
  useEffect(() => {
    const handler = () => setExpanded(prev => !prev);
    window.addEventListener('orbit:toggle-agent', handler);
    return () => window.removeEventListener('orbit:toggle-agent', handler);
  }, []);

  /* Simulate agent response */
  const simulateResponse = useCallback((userText: string) => {
    setIsTyping(true);
    const delay = 600 + Math.random() * 800;
    const timer = setTimeout(() => {
      const response = QUICK_ACTION_RESPONSES[userText] ?? generateMockResponse(userText);
      setMessages(prev => [
        ...prev,
        { id: uid(), role: 'assistant', content: response, timestamp: Date.now() },
      ]);
      setIsTyping(false);
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  /* Send a message */
  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setMessages(prev => [
        ...prev,
        { id: uid(), role: 'user', content: trimmed, timestamp: Date.now() },
      ]);
      setInput('');
      simulateResponse(trimmed);
    },
    [simulateResponse],
  );

  const handleSend = useCallback(() => sendMessage(input), [input, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input);
      }
    },
    [input, sendMessage],
  );

  const handleClear = useCallback(() => {
    setMessages([
      {
        id: uid(),
        role: 'system',
        content: '对话已清空',
        timestamp: Date.now(),
      },
      { ...WELCOME_MESSAGE, id: uid(), timestamp: Date.now() },
    ]);
  }, []);

  const handleMinimize = useCallback(() => setExpanded(false), []);
  const toggle = useCallback(() => setExpanded(prev => !prev), []);

  const handleQuickAction = useCallback(
    (action: QuickAction) => sendMessage(action.prompt),
    [sendMessage],
  );

  const handleInputChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  /* Auto-resize textarea */
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 96)}px`;
    }
  }, [input]);

  return (
    <>
      {/* Expanded chat panel */}
      {expanded && (
        <div
          className="fixed bottom-24 right-6 z-50 w-[420px] h-[560px] flex flex-col
                     bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden
                     animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-foreground" />
              <span className="font-semibold text-sm">Orbit Agent</span>
              <span className="w-2 h-2 rounded-full bg-green-500" />
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" isIconOnly size="sm" onPress={handleClear}>
                <RotateCcw size={14} />
              </Button>
              <Button variant="ghost" isIconOnly size="sm" onPress={handleMinimize}>
                <Minus size={14} />
              </Button>
            </div>
          </div>

          {/* Quick actions bar */}
          <div className="flex gap-2 px-4 py-2 border-b border-border overflow-x-auto">
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.id}
                type="button"
                className="flex items-center gap-1.5 shrink-0 rounded-lg border border-border
                           px-2.5 py-1 text-xs text-foreground/80 hover:bg-surface-secondary
                           transition-colors duration-150"
                onClick={() => handleQuickAction(action)}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="px-4 py-3 border-t border-border">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm
                           resize-none focus:outline-none focus:ring-1 focus:ring-foreground/20 max-h-24"
                placeholder="Ask anything... (⌘⇧A)"
                rows={1}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
              />
              <Button variant="primary" isIconOnly size="sm" onPress={handleSend} isDisabled={!input.trim()}>
                <Send size={14} />
              </Button>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px] text-muted">Powered by Orbit Agent</span>
              <span className="text-[11px] text-muted">⌘⇧A to toggle</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating action button */}
      <button
        type="button"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-foreground text-background
                   shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center
                   hover:scale-105 active:scale-95"
        onClick={toggle}
        aria-label={expanded ? 'Close Orbit Agent' : 'Open Orbit Agent'}
      >
        {expanded ? <X size={24} /> : <Bot size={24} />}
      </button>
    </>
  );
}
