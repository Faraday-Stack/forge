import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import { useStore } from "zustand";
import { useAgentStore, useAgentConnection } from "../provider/context";
import { streamAgentResponse } from "../streaming/client";
import { VoiceInput } from "./VoiceInput";
import styles from "./widget.module.css";

interface ChatPanelProps {
  onClose: () => void;
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const store = useAgentStore();
  const connection = useAgentConnection();
  const messages = useStore(store, (s) => s.messages);

  const [input, setInput] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isStreaming = messages.some((m) => m.streaming);

  useEffect(() => {
    if (messages.length === 0) return;
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;
      setInput("");

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      await streamAgentResponse({
        connection,
        store,
        userMessage: trimmed,
        signal: abortRef.current.signal,
      });
    },
    [connection, store, isStreaming],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        send(input);
      }
    },
    [input, send],
  );

  const onVoiceTranscript = useCallback((transcript: string) => {
    setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea
  const onInput = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const element = event.target;
      element.style.height = "auto";
      element.style.height = `${Math.min(element.scrollHeight, 120)}px`;
      setInput(element.value);
    },
    [],
  );

  return (
    <div className={styles.panel} role="dialog" aria-label="Faraday UI Agent">
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>UI Agent</span>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div ref={messagesRef} className={styles.messages} role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            Ask me to change anything on this page
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={styles.message} data-role={msg.role}>
            {msg.content}
            {msg.streaming && msg.content === "" && (
              <span className={styles.streamingDot} aria-hidden />
            )}
          </div>
        ))}
      </div>

      <div className={styles.inputRow}>
        <VoiceInput
          onTranscript={onVoiceTranscript}
          className={styles.voiceBtn}
        />
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={input}
          onChange={onInput}
          onKeyDown={onKeyDown}
          placeholder="Ask to change the UI…"
          rows={1}
          aria-label="Message"
          disabled={isStreaming}
        />
        <button
          type="button"
          className={styles.sendBtn}
          onClick={() => send(input)}
          disabled={!input.trim() || isStreaming}
          aria-label="Send"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
