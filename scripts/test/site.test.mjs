import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { loadPlugins } from "../lib/catalog.mjs";
import { parseFrontmatter, summarize } from "../lib/skillmd.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DOCS = path.join(ROOT, "docs");
const PAGES = { en: "index.html", "zh-CN": "zh-CN/index.html" };
const read = (rel) => fs.readFileSync(path.join(DOCS, rel), "utf8");
const host = fs.readFileSync(path.join(DOCS, "CNAME"), "utf8").trim();
const base = `https://${host}/`;
const { plugins } = loadPlugins(ROOT);

describe("published pages", () => {
  for (const [lang, rel] of Object.entries(PAGES)) {
    const html = read(rel);
    const url = lang === "en" ? base : `${base}zh-CN/`;

    test(`${lang}: language, canonical URL and alternates`, () => {
      assert.match(html, new RegExp(`<html lang="${lang}">`));
      assert.ok(html.includes(`<link rel="canonical" href="${url}">`));
      assert.ok(html.includes(`hreflang="en" href="${base}"`));
      assert.ok(html.includes(`hreflang="zh-CN" href="${base}zh-CN/"`));
      assert.ok(html.includes(`hreflang="x-default" href="${base}"`));
      assert.ok(html.includes(`"url": "${url}"`), "structured data URL");
    });

    test(`${lang}: lists every plugin, skill and install command`, () => {
      for (const plugin of plugins) {
        assert.ok(html.includes(`id="${plugin.name}"`), plugin.name);
        assert.ok(html.includes(`/plugin install ${plugin.name}@ahoo-skills`), `${plugin.name} Claude command`);
        assert.ok(html.includes(`codex plugin add ${plugin.name}@ahoo-skills`), `${plugin.name} Codex command`);
        for (const skill of plugin.skills) {
          assert.ok(html.includes(`/plugins/${plugin.name}/skills/${skill}/SKILL.md"`), `${plugin.name}/${skill}`);
        }
      }
    });

    test(`${lang}: local links and anchors resolve, ids are unique`, () => {
      const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id);
      assert.equal(new Set(ids).size, ids.length, "duplicate id");
      for (const [, ref] of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
        if (/^(https?:|mailto:)/.test(ref)) continue;
        if (ref.startsWith("#")) {
          assert.ok(ids.includes(ref.slice(1)), `anchor ${ref}`);
          continue;
        }
        const target = path.resolve(path.dirname(path.join(DOCS, rel)), ref);
        assert.ok(target.startsWith(DOCS), `${ref} leaves docs/`);
        assert.ok(fs.existsSync(ref.endsWith("/") ? path.join(target, "index.html") : target), `${rel} links to missing ${ref}`);
      }
    });

    test(`${lang}: publishes nothing that was retired`, () => {
      for (const retired of ["sources/", "Brand Guide", "品牌指南", "skills-brand-guidelines"]) {
        assert.ok(!html.includes(retired), retired);
      }
    });
  }

  test("every brand token the stylesheet uses is defined", () => {
    const defined = new Set([...read("assets/tokens/skills-brand.css").matchAll(/(--skills-[\w-]+)\s*:/g)].map(([, t]) => t));
    for (const [, token] of read("assets/site.css").matchAll(/var\((--skills-[\w-]+)\)/g)) {
      assert.ok(defined.has(token), token);
    }
  });
});

describe("language preference", () => {
  const source = read("assets/lang.js");

  function visit({ page = "en", browser = ["en-US"], saved = null, hash = "" }) {
    const storage = new Map(saved ? [["skills.preferredLanguage", saved]] : []);
    const result = { redirect: null, listeners: [] };
    const context = {
      document: {
        documentElement: { lang: page },
        currentScript: { getAttribute: (name) => ({ "data-en": page === "en" ? "./" : "../", "data-zh": page === "en" ? "./zh-CN/" : "./" })[name] },
        addEventListener: (type, fn) => result.listeners.push(fn),
      },
      navigator: { languages: browser, language: browser[0] },
      localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
      location: { hash, replace: (url) => (result.redirect = url) },
    };
    vm.runInNewContext(source, context);
    result.storage = storage;
    return result;
  }

  test("sends a Chinese browser from the English page to the Chinese page, keeping the anchor", () => {
    assert.equal(visit({ browser: ["zh-CN", "en"], hash: "#plugins" }).redirect, "./zh-CN/#plugins");
  });

  test("keeps an English browser, and a Chinese page opened directly", () => {
    assert.equal(visit({ browser: ["en-GB", "zh-CN"] }).redirect, null);
    assert.equal(visit({ page: "zh-CN", browser: ["en-US"] }).redirect, null);
  });

  test("a remembered choice wins on either page", () => {
    assert.equal(visit({ browser: ["zh-CN"], saved: "en" }).redirect, null);
    assert.equal(visit({ page: "zh-CN", browser: ["zh-CN"], saved: "en" }).redirect, "../");
    assert.equal(visit({ browser: ["en-US"], saved: "zh-CN" }).redirect, "./zh-CN/");
  });

  test("clicking a language link remembers it", () => {
    const visited = visit({});
    const link = { getAttribute: () => "zh-CN" };
    visited.listeners[0]({ target: { closest: () => link } });
    assert.equal(visited.storage.get("skills.preferredLanguage"), "zh-CN");
  });
});

describe("SKILL.md frontmatter", () => {
  test("reads plain, quoted and block scalars", () => {
    const fields = parseFrontmatter(
      [
        "---",
        'name: "quoted-name"',
        "description: >",
        "  Folded line one",
        "  continues here.",
        "",
        "  New paragraph.",
        "license: |",
        "  Kept",
        "  lines",
        "other: plain value",
        "---",
        "Body",
      ].join("\n"),
    );
    assert.equal(fields.name, "quoted-name");
    assert.equal(fields.description, "Folded line one continues here.\n\nNew paragraph.");
    assert.equal(fields.license, "Kept\nlines");
    assert.equal(fields.other, "plain value");
    assert.equal(parseFrontmatter("No frontmatter"), null);
  });

  test("summaries keep the first sentence and skip abbreviations", () => {
    assert.equal(summarize("Do one thing. Then another."), "Do one thing.");
    assert.equal(summarize("Types (incl. JSON Schema) and more. Next."), "Types (incl. JSON Schema) and more.");
    assert.equal(summarize("Use e.g. Spring here. Next."), "Use e.g. Spring here.");
    assert.ok(summarize("word ".repeat(100), 60).endsWith("…"));
    assert.equal(summarize("Use `alpha`, `beta` and `gamma-delta-epsilon` today", 40), "Use `alpha`, `beta` and…");
  });
});
