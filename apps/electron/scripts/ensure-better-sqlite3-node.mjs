import { spawnSync } from "node:child_process";
import process from "node:process";

const npmBinary = process.platform === "win32" ? "npm.cmd" : "npm";
const checkArgs = [
  "-e",
  [
    "const Database = require('better-sqlite3');",
    "const db = new Database(':memory:');",
    "db.exec('SELECT 1');",
    "db.close();",
    "console.log('better-sqlite3 node ok');",
  ].join(" "),
];

function run(command, args) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function formatOutput(result) {
  return [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
}

const check = run(process.execPath, checkArgs);
if (check.status === 0) {
  const output = formatOutput(check);
  if (output) {
    console.log(output);
  }
  process.exit(0);
}

console.warn(
  "[ensure-better-sqlite3-node] Node ABI check failed, rebuilding better-sqlite3...",
);
const rebuild = run(npmBinary, ["rebuild", "better-sqlite3"]);
if (rebuild.status !== 0) {
  const rebuildOutput = formatOutput(rebuild);
  if (rebuildOutput) {
    console.error(rebuildOutput);
  }
  process.exit(rebuild.status ?? 1);
}

const verify = run(process.execPath, checkArgs);
if (verify.status !== 0) {
  const verifyOutput = formatOutput(verify);
  if (verifyOutput) {
    console.error(verifyOutput);
  }
  process.exit(verify.status ?? 1);
}

const verifyOutput = formatOutput(verify);
if (verifyOutput) {
  console.log(verifyOutput);
}
