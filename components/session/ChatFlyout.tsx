"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { X, ArrowUp } from "lucide-react";
import type { ChatMessage } from "@/lib/useChat";

/* ─── Reusable chat messages + input (no header) ──────────── */

interface ChatContentProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

export const ChatContent = memo(function ChatContent({ messages, onSendMessage }: ChatContentProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  // Focus input on mount (preventScroll avoids shifting the page
  // while the flyout panel is still animating from width: 0)
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput("");
  }, [input, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <>
      {/* Messages */}
      <div className="fp-shell-scroll flex flex-1 flex-col overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-center text-sm text-[var(--color-text-tertiary)]">
              Send a message to your<br />focus partner
            </p>
          </div>
        ) : (
          <div className="mt-auto flex flex-col gap-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-3.5 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "rounded-lg rounded-br-sm bg-[var(--color-accent-primary)] text-white"
                      : "rounded-lg rounded-bl-sm bg-white/[0.08] text-[var(--color-text-secondary)]"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-white/5 px-4 py-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-[var(--color-text-tertiary)] outline-none"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-primary)] text-white transition-opacity disabled:opacity-30"
            aria-label="Send message"
          >
            <ArrowUp size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </>
  );
});

/* ─── Standalone flyout with header (kept for compatibility) ─ */

interface ChatFlyoutProps {
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

export function ChatFlyout({ onClose, messages, onSendMessage }: ChatFlyoutProps) {
  // Escape key closes
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      {/* Header */}
      <div className="flex h-20 items-center justify-between px-4 md:px-6">
        <span className="text-base font-semibold text-white">Chat</span>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close chat"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>
      <ChatContent messages={messages} onSendMessage={onSendMessage} />
    </>
  );
}
