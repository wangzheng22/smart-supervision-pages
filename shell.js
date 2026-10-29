(function () {
  if (new URLSearchParams(location.search).get("bare") === "1") return;
  const file = (document.documentElement.getAttribute("data-page") || location.pathname.split("/").pop() || "cockpit.html").toLowerCase();
  document.documentElement.setAttribute("data-page", file);
  document.documentElement.classList.add("sys-app");
  const scope = new URLSearchParams(location.search).get("scope");
  const desk = new URLSearchParams(location.search).get("desk");
  function cockpitNavKey() {
    if (file !== "cockpit.html") return "";
    if (desk === "engineering") return "cockpit-eng";
    return "cockpit-fg";
  }
  const key = file === "clue-return.html"
    ? "clue-return"
    : (file === "clues.html" || (file === "warnings.html" && scope === "clue")
      ? "clue"
      : (file === "warnings.html" || file === "insight.html" || file === "analysis.html"
        ? "warnings"
        : (file === "cockpit.html" ? cockpitNavKey() : "cockpit-fg")));
  document.documentElement.classList.add("sys");
  try {
    if (localStorage.getItem("sys-nav-collapsed") === "1") {
      document.documentElement.classList.add("sys-narrow");
    }
  } catch (error) {}
  const iconSet = {
    cockpit: ["assets/icon-nav-cockpit-on.png", "assets/icon-nav-cockpit.png"],
    warnings: ["assets/icon-nav-warnings.png", "assets/icon-nav-warnings-on.png"],
    clue: ["assets/icon-nav-clue.png", "assets/icon-nav-clue-on.png"],
    "clue-return": ["assets/icon-nav-clue-return.png", "assets/icon-nav-clue-return-on.png"]
  };
  function navIcon(id) {
    const pair = iconSet[id.startsWith("cockpit") ? "cockpit" : id] || iconSet.cockpit;
    return '<span class="sys-ico-box" aria-hidden="true">' +
      '<img class="sys-ico sys-ico-off" src="' + pair[0] + '" width="18" height="18" alt="" decoding="sync" />' +
      '<img class="sys-ico sys-ico-on" src="' + pair[1] + '" width="18" height="18" alt="" decoding="sync" />' +
      "</span>";
  }
  Object.keys(iconSet).forEach(function (id) {
    iconSet[id].forEach(function (src) {
      const img = new Image();
      img.src = src;
    });
  });
  const items = [
    ["cockpit-fg", "监管驾驶舱(发改)", "cockpit.html?desk=fg"],
    ["cockpit-eng", "监管驾驶舱(建设工程)", "cockpit.html?desk=engineering"],
    ["warnings", "预警列表", "warnings.html"],
    ["clue", "线索列表", "clues.html"],
    ["clue-return", "线索回传", "clue-return.html"]
  ];
  const nav = document.createElement("nav");
  nav.className = "sys-nav";
  nav.setAttribute("aria-label", "系统菜单");
  nav.innerHTML = items.map(function (item, index) {
    const on = item[0] === key;
    const sep = index === 2 ? '<div class="sys-nav-sep" role="presentation"></div>' : "";
    return sep + '<a href="' + item[2] + '"' + (on ? ' class="is-on" aria-current="page"' : "") + ">" + navIcon(item[0]) + '<span class="sys-nav-label">' + item[1] + "</span></a>";
  }).join("");
  const side = document.createElement("aside");
  side.className = "sys-side";
  side.innerHTML = '<a class="sys-brand" href="cockpit.html?desk=fg"><img class="sys-logo" src="logo.png" alt="" /><strong>智能监管系统</strong></a>';
  side.appendChild(nav);
  const foot = document.createElement("div");
  foot.className = "sys-foot";
  foot.innerHTML = '<span class="sys-avatar"><img src="assets/avatar-user.png" width="36" height="36" alt="" /></span><div class="sys-foot-meta"><b>刘新宇</b><span>超级管理员</span></div>';
  side.appendChild(foot);
  const collapse = document.createElement("button");
  collapse.className = "sys-collapse";
  collapse.type = "button";
  collapse.setAttribute("aria-label", "收起导航");
  collapse.innerHTML =
    '<img class="sys-collapse-fold" src="assets/icon-sidebar-collapse.png" width="32" height="32" alt="" aria-hidden="true" />' +
    '<img class="sys-collapse-expand" src="assets/icon-sidebar-expand.png" width="32" height="32" alt="" aria-hidden="true" />';
  function syncCollapseLabel() {
    const narrow = document.documentElement.classList.contains("sys-narrow");
    collapse.setAttribute("aria-label", narrow ? "展开导航" : "收起导航");
  }
  collapse.addEventListener("click", function () {
    const narrow = document.documentElement.classList.toggle("sys-narrow");
    try {
      localStorage.setItem("sys-nav-collapsed", narrow ? "1" : "0");
    } catch (error) {}
    syncCollapseLabel();
    window.dispatchEvent(new Event("resize"));
  });
  syncCollapseLabel();
  const main = document.createElement("div");
  main.className = "sys-main";
  while (document.body.firstChild) main.appendChild(document.body.firstChild);
  const body = document.createElement("div");
  body.className = "sys-body";
  body.appendChild(side);
  body.appendChild(main);
  body.appendChild(collapse);
  document.body.appendChild(body);
  const bar = document.querySelector(".page > .topbar");
  if (bar && document.getElementById("industry")) {
    const full = document.createElement("button");
    full.className = "sys-full";
    full.type = "button";
    full.setAttribute("aria-label", "全屏");
    full.innerHTML =
      '<span class="sys-full-ico sys-full-enter" aria-hidden="true">' +
      '<img class="sys-full-off" src="assets/icon-fullscreen.png" width="16" height="16" alt="" decoding="async" />' +
      '<img class="sys-full-on" src="assets/icon-fullscreen-hover.png" width="16" height="16" alt="" decoding="async" />' +
      "</span>" +
      '<span class="sys-full-ico sys-full-exit" aria-hidden="true">' +
      '<img class="sys-full-off" src="assets/icon-exit-fullscreen.png" width="16" height="16" alt="" decoding="async" />' +
      '<img class="sys-full-on" src="assets/icon-exit-fullscreen-hover.png" width="16" height="16" alt="" decoding="async" />' +
      "</span>";
    const topbarEnd = bar.querySelector(".topbar-end");
    (topbarEnd || bar).appendChild(full);
    const stage = document.querySelector(".page");
    function syncFull() {
      const on = document.fullscreenElement === stage;
      full.classList.toggle("is-on", on);
      stage.classList.toggle("is-fullscreen", on);
      full.setAttribute("aria-label", on ? "退出全屏" : "全屏");
      full.setAttribute("title", on ? "退出全屏" : "全屏");
    }
    full.addEventListener("click", function () {
      if (document.fullscreenElement !== stage) stage.requestFullscreen();
      else document.exitFullscreen();
    });
    document.addEventListener("fullscreenchange", syncFull);
  }
  window.dispatchEvent(new Event("resize"));
})();
