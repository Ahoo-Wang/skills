// Filesystem primitives: JSON I/O, tree walking, copying and content hashing.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export class SkillsError extends Error {}

export function fail(message) {
  throw new SkillsError(message);
}

/** A name becomes a path segment, so it must be one. */
export function assertName(name, what) {
  if (typeof name !== "string" || name === "" || name === "." || name === ".." || /[/\\]/.test(name)) {
    fail(`Invalid ${what} name: ${JSON.stringify(name)}`);
  }
  return name;
}

export function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`Cannot read ${file}: ${error.message}`);
  }
}

/** Two-space JSON with a trailing newline, the same bytes `jq .` prints. */
export function formatJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareBytes)
        .map((key) => [key, sortKeysDeep(value[key])]),
    );
  }
  return value;
}

/** Byte-wise ordering, the order `LC_ALL=C sort` uses. */
export function compareBytes(a, b) {
  return Buffer.compare(Buffer.from(a), Buffer.from(b));
}

export function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

/** Immediate subdirectories, byte-sorted. Symlinks are not followed. */
export function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(compareBytes);
}

/**
 * Files and symlinks under `root` as "./relative/path" (the shape `find .`
 * prints), skipping macOS .DS_Store litter. Symlinked directories are listed
 * as links, never entered.
 */
export function listTree(root) {
  const out = [];
  const walk = (rel) => {
    for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      if (entry.name === ".DS_Store") continue;
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() || entry.isSymbolicLink()) out.push(`./${child}`);
    }
  };
  walk("");
  return out;
}

/**
 * SHA-256 over a tree: for each entry in byte order, its path, a NUL, and the
 * hex digest of its content (or of "link:<target>" for a symlink) plus "\n".
 * `overrides` maps "./path" to replacement bytes, which also adds the path.
 */
export function treeHash(root, overrides = {}) {
  const paths = new Set(fs.existsSync(root) ? listTree(root) : []);
  for (const p of Object.keys(overrides)) paths.add(p);
  const hash = createHash("sha256");
  for (const p of [...paths].sort(compareBytes)) {
    let digest;
    if (Object.hasOwn(overrides, p)) {
      digest = sha256(overrides[p]);
    } else {
      const abs = path.join(root, p);
      digest = fs.lstatSync(abs).isSymbolicLink()
        ? sha256(`link:${fs.readlinkSync(abs)}`)
        : sha256(fs.readFileSync(abs));
    }
    hash.update(Buffer.concat([Buffer.from(p), Buffer.from([0]), Buffer.from(`${digest}\n`)]));
  }
  return hash.digest("hex");
}

/**
 * Copies a skill directory. Whitespace-only lines in Markdown become empty so
 * mirrored content never trips `git diff --check`.
 */
export function copySkill(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true });
  for (const rel of listTree(to)) {
    const abs = path.join(to, rel);
    if (!/\.(md|markdown)$/.test(rel) || fs.lstatSync(abs).isSymbolicLink()) continue;
    // latin1 round-trips every byte, so non-UTF-8 content is left intact.
    const text = fs.readFileSync(abs, "latin1");
    const stripped = text
      .split("\n")
      .map((line) => (/^[ \t]+$/.test(line) ? "" : line))
      .join("\n");
    if (stripped !== text) fs.writeFileSync(abs, stripped, "latin1");
  }
}

/** Shell-style glob (`*`, `?`, `[...]`) as used by `case` patterns. */
export function globMatch(pattern, value) {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*") re += ".*";
    else if (c === "?") re += ".";
    else if (c === "[") {
      const end = pattern.indexOf("]", i + 2);
      if (end === -1) {
        re += "\\[";
        continue;
      }
      let body = pattern.slice(i + 1, end);
      if (body.startsWith("!")) body = `^${body.slice(1)}`;
      re += `[${body.replace(/\\/g, "\\\\")}]`;
      i = end;
    } else re += c.replace(/[.+^${}()|\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "s").test(value);
}
