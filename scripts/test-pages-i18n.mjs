import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../docs/index.html", import.meta.url), "utf8");

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
];

const missing = checks.filter(([, expected]) => !html.includes(expected));

if (missing.length > 0) {
  console.error("Missing GitHub Pages i18n markers:");
  for (const [label, expected] of missing) {
    console.error(`- ${label}: ${expected}`);
  }
  process.exit(1);
}

const scriptMatch = html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/);
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
  };
}

function runI18nScript({ browserLanguages, savedLanguage }) {
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
    createElement({ "data-lang-option": "en" }),
    createElement({ "data-lang-option": "zh-CN" }),
  ];
  const metaDescription = createElement({ name: "description" });
  const document = {
    documentElement: { lang: "" },
    title: "",
    querySelector(selector) {
      return selector === 'meta[name="description"]' ? metaDescription : null;
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
  };

  vm.runInNewContext(scriptMatch[1], context);
  return {
    ariaElements,
    buttons,
    document,
    i18nElements,
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
assertEqual(chineseBrowser.document.documentElement.lang, "zh-CN", "Chinese browser should auto-select zh-CN");
assertEqual(chineseBrowser.document.title, "Ahoo-Wang 的 skills | 开源 Agent Skills Hub", "Chinese title");
assertEqual(chineseBrowser.i18nElements[0].textContent, "开源 Agent Skills Hub", "Chinese hero kicker");
assertEqual(chineseBrowser.ariaElements[0].attributes["aria-label"], "Ahoo-Wang 的 skills 仓库", "Chinese aria label");

const savedEnglish = runI18nScript({ browserLanguages: ["zh-CN"], savedLanguage: "en" });
assertEqual(savedEnglish.document.documentElement.lang, "en", "Saved English should override Chinese browser language");
assertEqual(savedEnglish.i18nElements[0].textContent, "Open Source Agent Skills Hub", "Saved English hero kicker");

const manualSwitch = runI18nScript({ browserLanguages: ["en-US"] });
manualSwitch.buttons[1].eventListeners.click();
assertEqual(manualSwitch.document.documentElement.lang, "zh-CN", "Manual Chinese switch should update page language");
assertEqual(manualSwitch.storage.get("skills.preferredLanguage"), "zh-CN", "Manual Chinese switch should persist language");

console.log("GitHub Pages i18n markers validated");
