(function (global) {
  function esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const MASK_HTML =
    '<div class="clue-handoff-mask" id="crHandoffMask" hidden>' +
    '<div class="dialog move-dialog" role="dialog" aria-labelledby="crMoveTitle">' +
    '<div class="move-dialog-head"><h2 id="crMoveTitle">移交线索</h2>' +
    '<button type="button" class="move-dialog-x" id="crMoveClose" aria-label="关闭">×</button></div>' +
    '<p class="move-hint">请勾选具体接收人员（可多选）：省 / 市 / 区·县 → 厅局处 → 科室 → 人员</p>' +
    '<div class="move-selected"><div class="move-selected-head">' +
    '<span class="move-selected-label">已选人员（<b id="crMoveCount">0</b>）：</span>' +
    '<button type="button" class="move-clear" id="crMoveClear" hidden>清空</button></div>' +
    '<div class="move-picks" id="crMovePicks"><span class="move-empty">暂未选择</span></div></div>' +
    '<label class="move-search"><span class="sr-only">搜索人员</span>' +
    '<input id="crMoveSearch" type="search" placeholder="模糊搜索姓名、岗位、部门…" autocomplete="off" /></label>' +
    '<div class="org-tree" id="crMoveTree" aria-label="机构树"></div>' +
    '<div class="move-actions"><div class="move-actions-left">' +
    '<button class="pack" type="button" id="crMoveOffline">线下移交打包</button></div>' +
    '<div class="move-actions-right"><button type="button" id="crMoveCancel">取消</button>' +
    '<button class="ok" type="button" id="crMoveOnline">线上移交</button></div></div></div></div>';

  const orgTag = { region: "区划", bureau: "部门", office: "科室", person: "人员", center: "交易中心" };
  const orgStaff = {
    sup: [["王建国", "科室负责人"], ["李敏", "承办人"], ["赵强", "审核员"]],
    biz: [["陈涛", "主办人"], ["刘洋", "协办人"], ["周婷", "复核员"]]
  };

  function orgPerson(name, duty) {
    return { label: name, kind: "person", duty: duty };
  }
  function orgOffice(name, people) {
    return { label: name, kind: "office", open: false, children: people.map((row) => orgPerson(row[0], row[1])) };
  }
  function orgBureau(label, offices) {
    return { label: label, kind: "bureau", open: false, children: offices.map((office) => orgOffice(office[0], office[1])) };
  }
  function orgBureauSet(levelName, unit) {
    const map = {
      公安: unit === "厅" ? "省公安厅" : unit === "局" ? "市公安局" : "区公安分局",
      纪委: unit === "厅" ? "省纪委监委" : unit === "局" ? "市纪委" : "区纪委监委",
      交通: unit === "厅" ? "省交通运输厅" : unit === "局" ? "市交通运输局" : "区交通管理处",
      水利: unit === "厅" ? "省水利厅" : unit === "局" ? "市水务局" : "区水务管理所",
      住建: unit === "厅" ? "省住建厅" : unit === "局" ? "市住建局" : "区住建管理处",
      农业农村: unit === "厅" ? "省农业农村厅" : unit === "局" ? "市农业农村局" : "区农业农村局"
    };
    return ["公安", "纪委", "交通", "水利", "住建", "农业农村"].map((key) => orgBureau(map[key], [
      ["综合监督科", orgStaff.sup],
      ["业务处置科", orgStaff.biz]
    ]));
  }
  function orgCenter(label) {
    return {
      label: label,
      kind: "center",
      open: false,
      children: [
        orgOffice("交易监管科", [["张丽华", "监管员"], ["吴俊杰", "分办员"], ["郑晓燕", "归档员"]]),
        orgOffice("见证服务科", [["何志明", "见证员"], ["马慧", "值班长"]])
      ]
    };
  }

  const moveOrgTree = [
    {
      label: "贵州省",
      kind: "region",
      open: true,
      children: [
        { label: "省级", kind: "region", open: true, children: orgBureauSet("省级", "厅").concat([orgCenter("省公共资源交易中心")]) },
        { label: "贵阳市", kind: "region", open: false, children: orgBureauSet("市级", "局").concat([orgCenter("市公共资源交易中心")]) },
        { label: "观山湖区", kind: "region", open: false, children: orgBureauSet("区县级", "处") }
      ]
    }
  ];

  let inited = false;
  let moveSelectedKeys = new Set();
  let moveSearchQuery = "";
  let onComplete = null;
  const orgIndex = new Map();

  function orgPath(node, trail) {
    return trail.concat(node.label);
  }
  function orgEntryText(path, node) {
    const base = path.join(" / ");
    return node.kind === "person" && node.duty ? base + "（" + node.duty + "）" : base;
  }
  function fuzzyMatch(text, query) {
    const hay = String(text).toLowerCase();
    const q = query.trim().toLowerCase();
    if (!q) return true;
    if (hay.includes(q)) return true;
    let at = 0;
    for (let i = 0; i < q.length; i += 1) {
      at = hay.indexOf(q[i], at);
      if (at < 0) return false;
      at += 1;
    }
    return true;
  }
  function personHaystack(path, node) {
    return orgEntryText(path, node) + " " + path.join("");
  }
  function branchHasMatch(node, trail, query) {
    if (!query) return true;
    const path = orgPath(node, trail);
    if (node.kind === "person") return fuzzyMatch(personHaystack(path, node), query);
    return (node.children || []).some((child) => branchHasMatch(child, path, query));
  }
  function flattenOrg(nodes, trail, out) {
    nodes.forEach((node) => {
      const path = orgPath(node, trail);
      const key = path.join("›");
      out.push({ node: node, path: path, key: key, text: orgEntryText(path, node) });
      if (node.children && node.children.length) flattenOrg(node.children, path, out);
    });
    return out;
  }
  function renderOrgNodes(nodes, trail) {
    const query = moveSearchQuery.trim();
    const rows = nodes.map((node) => {
      if (query && !branchHasMatch(node, trail, query)) return "";
      const path = orgPath(node, trail);
      const key = path.join("›");
      const hasKids = node.children && node.children.length;
      const open = hasKids && (query ? true : node.open !== false);
      const kids = hasKids && open ? renderOrgNodes(node.children, path) : "";
      const isPerson = node.kind === "person";
      const picked = isPerson && moveSelectedKeys.has(key);
      const rowClass = (isPerson ? " is-person" : " is-branch") + (picked ? " is-selected" : "");
      const dutyTag = isPerson && node.duty ? '<span class="org-tag">' + esc(node.duty) + "</span>" : (orgTag[node.kind] ? '<span class="org-tag">' + orgTag[node.kind] + "</span>" : "");
      const personAttr = isPerson ? ' data-org-person="1"' : "";
      if (isPerson) {
        return '<li><div class="org-row' + rowClass + '" data-org-key="' + esc(key) + '"' + personAttr + '><span class="org-box" aria-hidden="true"></span><span class="org-label">' + esc(node.label) + "</span>" + dutyTag + "</div></li>";
      }
      const toggle = hasKids
        ? '<button type="button" class="org-toggle' + (open ? " is-open" : "") + '" data-org-toggle aria-label="展开">' + (open ? "▾" : "▸") + "</button>"
        : '<button type="button" class="org-toggle is-empty" tabindex="-1" aria-hidden="true">▸</button>';
      return '<li><div class="org-row' + rowClass + '" data-org-key="' + esc(key) + '">' + toggle + '<span class="org-label">' + esc(node.label) + "</span>" + dutyTag + "</div>" + kids + "</li>";
    }).filter(Boolean);
    if (!rows.length) return "";
    return "<ul>" + rows.join("") + "</ul>";
  }

  function rebuildOrgIndex() {
    orgIndex.clear();
    flattenOrg(moveOrgTree, [], []).forEach((entry) => {
      orgIndex.set(entry.key, entry);
    });
  }

  function paintMoveTree() {
    rebuildOrgIndex();
    const treeEl = document.getElementById("crMoveTree");
    const treeHtml = renderOrgNodes(moveOrgTree, []);
    treeEl.innerHTML = treeHtml || '<p class="org-empty">未找到匹配人员</p>';
    const picks = [...moveSelectedKeys].map((key) => orgIndex.get(key)).filter(Boolean);
    document.getElementById("crMoveCount").textContent = String(picks.length);
    const box = document.getElementById("crMovePicks");
    const clearBtn = document.getElementById("crMoveClear");
    if (!picks.length) {
      box.innerHTML = '<span class="move-empty">暂未选择</span>';
      if (clearBtn) clearBtn.hidden = true;
      return;
    }
    if (clearBtn) clearBtn.hidden = false;
    box.innerHTML = picks.map((entry) =>
      '<span class="move-pick" title="' + esc(entry.text) + '"><b>' + esc(entry.node.label) + " · " + esc(entry.node.duty || "人员") +
      '</b><button type="button" class="move-pick-x" data-remove-pick="' + esc(entry.key) + '" aria-label="移除">×</button></span>'
    ).join("");
  }

  function closeMask() {
    document.getElementById("crHandoffMask").hidden = true;
    onComplete = null;
    moveSelectedKeys = new Set();
    moveSearchQuery = "";
    const search = document.getElementById("crMoveSearch");
    if (search) search.value = "";
  }

  function finishMove(mode) {
    const picks = [...moveSelectedKeys].map((key) => orgIndex.get(key)).filter(Boolean);
    if (!picks.length) {
      window.alert("请至少勾选一名接收人员。");
      return;
    }
    const dept = picks.map((entry) => entry.text).join("；");
    const handoff = mode === "offline" ? "线下移交" : "线上移交";
    const handle = mode === "offline" ? "已办理" : "待办理";
    const limit = mode === "offline" ? "线下移交包已生成" : "";
    const cb = onComplete;
    closeMask();
    if (typeof cb === "function") cb({ dept: dept, handoff: handoff, handle: handle, limit: limit });
  }

  function ensureInit() {
    if (inited) return;
    inited = true;
    document.body.insertAdjacentHTML("beforeend", MASK_HTML);
    const mask = document.getElementById("crHandoffMask");
    mask.addEventListener("click", (event) => {
      if (event.target === mask) closeMask();
    });
    document.getElementById("crMoveCancel").addEventListener("click", closeMask);
    document.getElementById("crMoveClose").addEventListener("click", closeMask);
    document.getElementById("crMoveOnline").addEventListener("click", () => finishMove("online"));
    document.getElementById("crMoveOffline").addEventListener("click", () => finishMove("offline"));
    document.getElementById("crMoveSearch").addEventListener("input", (event) => {
      moveSearchQuery = event.target.value || "";
      paintMoveTree();
    });
    document.getElementById("crMoveClear").addEventListener("click", () => {
      moveSelectedKeys.clear();
      paintMoveTree();
    });
    document.getElementById("crMovePicks").addEventListener("click", (event) => {
      const remove = event.target.closest("[data-remove-pick]");
      if (!remove) return;
      moveSelectedKeys.delete(remove.dataset.removePick);
      paintMoveTree();
    });
    document.getElementById("crMoveTree").addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-org-toggle]");
      if (toggle && !toggle.classList.contains("is-empty")) {
        const row = toggle.closest(".org-row");
        const key = row && row.dataset.orgKey;
        const entry = key && orgIndex.get(key);
        if (entry && entry.node.children && entry.node.children.length) {
          entry.node.open = !entry.node.open;
          paintMoveTree();
        }
        return;
      }
      const row = event.target.closest("[data-org-person]");
      if (!row) return;
      const key = row.dataset.orgKey;
      if (!key) return;
      if (moveSelectedKeys.has(key)) moveSelectedKeys.delete(key);
      else moveSelectedKeys.add(key);
      paintMoveTree();
    });
  }

  global.ClueHandoff = {
    open: function (options) {
      ensureInit();
      if (!options) return;
      if (options.handoff && options.handoff !== "待移交") return;
      onComplete = options.onComplete || null;
      moveSelectedKeys = new Set();
      moveSearchQuery = "";
      const search = document.getElementById("crMoveSearch");
      if (search) search.value = "";
      paintMoveTree();
      const mask = document.getElementById("crHandoffMask");
      mask.hidden = false;
      if (search) search.focus();
    }
  };
})(window);
