import { useState, type FormEvent, type CSSProperties } from "react";
import { Modifiable } from "../modifiable/Modifiable";
import { useFormSubmit } from "../provider/context";

export interface FaradayFormProps {
  formId: string;
  title?: string;
  submitLabel?: string;
  successMessage?: string;
}

const styles: Record<string, CSSProperties> = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: "20px 22px",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#111827",
    margin: "12px 0",
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    margin: "0 0 8px",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  submitBtn: {
    background: "#111827",
    color: "#ffffff",
    border: "none",
    borderRadius: 6,
    padding: "8px 18px",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  submitBtnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  status: {
    fontSize: 13,
  },
  statusOk: {
    color: "#15803d",
  },
  statusError: {
    color: "#b91c1c",
  },
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

export function FaradayForm({
  formId,
  title,
  submitLabel = "Submit",
  successMessage = "Thanks!",
}: FaradayFormProps) {
  const onFormSubmit = useFormSubmit();
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "submitting") return;

    const data = new FormData(e.currentTarget);
    const values: Record<string, FormDataEntryValue> = {};
    for (const [k, v] of data.entries()) values[k] = v;

    setState({ kind: "submitting" });
    try {
      if (onFormSubmit) {
        await onFormSubmit(formId, values);
      } else {
        // Default behavior when no host handler is configured.
        // eslint-disable-next-line no-console
        console.info("[Faraday] form submitted", formId, values);
      }
      setState({ kind: "ok", message: successMessage });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form} noValidate={false}>
      {title && <div style={styles.title}>{title}</div>}
      <Modifiable id={formId} type="container" />
      <div style={styles.actions}>
        <button
          type="submit"
          style={{
            ...styles.submitBtn,
            ...(state.kind === "submitting" ? styles.submitBtnDisabled : {}),
          }}
          disabled={state.kind === "submitting"}
        >
          {state.kind === "submitting" ? "Submitting…" : submitLabel}
        </button>
        {state.kind === "ok" && (
          <span style={{ ...styles.status, ...styles.statusOk }}>
            {state.message}
          </span>
        )}
        {state.kind === "error" && (
          <span style={{ ...styles.status, ...styles.statusError }}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
