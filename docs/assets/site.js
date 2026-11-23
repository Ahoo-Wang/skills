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
