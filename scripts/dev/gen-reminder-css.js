/**
 * Build scripts/reminder.css from components/task/task.css by renaming task-*
 * classes to reminder-* (keeps reminder UI visually aligned with tasks).
 *
 * Run: node scripts/dev/gen-reminder-css.js
 */
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../../components/task/task.css"), "utf8");
let out = src
  .replace(/\.task-/g, ".reminder-")
  .replace(/--task-/g, "--reminder-")
  .replace(/@keyframes task-/g, "@keyframes reminder-")
  .replace(/task-widget-refresh-spin/g, "reminder-widget-refresh-spin");
out += "\n\n/* Reminders — 2-column dashboard layout */\n.reminder-dash-layout {\n  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);\n}\n";
const dir = path.join(__dirname, "../../components/reminder");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "reminder.css"), out);
console.log("wrote reminder.css", out.length);
