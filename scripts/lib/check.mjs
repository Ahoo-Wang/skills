// Verifies the repository: derived files match a fresh derivation, mirrored
// skills match what sync recorded, and every skill is well formed.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PATHS, deriveFiles, loadPlugins } from "./catalog.mjs";
import { SkillsError, listDirs, treeHash } from "./fsutil.mjs";

/** Reads `name` and `description` from a SKILL.md YAML frontmatter block. */
export function readFrontmatter(file) {
  const text = fs.readFileSync(file, "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(text);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (field) fields[field[1]] = field[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return fields;
}

function checkSkill(dir, name, errors) {
  const file = path.join(dir, "SKILL.md");
  if (!fs.existsSync(file)) return errors.push(`${dir}: missing SKILL.md`);
  const fields = readFrontmatter(file);
  if (!fields) return errors.push(`${file}: missing YAML frontmatter`);
  if (fields.name !== name) errors.push(`${file}: frontmatter name "${fields.name ?? ""}" must equal the directory name "${name}"`);
  if (!fields.description) errors.push(`${file}: frontmatter has no description`);
}

/** Runs the Codex plugin validator when it is installed (or given). */
function codexValidator(root, plugins, errors, notes) {
  const configured = process.env.CODEX_PLUGIN_VALIDATOR;
  const validator =
    configured || path.join(os.homedir(), ".codex/skills/.system/plugin-creator/scripts/validate_plugin.py");
  if (!fs.existsSync(validator)) {
    if (configured) errors.push(`CODEX_PLUGIN_VALIDATOR not found: ${configured}`);
    else notes.push("Codex plugin validator not installed; skipped");
    return;
  }
  for (const plugin of plugins) {
    const result = spawnSync("python3", [validator, path.join(root, PATHS.plugins, plugin.name)], { encoding: "utf8" });
    if (result.error) {
      if (configured) errors.push(`Cannot run Codex plugin validator: ${result.error.message}`);
      else notes.push(`Codex plugin validator not runnable (${result.error.message}); skipped`);
      return;
    }
    if (result.status !== 0) errors.push(`Codex validator rejected ${plugin.name}:\n${result.stderr || result.stdout}`);
  }
}

export function check(root) {
  const errors = [];
  const notes = [];
  let model;
  try {
    model = loadPlugins(root);
  } catch (error) {
    if (error instanceof SkillsError) return { errors: [error.message], notes };
    throw error;
  }

  const skillOwner = new Map();
  for (const plugin of model.plugins) {
    const dir = path.join(root, PATHS.plugins, plugin.name);
    const onDisk = listDirs(path.join(dir, "skills"));

    if (plugin.kind === "generated") {
      const expected = plugin.skills.join(", ");
      if (onDisk.join(", ") !== expected) {
        errors.push(`${plugin.name}: skills on disk [${onDisk.join(", ")}] differ from the lock [${expected}]; run npm run sync`);
      }
      for (const skill of plugin.skills) {
        const skillDir = path.join(dir, "skills", skill);
        if (fs.existsSync(skillDir) && treeHash(skillDir) !== plugin.source.skills[skill]) {
          errors.push(`${plugin.name}/${skill} differs from upstream ${plugin.source.name}; change it upstream, then run npm run sync`);
        }
      }
    } else if (onDisk.length === 0) {
      errors.push(`${plugin.name}: local plugin has no skills`);
    }

    for (const skill of onDisk) {
      if (skillOwner.has(skill)) errors.push(`Skill ${skill} is in both ${skillOwner.get(skill)} and ${plugin.name}`);
      skillOwner.set(skill, plugin.name);
      checkSkill(path.join(dir, "skills", skill), skill, errors);
    }

    const ui = plugin.codex.interface ?? {};
    if (plugin.codex.skills !== "./skills/") errors.push(`${plugin.name}: Codex manifest must set skills to ./skills/`);
    for (const field of ["displayName", "shortDescription", "longDescription", "defaultPrompt"]) {
      if (!ui[field]) errors.push(`${plugin.name}: Codex manifest is missing interface.${field}`);
    }
    for (const manifest of [plugin.claude, plugin.codex]) {
      if (manifest.name !== plugin.name) errors.push(`${plugin.name}: manifest name "${manifest.name}" must equal the directory name`);
    }
  }

  // Each generated source skill ships in exactly one plugin.
  for (const source of model.lock.sources) {
    for (const skill of Object.keys(source.skills)) {
      const claimed = model.plugins.filter((p) => p.kind === "generated" && p.source === source && p.skills.includes(skill));
      if (claimed.length !== 1) {
        errors.push(`${source.name}/${skill} is shipped by ${claimed.length} plugins; each upstream skill must be in exactly one`);
      }
    }
  }

  let files;
  try {
    files = deriveFiles(root, model);
  } catch (error) {
    if (error instanceof SkillsError) return { errors: [...errors, error.message], notes };
    throw error;
  }
  for (const [rel, content] of files) {
    const abs = path.join(root, rel);
    const actual = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
    if (actual !== content) errors.push(`${rel} is ${actual === null ? "missing" : "out of date"}; run npm run build`);
  }

  codexValidator(root, model.plugins, errors, notes);
  return { errors, notes, plugins: model.plugins.length, skills: skillOwner.size };
}
