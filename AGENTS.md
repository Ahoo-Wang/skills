# AGENTS.md

This file is the canonical agent guide for this repository. Claude Code should
also follow this file; `CLAUDE.md` only contains Claude-specific entry notes.

## What This Repository Is

A marketplace that distributes Ahoo-Wang's agent skills to Claude Code and
Codex. It owns no upstream skill content. Three facts drive the design:

1. **Upstream repositories own their skills** and declare how they split into
   plugins in their own `skills/plugins.json`.
2. **Users install plugins**, so `plugins/<plugin>/` is the only copy of any
   skill here. Nothing else is distributed.
3. **Every commit is a potential update for users.** A plugin's version is a
   hash of its files, so it changes exactly when its content changes, and a
   sync that finds no content change commits nothing.

Everything that can be derived is derived, and `check` proves it by deriving
it again and comparing.

## Installation

Claude Code:

```bash
/plugin marketplace add https://github.com/Ahoo-Wang/skills
/plugin install ahoo-wow-skills
```

Codex:

```bash
codex plugin marketplace add Ahoo-Wang/skills --ref main
codex plugin add ahoo-wow-skills@ahoo-skills
```

## Layout

```text
.
├── repos.json                         # Input: source repositories
├── skills.lock.json                   # Written by sync: what was mirrored
├── plugins/<plugin>/                  # Distributed plugins (generated or local)
│   ├── .claude-plugin/plugin.json     # Derived (local: hand-written + version)
│   ├── .codex-plugin/plugin.json      # Derived (local: hand-written + version)
│   └── skills/<skill>/SKILL.md
├── .claude-plugin/marketplace.json    # Derived: Claude Code marketplace
├── .agents/plugins/marketplace.json   # Derived: Codex marketplace
├── README.md, README.zh-CN.md         # Plugin table between catalog markers is derived
├── docs/                              # GitHub Pages site (skills.ahoo.me)
│   ├── index.html, zh-CN/index.html   # Derived: one static page per language
│   └── assets/                        # Hand-written: site.css, site.js, lang.js, brand assets
├── schemas/                           # Schemas for repos.json and upstream plugins.json
└── scripts/
    ├── skills.mjs                     # CLI: sync | build | check
    ├── lib/                           # fsutil, catalog (derivation), sync, check
    └── test/                          # node:test suite
```

The tool is plain Node.js (22+) with no dependencies.

## Commands

| Command | What it does |
|---|---|
| `npm run sync` | Fetch every source, replace generated plugins, update `skills.lock.json`, then build |
| `npm run build` | Rewrite every derived file from `skills.lock.json`, `plugins/` and `package.json` |
| `npm run check` | Fail if any derived file is stale, a generated skill was edited, or a skill is malformed |
| `npm test` | Unit, end-to-end and site tests, then `check` |

## Sync

For each entry in `repos.json`
(`{ "name", "url", "branch": "main", "skills_path": "skills" }`), sync
shallow-clones the repository, reads `<skills_path>/plugins.json`, and copies
the skills each plugin selects into `plugins/<plugin>/skills/`.

- Skills ending in `-workspace` are ignored.
- A plugin selects skills with an explicit list or with `include`/`exclude`
  shell globs (defaults `["*"]` and `["*-workspace"]`).
- Whitespace-only lines in Markdown are emptied so mirrored files pass
  `git diff --check`.
- All-or-nothing: a clone failure, a missing `plugins.json`, a skill or plugin
  name owned twice, a plugin clashing with a local plugin, an upstream skill in
  no plugin, or a plugin naming a missing skill fails the sync before anything
  on disk changes.
- Plugins a source no longer declares are deleted; local plugins are untouched.
- `skills.lock.json` records each source's URL, branch, commit, paths, its
  `plugins` metadata verbatim, and a hash of every mirrored skill. When only
  commits differ from the previous lock, the previous lock is kept, so an
  upstream commit that does not change skills produces no diff.

`.github/workflows/sync-skills.yml` runs sync and check every 6 hours (02:17,
08:17, 14:17, 20:17 UTC) and commits any change. One sync runs at a time; if
`main` moved meanwhile it rebases once before pushing. To ship sooner:

```bash
gh workflow run sync-skills.yml --repo Ahoo-Wang/skills
```

## Derived Files

`build` derives, and `check` verifies:

- **Generated plugin manifests** from the plugin's metadata in the lock plus
  marketplace defaults in `package.json` (author, homepage, repository,
  license). Codex manifests get `skills: "./skills/"` and an `interface` block.
- **Local plugin manifests** are hand-written; build only stamps `version`.
- **Versions**: both manifests of a plugin carry `1.0.0+<12 hex>`, the SHA-256
  over the plugin's files (each manifest hashed without its `version`). The
  fixed `1.0.0` core keeps it semver-valid and above legacy `0.x` Codex caches.
  Upstream `version` fields are ignored.
- **Marketplaces**: one entry per plugin, sorted by name. The Claude marketplace
  never declares a version (Claude Code reads it from `plugin.json`).
- **README catalog**: the plugin table between the `catalog:start` and
  `catalog:end` markers in both READMEs.
- **Site pages** (`docs/index.html`, `docs/zh-CN/index.html`), generated when
  `docs/CNAME` exists, whose host becomes the site URL. Each page holds only its
  own language. Plugin descriptions come from the manifests and each skill's
  summary from the first sentence of its `SKILL.md` description, so the site
  never lists anything that does not ship. UI text for both languages lives in
  `scripts/lib/site.mjs`; upstream text stays in English, marked `lang="en"`.
  Styles and behavior are hand-written in `docs/assets/` (`site.css`;
  `site.js` for copy buttons, the filter, and motion: the typing hero
  terminal, count-up stats, scroll reveal and pointer glow; `lang.js`
  remembers the chosen language and sends Chinese browsers to `/zh-CN/`). The
  pages work without JavaScript, and every animation is off under
  `prefers-reduced-motion`; scroll reveal only hides elements that start below
  the fold, so nothing stays hidden if a script fails. `.github/workflows/pages.yml` publishes `docs/` on every push to
  `main`; the sync workflow starts it after each sync commit, because pushes
  made with `GITHUB_TOKEN` do not trigger other workflows.

`check` also requires that every skill has `SKILL.md` with YAML frontmatter
whose `name` equals its directory and that has a `description`; that skill
names are unique across plugins; that generated skills hash to the lock; and
that Codex manifests have `displayName`, `shortDescription`, `longDescription`
and `defaultPrompt`. It runs the Codex plugin validator when installed
(`~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py`, or
`CODEX_PLUGIN_VALIDATOR`).

## Common Tasks

- **Change an upstream skill**: change it upstream, then run the sync workflow
  or `npm run sync`. Never edit a generated plugin's skills here; check rejects
  it.
- **Add a source repository**: make sure it publishes `skills/plugins.json`
  (see `schemas/plugins.schema.json`), add it to `repos.json`, run
  `npm run sync`.
- **Add or edit a local plugin**: create `plugins/<plugin>/` with both
  manifests and its skills, then `npm run build`.
- **Change marketplace defaults**: edit `package.json`, then `npm run build`.
- **Resolve conflicts in generated files**: take either side, then rerun
  `npm run sync` (or `npm run build` if no upstream is involved).

## Validation

Before pushing:

```bash
npm test
git diff --check
```

`.github/workflows/ci.yml` runs the same on every pull request and push to
`main`.
