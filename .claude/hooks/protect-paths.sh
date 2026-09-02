#!/usr/bin/env bash
# PreToolUse hook (spec section 14): denies direct writes to tasks.json and
# .harness/memory/**. All legitimate mutation goes through harness.mjs.
# Exception: while .harness/curation-active exists (a curation task in flight),
# .harness/memory/ is writable — tasks.json is protected ALWAYS.
# Input: Claude Code hook JSON on stdin. Exit 0 = allow; exit 2 + stderr = deny.
exec node -e '
const fs = require("node:fs");
const pathMod = require("node:path");

let input;
try {
  input = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  process.exit(0); // unparseable stdin: do not lock the whole session
}

const tool = String(input.tool_name || "");
const toolInput = input.tool_input || {};
const baseDir = String(input.cwd || ".");
const curationActive = fs.existsSync(
  pathMod.join(baseDir, ".harness", "curation-active")
);

const TASKS_FILE_RE = /(^|[\/\\])tasks\.json$/;
const TASKS_MENTION_RE = /tasks\.json/;
const MEMORY_RE = /\.harness[\/\\]memory([\/\\]|$)/;
const RISKY_BASH_RE = /(>|\bsed\s+-i|\btee\b|\bmv\b|\bcp\b)/;

function deny(message) {
  process.stderr.write("protect-paths: " + message + "\n");
  process.exit(2);
}

const FILE_TOOLS = ["Write", "Edit", "MultiEdit", "NotebookEdit"];

if (FILE_TOOLS.includes(tool)) {
  const filePath = String(toolInput.file_path || toolInput.notebook_path || "");
  if (TASKS_FILE_RE.test(filePath)) {
    deny("tasks.json solo se escribe via harness.mjs (import / edit-task / transiciones)");
  }
  if (MEMORY_RE.test(filePath) && !curationActive) {
    deny(".harness/memory/ solo se escribe via harness.mjs (add-lesson / add-decision / memory-init)");
  }
  process.exit(0);
}

if (tool === "Bash") {
  const command = String(toolInput.command || "");
  if (RISKY_BASH_RE.test(command)) {
    if (TASKS_MENTION_RE.test(command)) {
      deny("comando Bash con escritura potencial sobre tasks.json; usa harness.mjs");
    }
    if (MEMORY_RE.test(command) && !curationActive) {
      deny("comando Bash con escritura potencial sobre .harness/memory/; usa harness.mjs");
    }
  }
  process.exit(0);
}

process.exit(0);
'
