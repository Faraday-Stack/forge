import { useState, useRef, useCallback } from "react";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  className?: string;
}

// Declare browser SpeechRecognition types (not in all TS lib versions)
declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}

export function VoiceInput({ onTranscript, className }: VoiceInputProps) {
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    (window.SpeechRecognition !== undefined || window.webkitSpeechRecognition !== undefined);

  const toggle = useCallback(() => {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) onTranscript(transcript);
    };

    rec.onend = () => setRecording(false);
    rec.onerror = () => setRecording(false);

    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  }, [recording, onTranscript]);

  if (!isSupported) return null;

  return (
    <button
      type="button"
      className={className}
      data-recording={recording}
      onClick={toggle}
      title={recording ? "Stop recording" : "Voice input"}
      aria-label={recording ? "Stop voice recording" : "Start voice recording"}
    >
      {recording ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      )}
    </button>
  );
}
