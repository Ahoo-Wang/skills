#!/usr/bin/env node
// Ahoo Skills marketplace tool.
//
//   node scripts/skills.mjs sync    fetch upstream skills, then build
//   node scripts/skills.mjs build   regenerate manifests, marketplaces and README catalogs
//   node scripts/skills.mjs check   fail if anything is stale, edited by hand, or malformed
//
// Options: --root <dir> (default: the repository containing this script).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveFiles, writeDerivedFiles } from "./lib/catalog.mjs";
import { check } from "./lib/check.mjs";
import { SkillsError } from "./lib/fsutil.mjs";
import { sync } from "./lib/sync.mjs";

/** Current bytes of every derived file, to report real changes only. */
function snapshot(root) {
  const read = (rel) => (fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), "utf8") : null);
  try {
    return new Map([...deriveFiles(root).keys()].map((rel) => [rel, read(rel)]));
  } catch {
    return new Map();
  }
}

function build(root, before = snapshot(root)) {
  const files = deriveFiles(root);
  writeDerivedFiles(root, files);
  const changed = [...files].filter(([rel, content]) => before.get(rel) !== content).map(([rel]) => rel);
  console.log(changed.length ? `Updated:\n  ${changed.join("\n  ")}` : "Derived files are up to date");
}

const commands = {
  sync(root) {
    const before = snapshot(root);
    const result = sync(root, { log: (line) => console.log(line) });
    console.log(`Synced ${result.sources} sources${result.lockChanged ? "" : " (no upstream content changes)"}`);
    build(root, before);
  },
  build: (root) => build(root),
  check(root) {
    const result = check(root);
    for (const note of result.notes) console.log(`Note: ${note}`);
    if (result.errors.length) {
      console.error(`Check failed:\n- ${result.errors.join("\n- ")}`);
      process.exitCode = 1;
      return;
    }
    console.log(`Check passed: ${result.plugins} plugins, ${result.skills} skills`);
  },
};

const args = process.argv.slice(2);
const rootFlag = args.indexOf("--root");
const root = path.resolve(
  rootFlag === -1 ? path.join(path.dirname(fileURLToPath(import.meta.url)), "..") : args.splice(rootFlag, 2)[1],
);
const command = commands[args[0]];
if (!command) {
  console.error("Usage: node scripts/skills.mjs <sync|build|check> [--root <dir>]");
  process.exit(2);
}
try {
  command(root);
} catch (error) {
  if (!(error instanceof SkillsError)) throw error;
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
