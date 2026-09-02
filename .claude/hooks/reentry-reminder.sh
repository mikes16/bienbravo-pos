#!/usr/bin/env bash
# SessionStart hook (matchers compact|resume, wired in settings.json).
# If a harness run is mid-flight (tasks in_progress/in_review), prints the
# re-entry protocol reminder (spec section 10.2) to stdout so it is injected
# into the fresh context. Always exits 0.
[ -f tasks.json ] || exit 0
node -e '
const fs = require("node:fs");

let state;
try {
  state = JSON.parse(fs.readFileSync("tasks.json", "utf8"));
} catch {
  process.exit(0);
}

const tasks = Array.isArray(state.tasks) ? state.tasks : [];
const inFlight = tasks.filter(
  (t) => t.status === "in_progress" || t.status === "in_review"
);
if (inFlight.length === 0) process.exit(0);

const list = inFlight.map((t) => t.id + ":" + t.status).join(", ");
process.stdout.write(
  "HARNESS RE-ENTRADA: estas a media corrida del harness (" + list + "). " +
  "Ejecuta el protocolo de re-entrada de /harness-run ANTES de cualquier otra accion: " +
  "1) node .harness/scripts/harness.mjs status  " +
  "2) ultimas 10 lineas del journal + git log --oneline -10 + git status  " +
  "3) huerfanas: in_review se re-despacha solo al revisor; in_progress se revierte y redispatch  " +
  "4) node .harness/scripts/harness.mjs run-start. " +
  "Ignora todo estado que recuerdes de la conversacion: el disco manda.\n"
);
'
exit 0
