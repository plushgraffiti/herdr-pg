// What the bar shows, as plain data. Pure: no Herdr imports.
import { PROVIDERS } from "../providers/index.js";

const STALE_AFTER = 15 * 60; // s

const list = (v) => (Array.isArray(v) ? v.map(String) : []);

// The layout's props, with defaults. Props are the only settings.
//   hidden: [providerId]                  providers left out (and not fetched)
//   hiddenWindows: ["<providerId>:<id>"]  limits left out, e.g. "claude:weekly_all"
//   show: "remaining" | "used"            which percentage each limit shows
//   showName, showPlan, showLabels, showResetTime: booleans, all on by default
//   align: "right" | "center" | "left"
//   refreshMinutes: how often the CLIs are asked (1 or more, default 5)
export function options(p) {
  p = p ?? {};
  const m = Number(p.refreshMinutes);
  return {
    hidden: list(p.hidden),
    hiddenWindows: list(p.hiddenWindows),
    show: p.show === "used" ? "used" : "remaining",
    showName: p.showName !== false,
    showPlan: p.showPlan !== false,
    showLabels: p.showLabels !== false,
    showResetTime: p.showResetTime !== false,
    align: ["left", "center"].includes(p.align) ? p.align : "right",
    refreshMinutes: Number.isFinite(m) && m >= 1 ? m : 5,
  };
}

export function timeLeft(sec) {
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return "<1m";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function ago(epoch, now) {
  const s = Math.max(0, now - epoch);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const clamp = (n) => Math.min(100, Math.max(0, n));
const expired = (w, now) => w.resetsAt != null && w.resetsAt <= now;

// A limit on the bar. One whose reset time has passed shows "—", never a guess.
function segment(w, o, now) {
  if (expired(w, now)) return { id: w.id, label: w.short, text: "—", reset: null };
  const used = clamp(w.percent);
  return {
    id: w.id,
    label: w.short,
    text: `${o.show === "used" ? used : 100 - used}%`,
    reset: w.resetsAt != null ? timeLeft(w.resetsAt - now) : null,
  };
}

// A limit in the hover text: always both numbers, whatever the bar shows.
function tipLine(w, now) {
  if (expired(w, now)) return `${w.long}: reset, waiting for a new reading`;
  const used = clamp(w.percent);
  const reset = w.resetsAt != null ? `, resets in ${timeLeft(w.resetsAt - now)}` : "";
  return `${w.long}: ${100 - used}% left, ${used}% used${reset}`;
}

// ProviderState: { report: Report|null, lastGood: Report|null, installed: true|false|null }
// A provider whose CLI isn't installed is left out. One that fails keeps its last
// good reading, dimmed, with "!". Before the first reading: "…".
export function barModel(states, o, now, providers = PROVIDERS) {
  const groups = [];
  for (const p of providers) {
    if (o.hidden.includes(p.id)) continue;
    const st = states[p.id] ?? { report: null, lastGood: null, installed: null };
    if (st.installed === false) continue;
    let mark = null;
    let source = st.report;
    let status = "Loading…";
    if (!st.report) {
      mark = "…";
      source = null;
    } else if (st.report.status !== "ok") {
      mark = "!";
      source = st.lastGood;
      status = st.report.message ?? st.report.status;
      if (source) status += `\nLast reading ${ago(source.observedAt, now)}`;
    } else {
      status = `Updated ${ago(source.observedAt, now)}`;
    }
    const windows = source?.windows ?? [];
    const shown = windows.filter((w) => !o.hiddenWindows.includes(`${p.id}:${w.id}`));
    const plan = source?.plan ? cap(String(source.plan)) : null;
    groups.push({
      id: p.id,
      name: p.name,
      plan,
      mark,
      dim: mark === "!" || (source != null && now - source.observedAt > STALE_AFTER),
      segments: shown.map((w) => segment(w, o, now)),
      tip: [plan ? `${p.name} ${plan}` : p.name, ...windows.map((w) => tipLine(w, now)), status].join("\n"),
    });
  }
  return { groups };
}
