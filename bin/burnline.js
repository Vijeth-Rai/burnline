#!/usr/bin/env node
"use strict";

// Dual-mode entry:
//   piped stdin (Claude Code invoking the statusline) -> render the status line
//   TTY stdin (a human running `npx -y burnline`)     -> run the installer
const args = process.argv.slice(2);

if (args.includes("-h") || args.includes("--help")) {
  console.log(`burnline - Claude Code statusline showing rate-limit usage with live countdowns

Usage:
  npx -y burnline          Install: adds the statusline to ~/.claude/settings.json
  burnline --help          Show this help

When Claude Code runs it, status JSON is piped on stdin and burnline renders
the status line. With no piped input it runs the installer.`);
  process.exit(0);
}

if (!process.stdin.isTTY) {
  // Statusline mode: the module attaches stdin listeners on load and renders.
  require("../statusline.js");
} else {
  install();
}

function install() {
  const fs = require("fs");
  const os = require("os");
  const path = require("path");

  const dir = path.join(os.homedir(), ".claude");
  const file = path.join(dir, "settings.json");

  let settings = {};
  let existed = false;
  if (fs.existsSync(file)) {
    existed = true;
    const text = fs.readFileSync(file, "utf8");
    try {
      settings = text.trim() ? JSON.parse(text) : {};
    } catch {
      console.error(`burnline: ${file} is not valid JSON. Fix it manually, then re-run.`);
      process.exit(1);
    }
    if (settings === null || typeof settings !== "object" || Array.isArray(settings)) {
      console.error(`burnline: ${file} does not contain a JSON object. Fix it manually, then re-run.`);
      process.exit(1);
    }
  } else {
    fs.mkdirSync(dir, { recursive: true });
  }

  const prev = settings.statusLine;
  settings.statusLine = {
    type: "command",
    command: "npx -y burnline",
    padding: 2,
    refreshInterval: 1,
  };

  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + "\n");

  console.log("burnline installed.");
  console.log(`  ${existed ? "Updated" : "Created"} ${file}`);
  if (prev && JSON.stringify(prev) !== JSON.stringify(settings.statusLine)) {
    console.log(`  Replaced your previous statusLine: ${JSON.stringify(prev)}`);
  }
  console.log("Restart Claude Code (or start a new session) and the statusline will appear.");
}
