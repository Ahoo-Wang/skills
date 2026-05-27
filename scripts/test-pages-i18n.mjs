import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../docs/index.html", import.meta.url), "utf8");
const zhHtml = readFileSync(new URL("../docs/zh-CN/index.html", import.meta.url), "utf8");
const cname = readFileSync(new URL("../docs/CNAME", import.meta.url), "utf8").trim();
const tokenCss = readFileSync(new URL("../docs/assets/tokens/skills-brand.css", import.meta.url), "utf8");
const brandGuideHtml = readFileSync(
  new URL("../design/assets/guidelines/skills-brand-guidelines.html", import.meta.url),
  "utf8",
);

const checks = [
  ["English language toggle", 'data-lang-option="en"'],
  ["Chinese language toggle", 'data-lang-option="zh-CN"'],
  ["Language toggle controls are accessible", 'aria-label="Language selector"'],
  ["i18n hook for plugin navigation", 'data-i18n="nav.plugins"'],
  ["i18n hook for hero title", 'data-i18n="hero.titlePrefix"'],
  ["English hero copy remains present", "Open Source Agent Skills Hub"],
  ["Chinese hero copy is present", "开源 Agent Skills Hub"],
  ["Chinese marketplace wording is present", "插件市场入口"],
  ["Language detection checks browser languages", "navigator.languages"],
  ["Manual language choice is persisted", "localStorage"],
  ["Manual language choice uses stable storage key", "skills.preferredLanguage"],
  ["Page language is updated at runtime", "document.documentElement.lang"],
  ["Canonical URL is present", 'rel="canonical" href="https://skills.ahoo.me/"'],
  ["English hreflang is present", 'hreflang="en" href="https://skills.ahoo.me/"'],
  ["Chinese hreflang is present", 'hreflang="zh-CN" href="https://skills.ahoo.me/zh-CN/"'],
  ["x-default hreflang is present", 'hreflang="x-default" href="https://skills.ahoo.me/"'],
  ["Structured data is present", '"@type": "WebSite"'],
];

const missing = checks.filter(([, expected]) => !html.includes(expected));

if (missing.length > 0) {
  console.error("Missing GitHub Pages i18n markers:");
  for (const [label, expected] of missing) {
    console.error(`- ${label}: ${expected}`);
  }
  process.exit(1);
}

const forbidden = [
  "Brand Guide",
  "品牌指南",
  "skills-brand-guidelines.pdf",
  "?lang=",
];

const publishedHtml = `${html}\n${zhHtml}`;
const stillPresent = forbidden.filter((unexpected) => publishedHtml.includes(unexpected));
if (stillPresent.length > 0) {
  console.error(`Brand guide references should not be published: ${stillPresent.join(", ")}`);
  process.exit(1);
}

const zhChecks = [
  ["Chinese page language", '<html lang="zh-CN">'],
  ["Chinese canonical URL", 'rel="canonical" href="https://skills.ahoo.me/zh-CN/"'],
  ["Chinese page has static Chinese hero copy", "开源 Agent Skills Hub"],
  ["Chinese page links back to English", 'href="../" hreflang="en"'],
  ["Chinese page self link", 'href="./" hreflang="zh-CN"'],
];

const missingZh = zhChecks.filter(([, expected]) => !zhHtml.includes(expected));
if (missingZh.length > 0) {
  console.error("Missing zh-CN page SEO markers:");
  for (const [label, expected] of missingZh) {
    console.error(`- ${label}: ${expected}`);
  }
  process.exit(1);
}

if (cname !== "skills.ahoo.me") {
  console.error(`Expected docs/CNAME to be skills.ahoo.me, got ${cname}`);
  process.exit(1);
}

const definedTokens = new Set([...tokenCss.matchAll(/--skills-[\w-]+(?=\s*:)/g)].map(([token]) => token));
const referencedTokens = new Set(
  [...`${html}\n${zhHtml}`.matchAll(/var\((--skills-[\w-]+)\)/g)].map(([, token]) => token),
);
const missingTokens = [...referencedTokens].filter((token) => !definedTokens.has(token));
if (missingTokens.length > 0) {
  console.error(`Pages reference undefined brand tokens: ${missingTokens.join(", ")}`);
  process.exit(1);
}

const seenIds = new Set();
const duplicateIds = new Set();
for (const [, id] of brandGuideHtml.matchAll(/\bid="([^"]+)"/g)) {
  if (seenIds.has(id)) {
    duplicateIds.add(id);
  }
  seenIds.add(id);
}
if (duplicateIds.size > 0) {
  console.error(`Brand guide contains duplicate HTML ids: ${[...duplicateIds].join(", ")}`);
  process.exit(1);
}

const scriptMatch = html.match(/<script id="i18n-script">([\s\S]*)<\/script>\s*<\/body>/);
if (!scriptMatch) {
  console.error("Missing inline i18n script");
  process.exit(1);
}

function createElement(attributes = {}) {
  const classNames = new Set();
  return {
    attributes: { ...attributes },
    classList: {
      contains(name) {
        return classNames.has(name);
      },
      toggle(name, enabled) {
        if (enabled) {
          classNames.add(name);
        } else {
          classNames.delete(name);
        }
      },
    },
    eventListeners: {},
    textContent: "",
    addEventListener(event, handler) {
      this.eventListeners[event] = handler;
    },
    getAttribute(name) {
      return this.attributes[name] ?? null;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    removeAttribute(name) {
      delete this.attributes[name];
    },
  };
}

function runI18nScript({ browserLanguages, pageLanguage = "en", savedLanguage }) {
  const storage = new Map();
  if (savedLanguage) {
    storage.set("skills.preferredLanguage", savedLanguage);
  }

  const i18nElements = [
    createElement({ "data-i18n": "hero.kicker" }),
    createElement({ "data-i18n": "hero.openRepository" }),
    createElement({ "data-i18n": "market.status" }),
  ];
  const ariaElements = [
    createElement({ "data-i18n-aria": "brand.repositoryLabel" }),
  ];
  const buttons = [
    createElement({ "data-lang-option": "en", href: pageLanguage === "zh-CN" ? "../" : "./" }),
    createElement({ "data-lang-option": "zh-CN", href: pageLanguage === "zh-CN" ? "./" : "./zh-CN/" }),
  ];
  const metaDescription = createElement({ name: "description" });
  const redirects = [];
  const document = {
    documentElement: { lang: pageLanguage },
    title: "",
    querySelector(selector) {
      if (selector === 'meta[name="description"]') {
        return metaDescription;
      }
      const optionMatch = selector.match(/^\[data-lang-option="(.+)"\]$/);
      if (optionMatch) {
        return buttons.find((button) => button.getAttribute("data-lang-option") === optionMatch[1]) ?? null;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-i18n]") {
        return i18nElements;
      }
      if (selector === "[data-i18n-aria]") {
        return ariaElements;
      }
      if (selector === "[data-lang-option]") {
        return buttons;
      }
      return [];
    },
  };

  const context = {
    console,
    document,
    localStorage: {
      getItem(key) {
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
    },
    navigator: {
      language: browserLanguages[0],
      languages: browserLanguages,
    },
    window: {
      location: {
        replace(target) {
          redirects.push(target);
        },
      },
    },
  };

  vm.runInNewContext(scriptMatch[1], context);
  return {
    ariaElements,
    buttons,
    document,
    i18nElements,
    redirects,
    storage,
  };
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`${label}: expected ${expected}, got ${actual}`);
    process.exit(1);
  }
}

const chineseBrowser = runI18nScript({ browserLanguages: ["zh-CN", "en-US"] });
assertEqual(chineseBrowser.redirects[0], "./zh-CN/", "Chinese browser should redirect to the zh-CN page");

const chinesePage = runI18nScript({ browserLanguages: ["en-US"], pageLanguage: "zh-CN" });
assertEqual(chinesePage.redirects.length, 0, "Chinese page should stay zh-CN without a saved override");
assertEqual(chinesePage.document.documentElement.lang, "zh-CN", "Chinese page should stay zh-CN");
assertEqual(chinesePage.document.title, "Ahoo-Wang 的 skills | 开源 Agent Skills Hub", "Chinese title");
assertEqual(chinesePage.i18nElements[0].textContent, "开源 Agent Skills Hub", "Chinese hero kicker");
assertEqual(chinesePage.ariaElements[0].attributes["aria-label"], "Ahoo-Wang 的 skills 仓库", "Chinese aria label");

const savedEnglish = runI18nScript({ browserLanguages: ["zh-CN"], savedLanguage: "en" });
assertEqual(savedEnglish.redirects.length, 0, "Saved English should not redirect from English page");
assertEqual(savedEnglish.document.documentElement.lang, "en", "Saved English should override Chinese browser language");
assertEqual(savedEnglish.i18nElements[0].textContent, "Open Source Agent Skills Hub", "Saved English hero kicker");

const manualSwitch = runI18nScript({ browserLanguages: ["en-US"] });
manualSwitch.buttons[1].eventListeners.click({ preventDefault() {} });
assertEqual(manualSwitch.document.documentElement.lang, "zh-CN", "Manual Chinese switch should update page language");
assertEqual(manualSwitch.storage.get("skills.preferredLanguage"), "zh-CN", "Manual Chinese switch should persist language");

const savedEnglishFromChinesePage = runI18nScript({ browserLanguages: ["zh-CN"], pageLanguage: "zh-CN", savedLanguage: "en" });
assertEqual(savedEnglishFromChinesePage.redirects[0], "../", "Saved English should redirect from the zh-CN page to English root");

console.log("GitHub Pages i18n markers validated");
