/**
 * Perception helpers — read more *structure* out of the live DOM than the
 * visible-text dump alone. Surfaced in the system prompt so the agent can
 * (a) treat charts/tables as data, (b) match the host's actual visual rhythm,
 * and (c) pick a tone that feels intentional rather than random.
 *
 * All helpers are SSR-safe: they no-op when document/window is undefined.
 */

import type { AgentStore } from "../provider/store";

/* ------------------------------------------------------------------ */
/* Tabular data extraction                                             */
/* ------------------------------------------------------------------ */

export interface ExtractedTable {
  /** Best-effort table label — caption, preceding heading, or the table id/class. */
  label: string;
  columns: string[];
  rows: Array<Record<string, string>>;
}

const MAX_TABLES = 4;
const MAX_ROWS_PER_TABLE = 30;

function findTableLabel(table: HTMLTableElement): string {
  const caption = table.querySelector("caption");
  if (caption?.textContent) return caption.textContent.trim();
  let prev = table.previousElementSibling;
  while (prev) {
    if (/^H[1-6]$/.test(prev.tagName) && prev.textContent) {
      return prev.textContent.trim();
    }
    prev = prev.previousElementSibling;
  }
  return table.id || table.className.split(/\s+/).filter(Boolean)[0] || "table";
}

/**
 * Walk the DOM under each registered Modifiable for `<table>` elements with a
 * detectable header row. Returns up to MAX_TABLES extracted as JSON.
 */
export function extractTables(roots: HTMLElement[]): ExtractedTable[] {
  const seen = new Set<HTMLTableElement>();
  const out: ExtractedTable[] = [];

  for (const root of roots) {
    if (out.length >= MAX_TABLES) break;
    const tables = Array.from(root.querySelectorAll("table"));
    for (const t of tables) {
      if (out.length >= MAX_TABLES) break;
      if (seen.has(t)) continue;
      seen.add(t);
      const headerCells = Array.from(
        t.querySelectorAll("thead th, thead td"),
      ) as HTMLElement[];
      let columns: string[];
      let bodyRows: HTMLTableRowElement[];
      if (headerCells.length > 0) {
        columns = headerCells.map((c) => c.textContent?.trim() ?? "");
        bodyRows = Array.from(t.querySelectorAll("tbody tr")) as HTMLTableRowElement[];
      } else {
        // No <thead>: treat the first row as headers if all cells are <th> or
        // every cell has no other obvious structure.
        const allRows = Array.from(t.querySelectorAll("tr")) as HTMLTableRowElement[];
        if (allRows.length < 2) continue;
        const first = allRows[0];
        columns = Array.from(first.children).map(
          (c) => (c as HTMLElement).textContent?.trim() ?? "",
        );
        bodyRows = allRows.slice(1);
      }
      if (columns.length === 0 || bodyRows.length === 0) continue;
      const rows: Array<Record<string, string>> = [];
      for (const r of bodyRows.slice(0, MAX_ROWS_PER_TABLE)) {
        const cells = Array.from(r.children) as HTMLElement[];
        const obj: Record<string, string> = {};
        for (let i = 0; i < columns.length; i++) {
          obj[columns[i] || `col${i}`] = (cells[i]?.textContent ?? "").trim();
        }
        rows.push(obj);
      }
      out.push({ label: findTableLabel(t), columns, rows });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Repeating-list extraction                                           */
/* ------------------------------------------------------------------ */

export interface ExtractedList {
  /** id/class of the container, or "(unnamed)". */
  label: string;
  /** Each entry is a short text representation of one row (≤ 80 chars). */
  entries: string[];
}

const MAX_LISTS = 4;
const MAX_ENTRIES_PER_LIST = 12;
const MIN_REPEATING_CHILDREN = 3;

function isLikelyRepeating(parent: Element): boolean {
  const kids = Array.from(parent.children);
  if (kids.length < MIN_REPEATING_CHILDREN) return false;
  // Heuristic: ≥80% of children share the same tag and roughly similar shape
  // (number of element children within ±1).
  const tag = kids[0].tagName;
  const childCount = kids[0].children.length;
  let agree = 0;
  for (const k of kids) {
    if (k.tagName !== tag) continue;
    if (Math.abs(k.children.length - childCount) > 1) continue;
    agree++;
  }
  return agree / kids.length >= 0.8;
}

/**
 * Extract obvious repeating list/grid patterns nested inside registered
 * Modifiables (e.g. `<ul><li>…</li></ul>`, or a flex/grid of cards). Each
 * entry is the row's plain text, capped to keep prompt size sane.
 */
export function extractRepeatingLists(roots: HTMLElement[]): ExtractedList[] {
  const out: ExtractedList[] = [];
  const seen = new Set<Element>();

  for (const root of roots) {
    if (out.length >= MAX_LISTS) break;
    const candidates = root.querySelectorAll("ul, ol, [role='list'], [data-list]");
    for (const c of Array.from(candidates)) {
      if (out.length >= MAX_LISTS) break;
      if (seen.has(c)) continue;
      seen.add(c);
      if (!isLikelyRepeating(c)) continue;
      const entries: string[] = [];
      for (const k of Array.from(c.children).slice(0, MAX_ENTRIES_PER_LIST)) {
        const text = ((k as HTMLElement).innerText ?? k.textContent ?? "")
          .replace(/\s+/g, " ")
          .trim();
        if (!text) continue;
        entries.push(text.length > 80 ? text.slice(0, 80) + "…" : text);
      }
      if (entries.length < MIN_REPEATING_CHILDREN) continue;
      const label = c.id || (c as HTMLElement).className?.split(/\s+/)?.[0] || "(unnamed)";
      out.push({ label, entries });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Neighborhood computed-style sniffing                                */
/* ------------------------------------------------------------------ */

const NEIGHBORHOOD_PROPS = [
  "fontSize",
  "fontWeight",
  "color",
  "backgroundColor",
  "padding",
  "borderRadius",
  "border",
] as const;

export type ComputedSlice = Partial<Record<(typeof NEIGHBORHOOD_PROPS)[number], string>>;

export interface NeighborhoodEntry {
  id: string;
  self: ComputedSlice;
  /** Computed slice of the previous sibling, when present. */
  prevSibling?: ComputedSlice;
  /** Computed slice of the next sibling, when present. */
  nextSibling?: ComputedSlice;
}

const MAX_NEIGHBORHOODS = 24;

function sliceComputed(el: Element | null): ComputedSlice | undefined {
  if (!el || typeof window === "undefined") return undefined;
  const cs = window.getComputedStyle(el);
  const out: Record<string, string> = {};
  for (const k of NEIGHBORHOOD_PROPS) {
    const v = cs.getPropertyValue(
      k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()),
    );
    if (v) out[k] = v.trim();
  }
  // Drop noisy zero-valued keys to keep the prompt tight.
  if (out.padding === "0px") delete out.padding;
  if (out.borderRadius === "0px") delete out.borderRadius;
  if (out.border === "0px none rgb(0, 0, 0)") delete out.border;
  return out as ComputedSlice;
}

/**
 * Capture computed-style fingerprints for each registered modifiable so the
 * agent can match the host page's actual rhythm rather than guessing.
 */
export function extractNeighborhoodStyles(
  store: AgentStore,
): NeighborhoodEntry[] {
  if (typeof document === "undefined") return [];
  const ids = Object.keys(store.getState().registry).filter(
    (id) => !id.startsWith("__"),
  );
  const out: NeighborhoodEntry[] = [];
  for (const id of ids.slice(0, MAX_NEIGHBORHOODS)) {
    const el = document.getElementById(id);
    if (!el) continue;
    const self = sliceComputed(el);
    if (!self) continue;
    const entry: NeighborhoodEntry = { id, self };
    const prev = sliceComputed(el.previousElementSibling);
    const next = sliceComputed(el.nextElementSibling);
    if (prev && Object.keys(prev).length > 0) entry.prevSibling = prev;
    if (next && Object.keys(next).length > 0) entry.nextSibling = next;
    out.push(entry);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Theme character                                                     */
/* ------------------------------------------------------------------ */

export interface ThemeCharacter {
  mode: "light" | "dark" | "unknown";
  /** Median padding (px) across registered modifiables — proxy for density. */
  density: "compact" | "comfortable" | "spacious" | "unknown";
  /** Free-form summary suitable for the system prompt. */
  summary: string;
}

function parseRgb(value: string): { r: number; g: number; b: number } | null {
  // matches `rgb(r, g, b)` or `rgba(r, g, b, a)`
  const m = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3] };
}

function rgbLuminance(r: number, g: number, b: number): number {
  // Perceptual luminance approximation (YIQ).
  return (r * 299 + g * 587 + b * 114) / 1000 / 255;
}

/**
 * Inspect the document's computed background + the median element padding
 * across registered modifiables to produce a one-line "feel" hint.
 */
export function analyzeThemeCharacter(store: AgentStore): ThemeCharacter {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return { mode: "unknown", density: "unknown", summary: "" };
  }

  // Mode: walk up from <body> for the first non-transparent background.
  let mode: ThemeCharacter["mode"] = "unknown";
  for (const el of [document.body, document.documentElement]) {
    if (!el) continue;
    const cs = window.getComputedStyle(el);
    const bg = cs.backgroundColor;
    const rgb = parseRgb(bg);
    if (!rgb) continue;
    const lum = rgbLuminance(rgb.r, rgb.g, rgb.b);
    if (lum >= 0.5) mode = "light";
    else mode = "dark";
    break;
  }

  // Density: median of meaningful (non-zero) paddings.
  const ids = Object.keys(store.getState().registry).filter(
    (id) => !id.startsWith("__"),
  );
  const paddings: number[] = [];
  for (const id of ids.slice(0, 40)) {
    const el = document.getElementById(id);
    if (!el) continue;
    const cs = window.getComputedStyle(el);
    const p = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    if (!Number.isNaN(p) && p > 0) paddings.push(p);
  }
  let density: ThemeCharacter["density"] = "unknown";
  if (paddings.length >= 3) {
    paddings.sort((a, b) => a - b);
    const median = paddings[Math.floor(paddings.length / 2)];
    if (median <= 16) density = "compact";
    else if (median <= 32) density = "comfortable";
    else density = "spacious";
  }

  const parts: string[] = [];
  if (mode !== "unknown") parts.push(`${mode}-mode page`);
  if (density !== "unknown") parts.push(`${density} spacing`);
  const summary = parts.length > 0 ? parts.join(", ") : "";

  return { mode, density, summary };
}
