// Claude Code status line: rate-limit usage with live countdowns.
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let d = {};
  try {
    d = JSON.parse(raw);
  } catch {}

  const rgb = (r, g, b, s) => `\x1b[38;2;${r};${g};${b}m${s}\x1b[0m`;
  const dim = (s) => `\x1b[38;2;110;110;125m${s}\x1b[0m`;
  const sep = dim("  ·  ");

  // mint -> amber -> coral, shifting with how much is burned
  const hue = (t) =>
    t < 0.5
      ? [Math.round(90 + t * 2 * 155), Math.round(220 - t * 2 * 30), Math.round(160 - t * 2 * 90)]
      : [245, Math.round(190 - (t - 0.5) * 2 * 110), Math.round(70 + (t - 0.5) * 2 * 30)];

  // fill = quota burned. the ┃ tick = where the clock is.
  // fill short of the tick means you have room; fill past it means you're burning hot.
  const CELLS = 10;
  const bar = (pct, tone, mark) => {
    const filled = Math.round((Math.min(pct, 100) / 100) * CELLS);
    const at = mark == null ? -1 : Math.min(CELLS - 1, Math.floor((mark / 100) * CELLS));
    const [r, g, b] = hue(tone);
    let out = "";
    for (let i = 0; i < CELLS; i++) {
      out += i === at ? rgb(235, 235, 245, "┃") : i < filled ? rgb(r, g, b, "█") : dim("░");
    }
    return `${out} ${rgb(r, g, b, `${Math.round(pct)}%`)}`;
  };

  const p2 = (n) => String(n).padStart(2, "0");
  const hms = (s) => `${Math.floor(s / 3600)}:${p2(Math.floor(s / 60) % 60)}:${p2(Math.floor(s) % 60)}`;

  // < 1 day away -> ticking clock. further out -> the actual day/time it lands.
  const reset = (epoch) => {
    if (!epoch) return "";
    const ms = epoch * 1000 - Date.now();
    if (ms <= 0) return dim(" ↻ now");
    if (ms < 864e5) return dim(` ↻ ${hms(ms / 1000)}`);
    const at = new Date(epoch * 1000);
    const day = at.toLocaleDateString("en-US", { weekday: "short" });
    const hr = at.toLocaleTimeString("en-US", { hour: "numeric" }).toLowerCase().replace(" ", "");
    return dim(` ↻ ${day} ${hr}`);
  };

  // how far through the window the clock is, 0-100
  const clock = (epoch, window) => {
    if (!epoch) return null;
    const left = Math.max(0, (epoch * 1000 - Date.now()) / 1000);
    return (Math.min(window, Math.max(0, window - left)) / window) * 100;
  };

  // only when you're ahead of the clock: how long to idle before the clock catches up
  const catchup = (used, c, w) => {
    if (c == null || used <= c) return "";
    const s = ((used - c) / 100) * w;
    const txt = s >= 86400 ? `${Math.floor(s / 86400)}d ${hms(s % 86400)}` : hms(s);
    return rgb(245, 120, 90, ` ⏸  ${txt}`);
  };

  const win = (label, w, o) => {
    const c = clock(o.resets_at, w);
    const used = o.used_percentage;
    const tone = c == null ? Math.min(used, 100) / 100 : Math.max(0, Math.min(1, 0.5 - (c - used) / 50));
    return `${dim(label)} ${bar(used, tone, c)}${reset(o.resets_at)}${catchup(used, c, w)}`;
  };

  const parts = [];
  parts.push(rgb(198, 160, 246, `◆ ${d.model?.display_name ?? "claude"}`));

  const rl = d.rate_limits;
  if (rl?.five_hour) parts.push(win("5h", 5 * 3600, rl.five_hour));
  if (rl?.seven_day) parts.push(win("wk", 7 * 86400, rl.seven_day));
  if (!rl?.five_hour && !rl?.seven_day) parts.push(dim("◇ warming up"));

  const cw = d.context_window;
  const u = cw?.current_usage;
  if (u && cw.context_window_size) {
    const used = u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens + u.output_tokens;
    const k = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1e3)}k`);
    const pct = (used / cw.context_window_size) * 100;
    parts.push(`${dim("ctx")} ${bar(pct, pct / 100, null)} ${dim(k(used))}`);
  }

  if (d.cost?.total_cost_usd) parts.push(dim(`$${d.cost.total_cost_usd.toFixed(2)}`));

  process.stdout.write(parts.join(sep));
});
