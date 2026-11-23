// Reads the YAML frontmatter of a SKILL.md: top-level scalar fields only,
// which is all the Agent Skills format puts there that we need (name,
// description). Handles plain, quoted and block (| and >) scalars.
import fs from "node:fs";

function unquote(value) {
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
  return value;
}

/** Parses frontmatter text into { field: string }, or null when absent. */
export function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(text);
  if (!match) return null;
  const lines = match[1].split(/\r?\n/);
  const fields = {};
  for (let i = 0; i < lines.length; i++) {
    const field = /^([A-Za-z_][\w-]*):(?:\s+(.*))?$/.exec(lines[i]);
    if (!field) continue;
    const [, key, rest = ""] = field;
    const value = rest.trim();
    // Indented continuation lines belong to this field.
    const continuation = [];
    while (i + 1 < lines.length && (lines[i + 1] === "" || /^\s/.test(lines[i + 1]))) continuation.push(lines[++i]);
    while (continuation.length && continuation.at(-1).trim() === "") continuation.pop();

    if (/^[|>][+-]?$/.test(value)) {
      const indent = Math.min(...continuation.filter((l) => l.trim()).map((l) => /^\s*/.exec(l)[0].length));
      const body = continuation.map((l) => l.slice(indent));
      fields[key] = value.startsWith("|")
        ? body.join("\n")
        : body.join("\n").replace(/([^\n])\n(?=[^\n\s])/g, "$1 ");
    } else {
      const joined = [value, ...continuation.map((l) => l.trim())].filter(Boolean).join(" ");
      fields[key] = unquote(joined);
    }
  }
  return fields;
}

export function readFrontmatter(file) {
  return parseFrontmatter(fs.readFileSync(file, "utf8"));
}

/** One line for a catalog: the first sentence, cut at a word near `max`. */
export function summarize(text, max = 220) {
  const flat = String(text ?? "").replace(/\s+/g, " ").trim();
  let sentence = flat;
  for (const end of flat.matchAll(/[.!?](?=\s+[A-Z`"'(@])/g)) {
    const before = flat.slice(0, end.index);
    const open = (before.match(/[([]/g) ?? []).length - (before.match(/[)\]]/g) ?? []).length;
    if (open > 0 || /\b(incl|e\.g|i\.e|etc|vs|cf|approx)$/i.test(before)) continue;
    sentence = flat.slice(0, end.index + 1);
    break;
  }
  if (sentence.length <= max) return sentence;
  let cut = sentence.slice(0, max);
  cut = cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20));
  // Never end inside a `code` span.
  if ((cut.match(/`/g) ?? []).length % 2) cut = cut.slice(0, cut.lastIndexOf("`"));
  return `${cut.replace(/[\s,;:–—-]+$/, "")}…`;
}
