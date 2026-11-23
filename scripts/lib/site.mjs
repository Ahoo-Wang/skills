// The GitHub Pages site (docs/), rendered from the catalog model.
//
// One static page per language, each holding only its own language. Plugin
// and skill text comes from the plugin manifests and SKILL.md frontmatter, so
// the site can never list a plugin or skill that does not ship. The site is
// generated when docs/CNAME exists; its host is the site's URL.
import fs from "node:fs";
import path from "node:path";
import { readFrontmatter, summarize } from "./skillmd.mjs";

export const SITE_DIR = "docs";

const LANGS = {
  en: {
    dir: "",
    htmlLang: "en",
    ogLocale: "en_US",
    label: "EN",
    title: "Ahoo Skills — agent skills for Ahoo-Wang open source projects",
    description:
      "Agent skills for Wow, CoSec, CosId, Fetcher and other Ahoo-Wang open source projects, packaged as plugins for Claude Code and Codex.",
    skip: "Skip to content",
    nav: { label: "Primary", install: "Install", plugins: "Plugins", how: "How it works" },
    langLabel: "Language",
    eyebrow: "Plugins for Claude Code and Codex",
    heading: "Agent skills for Ahoo-Wang's open source projects",
    lead:
      "Each project's maintainers write skills that teach coding agents how to use their library correctly. Install the plugin for a project and your agent knows its APIs, conventions and migrations.",
    stats: (p, s, r) => [
      [p, p === 1 ? "plugin" : "plugins"],
      [s, s === 1 ? "skill" : "skills"],
      [r, r === 1 ? "source project" : "source projects"],
    ],
    statsLabel: "Catalog size",
    ctaInstall: "Get started",
    ctaBrowse: "Browse plugins",
    install: {
      title: "Install",
      lead: "Add the marketplace once, then install a plugin for each project you work with.",
      addMarketplace: "Add the marketplace",
      addPlugin: "Install a plugin",
      claudeHint: "Run <code>/plugin update</code> to pick up new versions.",
      codexHint: "Replace <code>ahoo-wow-skills</code> with any plugin below.",
    },
    plugins: {
      title: "Plugins",
      lead: "One plugin per source project. Each skill links to its full instructions.",
      jump: "Jump to a plugin",
      filter: "Filter by project, skill or keyword",
      empty: "No plugin matches that filter.",
      local: "Maintained in this repository",
      from: "Source",
      skillCount: (n) => `${n} ${n === 1 ? "skill" : "skills"}`,
      installLabel: "Install",
    },
    copy: "Copy",
    copied: "Copied",
    copyLabel: "Copy command",
    how: {
      title: "How it works",
      facts: [
        [
          "Maintained by each project",
          "Skills live in each project's own repository, next to the code they describe, and change in the same pull requests.",
        ],
        [
          "Synced every 6 hours",
          "This marketplace mirrors them on a schedule and pins every plugin to an exact upstream commit, so what you install is reproducible.",
        ],
        [
          "Updated only when content changes",
          "A plugin's version is a hash of its files. Your agent gets an update when that plugin's skills change, never for unrelated commits.",
        ],
      ],
    },
    footer: { repo: "Repository", claude: "Claude Code marketplace", codex: "Codex marketplace", license: "License" },
  },
  "zh-CN": {
    dir: "zh-CN/",
    htmlLang: "zh-CN",
    ogLocale: "zh_CN",
    label: "中文",
    title: "Ahoo Skills — Ahoo-Wang 开源项目的 Agent Skills",
    description: "Wow、CoSec、CosId、Fetcher 等 Ahoo-Wang 开源项目的 Agent Skills，以插件形式提供给 Claude Code 与 Codex。",
    skip: "跳到正文",
    nav: { label: "主导航", install: "安装", plugins: "插件", how: "工作原理" },
    langLabel: "语言",
    eyebrow: "适用于 Claude Code 与 Codex 的插件",
    heading: "Ahoo-Wang 开源项目的 Agent Skills",
    lead: "由各项目维护者编写的 skills，教会编码 Agent 正确使用对应的库。安装某个项目的插件后，你的 Agent 就能掌握它的 API、约定与迁移方法。",
    stats: (p, s, r) => [
      [p, "个插件"],
      [s, "个 skills"],
      [r, "个源项目"],
    ],
    statsLabel: "目录规模",
    ctaInstall: "开始安装",
    ctaBrowse: "浏览插件",
    install: {
      title: "安装",
      lead: "先添加一次插件市场，再为你使用的每个项目安装对应插件。",
      addMarketplace: "添加插件市场",
      addPlugin: "安装插件",
      claudeHint: "运行 <code>/plugin update</code> 获取新版本。",
      codexHint: "把 <code>ahoo-wow-skills</code> 换成下方任意插件名。",
    },
    plugins: {
      title: "插件",
      lead: "每个源项目对应一个插件。点击 skill 名称可查看完整说明。",
      jump: "跳转到插件",
      filter: "按项目、skill 或关键词筛选",
      empty: "没有匹配的插件。",
      local: "本仓库维护",
      from: "来源",
      skillCount: (n) => `${n} 个 skills`,
      installLabel: "安装",
    },
    copy: "复制",
    copied: "已复制",
    copyLabel: "复制命令",
    how: {
      title: "工作原理",
      facts: [
        ["由各项目维护", "Skills 存放在各项目自己的仓库里，紧挨着它所描述的代码，并随同一个 PR 一起修改。"],
        ["每 6 小时同步", "本插件市场定时镜像这些 skills，并把每个插件固定到确切的上游 commit，安装结果可复现。"],
        ["内容变化才更新", "插件版本号是其文件内容的哈希。只有该插件的 skills 变化时 Agent 才会收到更新，无关提交不会触发。"],
      ],
    },
    footer: { repo: "仓库", claude: "Claude Code 插件市场", codex: "Codex 插件市场", license: "许可证" },
  },
};

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Inline `code` spans in upstream text become <code>; everything else is escaped. */
const richText = (value) =>
  escapeHtml(value).replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);

const githubBase = (url) => url.replace(/\.git$/, "").replace(/\/$/, "");

function command(text, t) {
  return `<div class="cmd"><code>${escapeHtml(text)}</code><button type="button" class="copy" data-copied="${escapeHtml(t.copied)}" aria-label="${escapeHtml(t.copyLabel)}" hidden>${escapeHtml(t.copy)}</button></div>`;
}

/** Everything the pages show, read once from the repository. */
function siteData(root, model) {
  const repo = githubBase(model.defaults.repository);
  const plugins = model.plugins.map((plugin) => {
    const skills = plugin.skills.map((name) => {
      const fields = readFrontmatter(path.join(root, "plugins", plugin.name, "skills", name, "SKILL.md")) ?? {};
      return { name, summary: summarize(fields.description ?? ""), url: `${repo}/blob/main/plugins/${plugin.name}/skills/${name}/SKILL.md` };
    });
    return {
      name: plugin.name,
      description: plugin.claude.description ?? "",
      keywords: plugin.claude.keywords ?? [],
      source: plugin.kind === "generated" ? { name: plugin.source.name, url: githubBase(plugin.source.url) } : null,
      skills,
    };
  });
  return {
    repo,
    license: model.defaults.license,
    marketplace: model.defaults.marketplaceName,
    plugins,
    skillCount: plugins.reduce((n, p) => n + p.skills.length, 0),
    sourceCount: model.lock.sources.length,
  };
}

function renderPlugin(plugin, data, t) {
  const search = [plugin.name, plugin.source?.name, plugin.description, ...plugin.keywords]
    .concat(plugin.skills.flatMap((s) => [s.name, s.summary]))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const source = plugin.source
    ? `<a class="source" href="${escapeHtml(plugin.source.url)}"><span class="visually-hidden">${escapeHtml(t.plugins.from)}: </span>${escapeHtml(plugin.source.name)}</a>`
    : `<span class="source local">${escapeHtml(t.plugins.local)}</span>`;
  const skills = plugin.skills
    .map(
      (s) =>
        `<li><a href="${escapeHtml(s.url)}"><code>${escapeHtml(s.name)}</code></a><p lang="en">${richText(s.summary)}</p></li>`,
    )
    .join("\n            ");
  return `
        <article class="plugin" id="${escapeHtml(plugin.name)}" data-search="${escapeHtml(search)}">
          <header class="plugin-head">
            <div>
              <h3><a href="#${escapeHtml(plugin.name)}">${escapeHtml(plugin.name)}</a></h3>
              <p class="plugin-meta">${source}<span>${escapeHtml(t.plugins.skillCount(plugin.skills.length))}</span></p>
            </div>
            <p class="plugin-desc" lang="en">${richText(plugin.description)}</p>
          </header>
          <ul class="skills">
            ${skills}
          </ul>
          <div class="plugin-install" role="group" aria-label="${escapeHtml(`${t.plugins.installLabel} ${plugin.name}`)}">
            <span class="tool">Claude Code</span>${command(`/plugin install ${plugin.name}@${data.marketplace}`, t)}
            <span class="tool">Codex</span>${command(`codex plugin add ${plugin.name}@${data.marketplace}`, t)}
          </div>
        </article>`;
}

function renderPage(lang, data, base) {
  const t = LANGS[lang];
  const up = lang === "en" ? "./" : "../"; // from this page to docs/
  const href = (target) => (lang === target ? "./" : `${up}${LANGS[target].dir}`);
  const url = `${base}${t.dir}`;
  const example = data.plugins.find((p) => p.name === "ahoo-wow-skills")?.name ?? data.plugins[0]?.name ?? "";
  const stats = t.stats(data.plugins.length, data.skillCount, data.sourceCount)
    .map(([n, label]) => `<li><strong>${n}</strong> ${escapeHtml(label)}</li>`)
    .join("");
  const langLinks = Object.entries(LANGS)
    .map(
      ([code, l]) =>
        `<a href="${href(code)}" hreflang="${code}" lang="${code}" data-lang="${code}"${code === lang ? ' aria-current="page"' : ""}>${l.label}</a>`,
    )
    .join("");
  const jump = data.plugins
    .map((p) => `<li><a href="#${escapeHtml(p.name)}">${escapeHtml(p.source?.name ?? p.name.replace(/^ahoo-|-skills$/g, ""))}</a></li>`)
    .join("");
  const facts = t.how.facts
    .map(([title, body], i) => `<li><span class="fact-index">0${i + 1}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></li>`)
    .join("\n          ");
  const jsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Ahoo Skills",
      url,
      description: t.description,
      inLanguage: lang,
      publisher: { "@type": "Organization", name: "Ahoo-Wang", url: "https://github.com/Ahoo-Wang" },
    },
    null,
    2,
  ).replace(/\n/g, "\n    ");

  return `<!doctype html>
<html lang="${t.htmlLang}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(t.title)}</title>
    <meta name="description" content="${escapeHtml(t.description)}">
    <link rel="canonical" href="${url}">
    <link rel="alternate" hreflang="en" href="${base}">
    <link rel="alternate" hreflang="zh-CN" href="${base}${LANGS["zh-CN"].dir}">
    <link rel="alternate" hreflang="x-default" href="${base}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Ahoo Skills">
    <meta property="og:title" content="${escapeHtml(t.title)}">
    <meta property="og:description" content="${escapeHtml(t.description)}">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${base}assets/og.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Ahoo Skills">
    <meta property="og:locale" content="${t.ogLocale}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${base}assets/og.png">
    <meta name="theme-color" content="#0B1020">
    <link rel="icon" href="${up}assets/logo/skills-icon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="${up}assets/logo/skills-icon-180.png">
    <link rel="stylesheet" href="${up}assets/tokens/skills-brand.css">
    <link rel="stylesheet" href="${up}assets/site.css">
    <script src="${up}assets/lang.js" data-en="${href("en")}" data-zh="${href("zh-CN")}"></script>
    <script src="${up}assets/site.js" defer></script>
    <script type="application/ld+json">
    ${jsonLd}
    </script>
  </head>
  <body>
    <a class="skip" href="#main">${escapeHtml(t.skip)}</a>
    <header class="topbar">
      <div class="wrap topbar-inner">
        <a class="brand" href="./"><img src="${up}assets/logo/skills-mark-dark.svg" alt="" width="28" height="28"><span>Ahoo Skills</span></a>
        <nav class="nav" aria-label="${escapeHtml(t.nav.label)}">
          <a href="#install">${escapeHtml(t.nav.install)}</a>
          <a href="#plugins">${escapeHtml(t.nav.plugins)}</a>
          <a href="#how">${escapeHtml(t.nav.how)}</a>
          <a href="${data.repo}">GitHub</a>
        </nav>
        <div class="lang-switch" role="group" aria-label="${escapeHtml(t.langLabel)}">${langLinks}</div>
      </div>
    </header>
    <main id="main">
      <section class="hero">
        <div class="wrap">
          <p class="eyebrow">${escapeHtml(t.eyebrow)}</p>
          <h1>${escapeHtml(t.heading).replace("Ahoo-Wang", '<span class="nowrap">Ahoo-Wang</span>')}</h1>
          <p class="lead">${escapeHtml(t.lead)}</p>
          <ul class="stats" aria-label="${escapeHtml(t.statsLabel)}">${stats}</ul>
          <div class="actions">
            <a class="button primary" href="#install">${escapeHtml(t.ctaInstall)}</a>
            <a class="button" href="#plugins">${escapeHtml(t.ctaBrowse)}</a>
          </div>
        </div>
      </section>

      <section class="section" id="install" aria-labelledby="install-title">
        <div class="wrap">
          <div class="section-head">
            <h2 id="install-title">${escapeHtml(t.install.title)}</h2>
            <p>${escapeHtml(t.install.lead)}</p>
          </div>
          <div class="install-grid">
            <article class="panel">
              <h3>Claude Code</h3>
              <ol class="steps">
                <li><span>${escapeHtml(t.install.addMarketplace)}</span>${command(`/plugin marketplace add ${data.repo}`, t)}</li>
                <li><span>${escapeHtml(t.install.addPlugin)}</span>${command(`/plugin install ${example}@${data.marketplace}`, t)}</li>
              </ol>
              <p class="hint">${t.install.claudeHint}</p>
            </article>
            <article class="panel">
              <h3>Codex</h3>
              <ol class="steps">
                <li><span>${escapeHtml(t.install.addMarketplace)}</span>${command(`codex plugin marketplace add ${data.repo.replace("https://github.com/", "")} --ref main`, t)}</li>
                <li><span>${escapeHtml(t.install.addPlugin)}</span>${command(`codex plugin add ${example}@${data.marketplace}`, t)}</li>
              </ol>
              <p class="hint">${t.install.codexHint}</p>
            </article>
          </div>
        </div>
      </section>

      <section class="section" id="plugins" aria-labelledby="plugins-title">
        <div class="wrap">
          <div class="section-head">
            <h2 id="plugins-title">${escapeHtml(t.plugins.title)}</h2>
            <p>${escapeHtml(t.plugins.lead)}</p>
          </div>
          <div class="toolbar">
            <nav aria-label="${escapeHtml(t.plugins.jump)}"><ul class="jump">${jump}</ul></nav>
            <label class="filter" hidden><span class="visually-hidden">${escapeHtml(t.plugins.filter)}</span><input type="search" placeholder="${escapeHtml(t.plugins.filter)}" autocomplete="off"></label>
          </div>
          <p class="empty" role="status" hidden>${escapeHtml(t.plugins.empty)}</p>
          <div class="plugin-list">${data.plugins.map((p) => renderPlugin(p, data, t)).join("\n")}
          </div>
        </div>
      </section>

      <section class="section how" id="how" aria-labelledby="how-title">
        <div class="wrap">
          <div class="section-head">
            <h2 id="how-title">${escapeHtml(t.how.title)}</h2>
          </div>
          <ol class="facts">
          ${facts}
          </ol>
        </div>
      </section>
    </main>
    <footer class="footer">
      <div class="wrap footer-inner">
        <span class="brand"><picture><source media="(prefers-color-scheme: dark)" srcset="${up}assets/logo/skills-mark-dark.svg"><img src="${up}assets/logo/skills-mark.svg" alt="" width="22" height="22"></picture><span>Ahoo Skills</span></span>
        <nav class="footer-links" aria-label="Footer">
          <a href="${data.repo}">${escapeHtml(t.footer.repo)}</a>
          <a href="${data.repo}/blob/main/.claude-plugin/marketplace.json">${escapeHtml(t.footer.claude)}</a>
          <a href="${data.repo}/blob/main/.agents/plugins/marketplace.json">${escapeHtml(t.footer.codex)}</a>
          <a href="${data.repo}/blob/main/LICENSE">${escapeHtml(t.footer.license)}: ${escapeHtml(data.license)}</a>
        </nav>
      </div>
    </footer>
  </body>
</html>
`;
}

/** { "docs/index.html": html, "docs/zh-CN/index.html": html }, or {} without docs/CNAME. */
export function renderSite(root, model) {
  const cname = path.join(root, SITE_DIR, "CNAME");
  if (!fs.existsSync(cname)) return {};
  const base = `https://${fs.readFileSync(cname, "utf8").trim()}/`;
  const data = siteData(root, model);
  return Object.fromEntries(
    Object.entries(LANGS).map(([lang, t]) => [path.join(SITE_DIR, t.dir, "index.html"), renderPage(lang, data, base)]),
  );
}
