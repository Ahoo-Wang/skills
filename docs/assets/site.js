// Progressive enhancements. The page is complete without them.

// Copy buttons next to every command. When the Clipboard API is refused, fall
// back to copying the selected text; if that fails too, the command is left
// selected so Ctrl/Cmd+C works.
function selectText(element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

async function copy(element) {
  try {
    await navigator.clipboard.writeText(element.textContent);
    return true;
  } catch {
    selectText(element);
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    }
  }
}

document.querySelectorAll(".cmd .copy").forEach((button) => {
  button.hidden = false;
  const label = button.textContent;
  button.addEventListener("click", async () => {
    if (!(await copy(button.previousElementSibling))) return;
    button.textContent = button.dataset.copied;
    button.dataset.state = "copied";
    setTimeout(() => {
      button.textContent = label;
      delete button.dataset.state;
    }, 1600);
  });
});

// Plugin filter: matches every word against a plugin's name, source,
// description, keywords and skills.
const filter = document.querySelector(".filter");
if (filter) {
  const input = filter.querySelector("input");
  const plugins = [...document.querySelectorAll(".plugin")];
  const empty = document.querySelector(".empty");
  filter.hidden = false;
  input.addEventListener("input", () => {
    const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const plugin of plugins) {
      const match = words.every((word) => plugin.dataset.search.includes(word));
      plugin.hidden = !match;
      if (match) shown++;
    }
    empty.hidden = shown > 0;
  });
}

// ---------------------------------------------------------------------------
// Motion. Skipped entirely when the visitor asks for reduced motion; the
// static markup is already the final state.

const motion = !matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Hero terminal: type the session out, then keep re-typing the install line
// with the next plugin from data-plugins.
async function typeText(element, text) {
  for (const character of text) {
    element.textContent += character;
    await sleep(22 + Math.random() * 38);
  }
}

async function eraseTo(element, prefix) {
  while (element.textContent.length > prefix.length) {
    element.textContent = element.textContent.slice(0, -1);
    await sleep(12);
  }
}

async function runTerminal(body) {
  body.style.minHeight = `${body.offsetHeight}px`;
  const lines = [...body.querySelectorAll(".line")];
  const finalText = lines.map((line) => line.querySelector(".text").textContent);
  const caret = Object.assign(document.createElement("span"), { className: "caret" });
  for (const line of lines) line.hidden = true;
  await sleep(700);

  for (const [index, line] of lines.entries()) {
    const text = line.querySelector(".text");
    line.hidden = false;
    line.append(caret);
    if (line.classList.contains("t-cmd")) {
      text.textContent = "";
      await typeText(text, finalText[index]);
      await sleep(420);
    } else {
      await sleep(line.classList.contains("t-out") ? 260 : 140);
    }
  }

  const plugins = JSON.parse(body.dataset.plugins || "[]");
  const install = body.querySelector(".t-install .text");
  const result = body.querySelector(".t-result");
  const prefix = "/plugin install ";
  let current = plugins.findIndex((p) => install.textContent === `${prefix}${p.name}@${body.dataset.marketplace}`);
  while (plugins.length > 1) {
    await sleep(2800);
    if (document.hidden) continue;
    current = (current + 1) % plugins.length;
    const plugin = plugins[current];
    result.hidden = true;
    install.parentElement.append(caret);
    await eraseTo(install, prefix);
    await typeText(install, `${plugin.name}@${body.dataset.marketplace}`);
    await sleep(380);
    result.querySelector(".text").textContent = `${plugin.name} · ${plugin.skills} skills`;
    result.hidden = false;
    result.append(caret);
  }
}

// Stats count up from zero.
function countUp(element) {
  const target = Number(element.dataset.count);
  const start = performance.now() + 450;
  const duration = 1300;
  element.textContent = "0";
  const frame = (now) => {
    const progress = Math.min(1, Math.max(0, (now - start) / duration));
    element.textContent = String(Math.round(target * (1 - (1 - progress) ** 3)));
    if (progress < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// Reveal: only elements below the fold are hidden, so nothing visible on load
// ever blinks, and nothing is hidden if this script never runs.
function revealOnScroll() {
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .forEach((entry, order) => {
          entry.target.style.transitionDelay = `${Math.min(order, 4) * 90}ms`;
          entry.target.classList.remove("pending");
          entry.target.addEventListener("transitionend", () => (entry.target.style.transitionDelay = ""), { once: true });
          observer.unobserve(entry.target);
        });
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  for (const element of document.querySelectorAll(".reveal")) {
    if (element.getBoundingClientRect().top > innerHeight) {
      element.classList.add("pending");
      observer.observe(element);
    }
  }
}

if (motion) {
  const terminal = document.querySelector(".terminal-body");
  if (terminal) runTerminal(terminal);
  document.querySelectorAll("[data-count]").forEach(countUp);
  revealOnScroll();
}

// Cards glow where the pointer is.
if (matchMedia("(hover: hover)").matches) {
  for (const card of document.querySelectorAll(".panel, .plugin")) {
    card.addEventListener("pointermove", (event) => {
      const box = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX - box.left}px`);
      card.style.setProperty("--my", `${event.clientY - box.top}px`);
    });
  }
}
