// Mirrors upstream skills into plugins/ and records what was mirrored in
// skills.lock.json. Either every source syncs or nothing on disk changes.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PATHS, readLock, resolveSkills } from "./catalog.mjs";
import {
  assertName,
  compareBytes,
  copySkill,
  fail,
  formatJson,
  listDirs,
  readJson,
  treeHash,
} from "./fsutil.mjs";

const isWorkspace = (name) => name.endsWith("-workspace");

function git(args, options = {}) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
}

/** Clones one source and reads its plugin metadata and skill directories. */
function fetchSource(repo, workDir, log) {
  const url = repo.url;
  const name = assertName(repo.name ?? path.basename(url, ".git"), "source");
  const branch = repo.branch ?? "main";
  const skillsPath = repo.skills_path ?? "skills";
  const pluginsPath = repo.plugins_path ?? `${skillsPath}/plugins.json`;
  const checkout = path.join(workDir, name);

  log(`Fetching ${name} (${branch})`);
  try {
    git(["clone", "--quiet", "--depth", "1", "--branch", branch, url, checkout]);
  } catch (error) {
    fail(`${name}: cannot clone ${url} (${branch}): ${(error.stderr || error.message).trim()}`);
  }

  const skillsDir = path.join(checkout, skillsPath);
  const pluginsFile = path.join(checkout, pluginsPath);
  if (!fs.existsSync(skillsDir)) fail(`${name}: ${skillsPath}/ not found`);
  if (!fs.existsSync(pluginsFile)) fail(`${name}: ${pluginsPath} not found`);
  const metadata = readJson(pluginsFile);
  if (!Array.isArray(metadata.plugins)) fail(`${name}: ${pluginsPath} must have a plugins array`);

  return {
    name,
    url,
    branch,
    commit: git(["-C", checkout, "rev-parse", "HEAD"]),
    skills_path: skillsPath,
    plugins_path: pluginsPath,
    plugins: metadata.plugins,
    skillDirs: Object.fromEntries(
      listDirs(skillsDir)
        .filter((skill) => !isWorkspace(skill))
        .map((skill) => [assertName(skill, "skill"), path.join(skillsDir, skill)]),
    ),
  };
}

const withoutCommits = (lock) => JSON.stringify({ ...lock, sources: lock.sources.map(({ commit, ...rest }) => rest) });

/**
 * Fetches every source in repos.json, stages the plugins they declare, and
 * only then replaces the generated plugins on disk. Returns what changed.
 */
export function sync(root, { log = () => {} } = {}) {
  const repos = readJson(path.join(root, PATHS.repos)).repos;
  if (!Array.isArray(repos)) fail(`${PATHS.repos} must have a repos array`);

  const previous = readLock(root);
  const previouslyGenerated = new Set(previous.sources.flatMap((s) => s.plugins.map((p) => p.name)));
  const pluginsDir = path.join(root, PATHS.plugins);
  const localPlugins = new Set(listDirs(pluginsDir).filter((name) => !previouslyGenerated.has(name)));

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-sync-"));
  try {
    const errors = [];
    const sources = [];
    for (const repo of repos) {
      try {
        sources.push(fetchSource(repo, path.join(workDir, "clones"), log));
      } catch (error) {
        errors.push(error.message);
      }
    }

    // Names are install identities: one owner per skill and per plugin.
    const skillOwner = new Map();
    const pluginOwner = new Map();
    for (const source of sources) {
      for (const skill of Object.keys(source.skillDirs)) {
        if (skillOwner.has(skill)) errors.push(`Skill ${skill} is in both ${skillOwner.get(skill)} and ${source.name}`);
        else skillOwner.set(skill, source.name);
      }
      for (const meta of source.plugins) {
        try {
          const name = assertName(meta.name, "plugin");
          if (!meta.description) fail(`Plugin ${name} from ${source.name} has no description`);
          if (pluginOwner.has(name)) fail(`Plugin ${name} is declared by both ${pluginOwner.get(name)} and ${source.name}`);
          if (localPlugins.has(name)) fail(`Plugin ${name} from ${source.name} clashes with the local plugin ${PATHS.plugins}/${name}`);
          pluginOwner.set(name, source.name);
        } catch (error) {
          errors.push(error.message);
        }
      }
    }
    if (errors.length) fail(`Sync failed; nothing was changed:\n- ${errors.join("\n- ")}`);

    // Stage every plugin's skills, then hash what will actually ship.
    const staging = path.join(workDir, "plugins");
    for (const source of sources) {
      const available = Object.keys(source.skillDirs).sort(compareBytes);
      const claimed = new Map();
      for (const meta of source.plugins) {
        for (const skill of resolveSkills(meta.skills, available, meta.name)) {
          if (claimed.has(skill)) fail(`${source.name}/${skill} is in both ${claimed.get(skill)} and ${meta.name}`);
          claimed.set(skill, meta.name);
          copySkill(source.skillDirs[skill], path.join(staging, meta.name, "skills", skill));
        }
      }
      const unclaimed = available.filter((skill) => !claimed.has(skill));
      if (unclaimed.length) fail(`${source.name}: skills not in any plugin: ${unclaimed.join(", ")}`);
      source.skills = Object.fromEntries(
        [...claimed].sort(([a], [b]) => compareBytes(a, b)).map(([skill, plugin]) => [
          skill,
          treeHash(path.join(staging, plugin, "skills", skill)),
        ]),
      );
    }

    // Swap: drop every previously generated plugin, move the staged ones in.
    for (const name of new Set([...previouslyGenerated, ...pluginOwner.keys()])) {
      fs.rmSync(path.join(pluginsDir, assertName(name, "plugin")), { recursive: true, force: true });
    }
    for (const name of pluginOwner.keys()) {
      fs.cpSync(path.join(staging, name), path.join(pluginsDir, name), { recursive: true, verbatimSymlinks: true });
    }

    const lock = {
      sources: sources
        .map(({ skillDirs, ...source }) => source)
        .sort((a, b) => compareBytes(a.name, b.name)),
    };
    // Upstream commits are provenance, not content: when only they moved,
    // keep the previous lock so nothing is committed and no update ships.
    const lockChanged = withoutCommits(lock) !== withoutCommits(previous);
    if (lockChanged) fs.writeFileSync(path.join(root, PATHS.lock), formatJson(lock));
    return { lockChanged, sources: lock.sources.length };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}
