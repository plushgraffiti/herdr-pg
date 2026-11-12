// pg-usage: Claude Code and Codex subscription limits as plain status-bar text,
// in the footer's own type. No icons, colours, bars or ticks. Hover a service for
// every limit. Settings are the layout's props (lib/view.js lists them).
//
// Data comes from small helpers that run the CLIs themselves (helpers/*.sh);
// this mod never reads a token. Everything below main.js is pure.
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { exec, theme, props, appHome } from "herdr";
import { PROVIDERS } from "./providers/index.js";
import { nextState } from "./lib/state.js";
import { options, barModel } from "./lib/view.js";

const MOD = "pg-usage";
const MISSING_EVERY = 60 * 60; // s, how often a CLI that isn't installed is looked for again

const now = () => Math.floor(Date.now() / 1000);

export default class PgUsage extends View {
  init(_props, cx) {
    this.states = {};    // providerId → ProviderState
    this.lastFetch = {}; // providerId → epoch s of last attempt
    this.busy = {};      // providerId → fetch in flight
    this.tick(cx);
    cx.timer.every(60 * 1000, (cx) => this.tick(cx));
  }

  // Fetch whatever is due, then redraw (countdowns move every minute).
  tick(cx) {
    const o = options(props());
    for (const p of PROVIDERS) {
      if (o.hidden.includes(p.id)) continue;
      const every = this.states[p.id]?.installed === false ? MISSING_EVERY : o.refreshMinutes * 60;
      if (now() - (this.lastFetch[p.id] ?? 0) >= every - 5) this.fetch(p, cx);
    }
    cx.notify();
  }

  fetch(p, cx) {
    if (this.busy[p.id]) return;
    this.busy[p.id] = true;
    this.lastFetch[p.id] = now();
    cx.spawn(async (cx) => {
      const prev = this.states[p.id] ?? { report: null, lastGood: null, installed: null };
      let next;
      try {
        const r = await exec("sh", [`${appHome()}/mods/${MOD}/${p.helper}`]);
        next = r.code === 127 ? nextState(prev, null, false) : nextState(prev, p.parse(r.stdout, now()), true);
      } catch (e) {
        next = { ...prev, report: { status: "error", message: String(e?.message ?? e), plan: null, observedAt: now(), source: p.helper, windows: [] } };
      }
      this.busy[p.id] = false;
      this.states[p.id] = next;
      cx.notify();
    });
  }

  group(g, o, t) {
    return h_flex().id(`pg-${g.id}`).flex_none().gap(8).items_center().opacity(g.dim ? 0.55 : 1).tooltip(g.tip)
      .when(o.showName, (e) => e.child(div().child(g.name)))
      .when(o.showPlan && g.plan != null, (e) => e.child(div().px(5).py(1).rounded(4).bg(t.raised).text_size(10.5).child(g.plan)))
      .when(g.mark != null, (e) => e.child(div().text_color(t.dim).child(g.mark)))
      .children(g.segments.map((s) =>
        h_flex().flex_none().gap(4).items_center()
          .when(o.showLabels, (e) => e.child(div().text_color(t.dim).child(s.label)))
          .child(div().whitespace_nowrap().child(s.text))
          .when(o.showResetTime && s.reset != null, (e) => e.child(div().whitespace_nowrap().text_color(t.dim).child(s.reset)))));
  }

  // The limits alone, with no bar around them: what render() shows, and what
  // another mod can place inside its own bar (it calls init() once, then this).
  content() {
    const t = theme();
    const o = options(props());
    const model = barModel(this.states, o, now());
    return h_flex().flex_none().gap(16).items_center().children(model.groups.map((g) => this.group(g, o, t)));
  }

  render() {
    const t = theme();
    const o = options(props());
    // The same type as Herdr's own status bar (workspace-status).
    return h_flex().size_full().px(14).items_center().overflow_hidden()
      .bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted)
      .when(o.align === "right", (e) => e.justify_end())
      .when(o.align === "center", (e) => e.justify_center())
      .child(this.content());
  }
}
