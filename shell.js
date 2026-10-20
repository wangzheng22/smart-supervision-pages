(function () {
  if (new URLSearchParams(location.search).get("bare") === "1") return;
  const file = (location.pathname.split("/").pop() || "cockpit.html").toLowerCase();
  const scope = new URLSearchParams(location.search).get("scope");
  const key = file === "clues.html" || (file === "warnings.html" && scope === "clue")
    ? "clue"
    : (file === "warnings.html" || file === "insight.html" || file === "analysis.html" ? "warnings" : "cockpit");
  document.documentElement.classList.add("sys");
  const top = document.createElement("header");
  top.className = "sys-top";
  top.innerHTML = '<a class="sys-brand" href="cockpit.html"><img class="sys-logo" src="logo.png" alt="" /><strong>贵州省公共资源交易智能监督监管平台</strong></a><div class="sys-user"><span class="sys-avatar" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="5.2" r="2.4" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3.2 13.2c.7-2.2 2.4-3.3 4.8-3.3s4.1 1.1 4.8 3.3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></span><span>张小丽</span><button class="sys-exit" type="button">退出</button></div>';
  const nav = document.createElement("nav");
  nav.className = "sys-nav";
  nav.setAttribute("aria-label", "系统菜单");
  const items = [
    ["cockpit", "监督驾驶舱", "cockpit.html"],
    ["warnings", "预警列表", "warnings.html"],
    ["clue", "预警线索", "clues.html"]
  ];
  nav.innerHTML = items.map(function (item) {
    return '<a href="' + item[2] + '"' + (item[0] === key ? ' class="is-on" aria-current="page"' : "") + ">" + item[1] + "</a>";
  }).join("");
  const main = document.createElement("div");
  main.className = "sys-main";
  while (document.body.firstChild) main.appendChild(document.body.firstChild);
  const body = document.createElement("div");
  body.className = "sys-body";
  body.appendChild(nav);
  body.appendChild(main);
  document.body.appendChild(top);
  document.body.appendChild(body);
  const bar = document.querySelector(".page > .topbar");
  if (bar && document.getElementById("industry")) {
    const full = document.createElement("button");
    full.className = "sys-full";
    full.type = "button";
    full.setAttribute("aria-label", "全屏");
    full.innerHTML = '<svg class="ico-full" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 7V3h4M11 3h4v4M15 11v4h-4M7 15H3v-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg><svg class="ico-exit" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M7 3v4H3M11 7h4V3M15 11h-4v4M7 15v-4H3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    bar.appendChild(full);
    const stage = document.querySelector(".page");
    function syncFull() {
      const on = document.fullscreenElement === stage;
      full.classList.toggle("is-on", on);
      full.setAttribute("aria-label", on ? "退出全屏" : "全屏");
    }
    full.addEventListener("click", function () {
      if (document.fullscreenElement !== stage) stage.requestFullscreen();
      else document.exitFullscreen();
    });
    document.addEventListener("fullscreenchange", syncFull);
  }
  window.dispatchEvent(new Event("resize"));
})();
