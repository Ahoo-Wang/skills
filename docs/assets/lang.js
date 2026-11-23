// Language preference. Loaded synchronously in <head> so a redirect happens
// before the page paints.
//
// - A language link the visitor clicks is remembered.
// - A remembered language wins on either page.
// - Otherwise, a visitor landing on the English page whose browser prefers
//   Chinese goes to the Chinese page. A Chinese page opened directly stays.
(function () {
  var KEY = "skills.preferredLanguage";
  var script = document.currentScript;
  var targets = { en: script.getAttribute("data-en"), "zh-CN": script.getAttribute("data-zh") };
  var page = document.documentElement.lang === "zh-CN" ? "zh-CN" : "en";

  function saved() {
    try {
      var value = localStorage.getItem(KEY);
      return targets[value] ? value : null;
    } catch (e) {
      return null;
    }
  }

  function browserLanguage() {
    var languages = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    return /^zh\b/i.test(languages[0] || "") ? "zh-CN" : "en";
  }

  var wanted = saved() || (page === "en" ? browserLanguage() : page);
  if (wanted !== page) {
    location.replace(targets[wanted] + location.hash);
    return;
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest("[data-lang]");
    if (!link) return;
    try {
      localStorage.setItem(KEY, link.getAttribute("data-lang"));
    } catch (e) {
      // Storage can be unavailable in private modes; the link still works.
    }
  });
})();
