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
import { saveOverrides } from "../persistence/client";
import { VoiceInput } from "./VoiceInput";
import styles from "./widget.module.css";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface ChatPanelProps {
  onClose: () => void;
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const store = useAgentStore();
  const connection = useAgentConnection();
  const messages = useStore(store, (s) => s.messages);
  const overrides = useStore(store, (s) => s.overrides);
  const insertedComponents = useStore(store, (s) => s.insertedComponents);
  const injections = useStore(store, (s) => s.injections);
  const themeVars = useStore(store, (s) => s.themeVars);
  const layoutModes = useStore(store, (s) => s.layoutModes);

  const [input, setInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState(() => {
    if (typeof localStorage === "undefined") return "";
    return localStorage.getItem("faraday:end-user-email") ?? "";
  });
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isStreaming = messages.some((m) => m.streaming);

  useEffect(() => {
    if (messages.length === 0) return;
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Listen for `@id` mentions dispatched by InlineEditOverlay's labels.
  // Append `#id ` to whatever the user has typed, focus, and place caret at end.
  useEffect(() => {
    function onMention(e: Event) {
      const ce = e as CustomEvent<{ id: string }>;
      const id = ce.detail?.id;
      if (!id) return;
      const token = `#${id} `;
      setInput((cur) => {
        if (cur.includes(token.trim())) return cur;
        const sep = cur.length === 0 || cur.endsWith(" ") ? "" : " ";
        return cur + sep + token;
      });
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      });
    }
    window.addEventListener("faraday:mention", onMention);
    return () => window.removeEventListener("faraday:mention", onMention);
  }, []);

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

  const hasChanges =
    Object.keys(overrides).length > 0 ||
    Object.keys(insertedComponents).some(
      (k) => (insertedComponents[k]?.length ?? 0) > 0,
    ) ||
    Object.keys(injections).some((k) => (injections[k]?.length ?? 0) > 0) ||
    Object.keys(themeVars).length > 0 ||
    Object.keys(layoutModes).length > 0;

  const submitSave = useCallback(
    async (email: string) => {
      setSaveStatus("saving");
      setSaveError(null);
      try {
        const snapshot = store.getState().getPersistableState();
        const recentMessages = store
          .getState()
          .messages.filter((m) => !m.streaming)
          .map(({ role, content }) => ({ role, content }));
        await saveOverrides(connection, {
          ...snapshot,
          email,
          messages: recentMessages,
        });
        setSaveStatus("saved");
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("faraday:end-user-email", email);
        }
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        setSaveStatus("error");
        setSaveError(err instanceof Error ? err.message : String(err));
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    },
    [connection, store],
  );

  const onSave = useCallback(() => {
    setEmailModalOpen(true);
  }, []);

  const onEmailModalSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = emailInput.trim();
      if (!trimmed || !/.+@.+\..+/.test(trimmed)) return;
      setEmailModalOpen(false);
      void submitSave(trimmed);
    },
    [emailInput, submitSave],
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
        <div className={styles.panelTitle}>
          <span className={styles.titleDot} aria-hidden />
          FaradayStack
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={`${styles.saveBtn} ${
              saveStatus === "saved" ? styles.saveBtnSaved : ""
            } ${saveStatus === "error" ? styles.saveBtnError : ""}`}
            onClick={onSave}
            disabled={
              saveStatus === "saving" || (saveStatus === "idle" && !hasChanges)
            }
            title={saveError ?? undefined}
          >
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "saved"
                ? "Saved ✓"
                : saveStatus === "error"
                  ? "Error"
                  : "Save"}
          </button>
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
      </div>

      <div
        ref={messagesRef}
        className={styles.messages}
        role="log"
        aria-live="polite"
      >
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
          placeholder=""
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

      {emailModalOpen && (
        <div
          role="dialog"
          aria-label="Save changes"
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 10,
          }}
        >
          <form
            onSubmit={onEmailModalSubmit}
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: 18,
              width: "100%",
              maxWidth: 320,
              boxShadow: "0 12px 32px rgba(0,0,0,0.16)",
              fontFamily: "inherit",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              Save these changes
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
              Add your email so the team can follow up with you.
            </div>
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="you@company.com"
              autoFocus
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                fontSize: 13,
                marginBottom: 12,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                onClick={() => setEmailModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  padding: "7px 12px",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  background: "#0f172a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "7px 14px",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
