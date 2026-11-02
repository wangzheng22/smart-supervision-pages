(function (global) {
  function esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function groupCluesByProject(clues) {
    const groups = new Map();
    (clues || []).forEach((item) => {
      const pid = item.projectId || "__default__";
      const pname = item.projectName || "当前项目";
      if (!groups.has(pid)) groups.set(pid, { id: pid, name: pname, items: [] });
      groups.get(pid).items.push(item);
    });
    return Array.from(groups.values());
  }

  function clueLevelTone(level) {
    const text = String(level || "");
    if (text.indexOf("中") >= 0) return " mid";
    if (text.indexOf("低") >= 0) return " low";
    return "";
  }

  function renderClueItemHtml(item, escFn, withModel) {
    const tone = clueLevelTone(item.level);
    const folded = item.open ? "" : " is-folded";
    const steps = (item.steps || []).map((step) => "<li>" + escFn(step) + "</li>").join("");
    let analysis = "";
    if (withModel && item.model) {
      analysis =
        '<div class="analysis-row"><p class="clue-line"><em>分析</em>' + escFn(item.model) +
        '</p><button type="button" class="model-toggle" data-toggle-clue="' + escFn(item.uid) +
        '" aria-expanded="' + (item.open ? "true" : "false") + '" aria-label="' +
        (item.open ? "收起分析" : "展开分析") + '"><i class="chev" aria-hidden="true"></i></button></div>' +
        (steps ? '<div class="model-body"><ol>' + steps + "</ol></div>" : "");
    } else if (item.model) {
      analysis = '<p class="clue-line"><em>分析</em>' + escFn(item.model) + "</p>";
    }
    const delBtn = item.manual
      ? '<button type="button" class="clue-del" data-remove-clue="' + escFn(item.uid) + '">删除</button>'
      : '<button type="button" class="clue-del" data-exclude-clue="' + escFn(item.alertId) + '" title="从本报告隐藏">隐藏</button>';
    return (
      '<article class="clue-item' + tone + folded + '"><div class="clue-top"><span class="sev">' + escFn(item.level) +
      "</span><strong>" + escFn(item.title) + "</strong>" + delBtn + '</div><p class="clue-line"><em>涉及主体</em>' +
      escFn((item.whoNames || []).join("、")) + '</p><p class="clue-line"><em>事项</em>' + escFn(item.note || "待补充原因") +
      "</p>" + analysis + "</article>"
    );
  }

  function renderProcessBodyHtml(clues, options) {
    const escFn = (options && options.esc) || esc;
    const projectFold = (options && options.projectFold) || {};
    const withModel = !options || options.withModel !== false;
    if (!clues || !clues.length) {
      return '<p class="process-empty">当前图区无亮显预警，请在图中点选主体或预警卡片</p>';
    }
    const groups = groupCluesByProject(clues);
    if (groups.length <= 1) {
      return groups[0].items.map((item) => renderClueItemHtml(item, escFn, withModel)).join("");
    }
    return groups.map((group) => {
      const collapsed = projectFold[group.id] === true;
      return (
        '<section class="report-project-group' + (collapsed ? " is-collapsed" : "") + '">' +
        '<button type="button" class="report-project-head" data-toggle-project="' + escFn(group.id) + '">' +
        '<i class="report-project-chev" aria-hidden="true"></i><span class="report-project-name">' + escFn(group.name) +
        '</span><span class="report-project-count">' + group.items.length + " 张</span></button>" +
        '<div class="report-project-body">' +
        group.items.map((item) => renderClueItemHtml(item, escFn, withModel)).join("") +
        "</div></section>"
      );
    }).join("");
  }

  function collectReportAttachAlerts(clues, options) {
    const opts = options || {};
    const resolveAlert = opts.resolveAlert;
    const getGraphAlerts = opts.getGraphAlerts;
    const pool = typeof getGraphAlerts === "function" ? getGraphAlerts() || [] : [];
    const seen = new Set();
    const alerts = [];
    function push(alert) {
      if (!alert || !alert.id || seen.has(alert.id)) return;
      seen.add(alert.id);
      alerts.push(alert);
    }
    (clues || []).forEach((clue) => {
      if (clue && clue.attachAlert) push(clue.attachAlert);
    });
    if (alerts.length) return alerts;
    if (Array.isArray(opts.alerts)) opts.alerts.forEach((item) => push(item));
    if (alerts.length) return alerts;
    function pick(id) {
      if (!id) return null;
      if (typeof resolveAlert === "function") {
        const hit = resolveAlert(id);
        if (hit) return hit;
      }
      let hit = pool.find((a) => a && a.id === id);
      if (hit) return hit;
      return pool.find((a) => a && (a._mergedAlertIds || []).indexOf(id) >= 0) || null;
    }
    (clues || []).forEach((clue) => {
      const id = clue && clue.alertId;
      if (!id || seen.has(id)) return;
      const alert = pick(id);
      if (alert) push(alert);
    });
    return alerts;
  }

  function renderAlertAttachHtml(clues, options) {
    const escFn = (options && options.esc) || esc;
    const attachContext = (options && options.attachContext) || function () { return {}; };
    const buildMerged = (typeof global !== "undefined" && global.buildMergedWarnAttachmentForestHtml) ||
      (typeof window !== "undefined" && window.buildMergedWarnAttachmentForestHtml);
    const buildOne = (typeof global !== "undefined" && global.buildWarnAttachmentForestHtml) ||
      (typeof window !== "undefined" && window.buildWarnAttachmentForestHtml);
    const alerts = collectReportAttachAlerts(clues, options);
    if (!alerts.length) {
      return '<p class="report-attach-empty">当前预警卡片暂无附件清单</p>';
    }
    let block = "";
    if (typeof buildMerged === "function") {
      block = buildMerged(alerts, (alert) => attachContext(alert), escFn, { innerOnly: true });
    } else if (typeof buildOne === "function") {
      block = alerts.map((alert) => buildOne(alert, attachContext(alert), escFn, { innerOnly: true })).join("");
    } else {
      return '<p class="report-attach-empty">暂无预警附件</p>';
    }
    return block || '<p class="report-attach-empty">当前预警卡片暂无附件清单</p>';
  }

  function buildCluesFromAlerts(alerts, ctx) {
    const context = ctx || {};
    const ui = context.clueUi || (context.clueUi = {});
    const excluded = context.excludedIds || new Set();
    const seq = context.clueSeqRef || { n: 1 };
    const out = [];
    (alerts || []).forEach((alert) => {
      const id = alert && alert.id;
      if (!id || excluded.has(id)) return;
      const prev = ui[id] || context.clues && context.clues.find((c) => c.alertId === id);
      const clue = {
        uid: (prev && prev.uid) || ("c" + seq.n++),
        alertId: id,
        attachAlert: alert,
        projectId: alert.projectId || "",
        projectName: alert.projectName || "",
        level: alert.levelFull || alert.level || "高",
        title: alert.title || "",
        note: alert.note || "",
        whoNames: (alert.whoNames || []).slice(),
        model: alert.model || "",
        steps: (alert.steps || []).slice(),
        open: prev ? prev.open !== false : true
      };
      ui[id] = clue;
      out.push(clue);
    });
    (context.manualClues || []).forEach((manual) => out.push(manual));
    return out;
  }

  function pendingClueCatalog() {
    if (Array.isArray(global.PENDING_CLUES)) return global.PENDING_CLUES;
    return (Array.isArray(global.KNOWN_CLUES) ? global.KNOWN_CLUES : []).map((item) => ({ ...item, handoff: "待移交" }));
  }

  function makeReportClueNo() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const day = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate());
    return "XS-" + day + "-" + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
  }

  const DRAWER_HTML =
    '<div class="clue-report-backdrop" data-cr-backdrop></div>' +
    '<aside class="clue-report-drawer" aria-labelledby="cr-reportTitle" aria-hidden="true" inert>' +
    '<div class="report-head"><h2 id="cr-reportTitle">线索报告</h2><button class="report-x" type="button" data-cr-close aria-label="关闭">×</button></div>' +
    '<section class="report-fixed-top" aria-label="线索报告固定信息"><div class="pair">' +
    '<div class="field"><label class="lab" for="cr-reportClueNo">线索编号</label><input id="cr-reportClueNo" class="clue-field-input" type="text" autocomplete="off" readonly /></div>' +
    '<div class="field"><label class="lab" for="cr-reportClueName">线索名称</label><div class="clue-name-row">' +
    '<input id="cr-reportClueName" class="clue-field-input" type="text" maxlength="80" autocomplete="off" readonly />' +
    '<div class="clue-pick-wrap"><button class="clue-pick-btn" type="button" data-cr-pick aria-label="从待移交线索中选择">' +
    '<img src="assets/icon-clue-directory.png" width="18" height="18" alt="" /></button>' +
    '<span class="clue-pick-tip" role="tooltip" hidden>点击可选已有线索</span></div></div></div></div>' +
    '<div class="field report-guidance-field"><label class="lab" for="cr-reportGuidance">办案指引</label>' +
    '<textarea id="cr-reportGuidance" class="report-guidance-input" aria-label="办案指引" placeholder="将结合预警情形生成下一步建议及建议移交部门"></textarea></div></section>' +
    '<div class="report-body"><section class="report-findings">' +
    '<h3>发现问题</h3><textarea id="cr-reportFindings" class="report-findings-input" aria-label="发现问题" placeholder="添加预警卡片后，将自动综合预警内容"></textarea></section>' +
    '<section class="report-process">' +
    '<div class="process-head"><h3>预警卡片<b data-cr-count>0</b></h3>' +
    '<button class="fold-all" type="button" data-cr-fold-all><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6.2l5 4.6 5-4.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>全部展开</span></button></div>' +
    '<div class="process-body" data-cr-process></div></section>' +
    '<section class="report-files"><h3>附件</h3>' +
    '<div class="report-attach-block"><h4 class="report-attach-subhead">预警详情附件</h4><div class="report-attach-ref" data-cr-attach-ref></div></div>' +
    '<div class="report-attach-block report-attach-upload"><h4 class="report-attach-subhead">补充上传</h4>' +
    '<label class="attach-pick">上传附件<input type="file" data-cr-files multiple accept=".pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.avi,.mp3,.wav,.zip,.txt,.csv,.html,.htm" /></label>' +
    '<p class="hint">可一次选择多个文件，也能继续追加</p><ul class="file-list" data-cr-file-list></ul></div></section></div>' +
    '<div class="report-bar"><div class="report-handoff-meta"><span class="report-handoff-lab">线索状态</span>' +
    '<span class="report-handoff-pill st-move" data-cr-handoff>待移交</span></div>' +
    '<div class="report-bar-actions">' +
    '<button class="report-handoff-btn" type="button" data-cr-handoff-btn>移交</button>' +
    '<button class="report-go" type="button" data-cr-report-go>生成报告</button></div></div></aside>';

  const REPORT_FORMAT_DIALOG_HTML =
    '<dialog class="report-format-dialog" data-cr-format-dialog aria-labelledby="cr-reportFormatTitle">' +
    '<form data-cr-format-form method="dialog">' +
    '<div class="report-format-head"><h3 id="cr-reportFormatTitle">选择导出格式</h3>' +
    '<button class="report-format-x" type="button" data-cr-format-close aria-label="关闭">×</button></div>' +
    '<p class="report-format-hint">可多选，将分别生成对应文件</p>' +
    '<label class="report-format-check report-format-check--all">' +
    '<input type="checkbox" data-cr-format-all checked /> 全选</label>' +
    '<div class="report-format-options">' +
    '<label class="report-format-check"><input type="checkbox" name="crReportFormat" value="pdf" checked /> pdf</label>' +
    '<label class="report-format-check"><input type="checkbox" name="crReportFormat" value="word" checked /> word</label></div>' +
    '<div class="report-format-actions">' +
    '<button class="report-format-cancel" type="button" data-cr-format-cancel>取消</button>' +
    '<button class="report-format-go" type="submit" data-cr-format-confirm>确定生成</button></div></form></dialog>';

  const PICK_DIALOG_HTML =
    '<dialog class="clue-pick-dialog" data-cr-pick-dialog aria-labelledby="cr-cluePickTitle">' +
    '<div class="clue-pick-head"><h3 id="cr-cluePickTitle">选择待移交线索</h3><button class="clue-pick-x" type="button" data-cr-pick-close aria-label="关闭">×</button></div>' +
    '<input class="clue-pick-search" data-cr-pick-search type="search" placeholder="搜索线索编号、名称、来源或责任部门" autocomplete="off" />' +
    '<div class="clue-pick-list" data-cr-pick-list></div></dialog>';

  function ClueReport(options) {
    this.options = options || {};
    this.open = false;
    this.clues = [];
    this.files = [];
    this.generated = "";
    this.generatedAt = "";
    this.userEditedFindings = false;
    this.userEditedGuidance = false;
    this.clueSeq = 1;
    this.typeGen = 0;
    this.handoff = "待移交";
    this.handoffDept = "";
    this.handoffHandle = "";
    this.activeRow = null;
    this.projectFold = {};
    this.excludedAlertIds = new Set();
    this.manualClues = [];
    this.clueUi = {};
    this._initDom();
    this._bindEvents();
    this.seedClueMeta();
    this.render();
  }

  ClueReport.prototype._initDom = function () {
    const layout = this.options.layout === "embed" ? "layout-embed" : "layout-slide";
    const parent = this.options.parent || document.body;
    if (this.options.root) {
      this.host = this.options.root;
      this.host.className = (this.host.className ? this.host.className + " " : "") + "clue-report-host " + layout;
      this.host.innerHTML = DRAWER_HTML;
      if (!document.querySelector("[data-cr-pick-dialog]")) {
        document.body.insertAdjacentHTML("beforeend", PICK_DIALOG_HTML);
      }
      if (!document.querySelector("[data-cr-format-dialog]")) {
        document.body.insertAdjacentHTML("beforeend", REPORT_FORMAT_DIALOG_HTML);
      }
    } else {
      this.host = document.createElement("div");
      this.host.className = "clue-report-host " + layout;
      this.host.innerHTML = DRAWER_HTML;
      parent.appendChild(this.host);
      if (!document.querySelector("[data-cr-pick-dialog]")) {
        document.body.insertAdjacentHTML("beforeend", PICK_DIALOG_HTML);
      }
      if (!document.querySelector("[data-cr-format-dialog]")) {
        document.body.insertAdjacentHTML("beforeend", REPORT_FORMAT_DIALOG_HTML);
      }
    }
    this.drawer = this.host.querySelector(".clue-report-drawer");
    this.$ = (sel) => this.host.querySelector(sel);
    this.noInput = this.$("#cr-reportClueNo");
    this.nameInput = this.$("#cr-reportClueName");
    this.findingsInput = this.$("#cr-reportFindings");
    this.guidanceInput = this.$("#cr-reportGuidance");
    this.processBody = this.host.querySelector("[data-cr-process]");
    this.processCount = this.host.querySelector("[data-cr-count]");
    this.fileList = this.host.querySelector("[data-cr-file-list]");
    this.fileInput = this.host.querySelector("[data-cr-files]");
    this.handoffEl = this.host.querySelector("[data-cr-handoff]");
    this.handoffBtn = this.host.querySelector("[data-cr-handoff-btn]");
    this.reportGoBtn = this.host.querySelector("[data-cr-report-go]");
    this.formatDialog = document.querySelector("[data-cr-format-dialog]");
    this.formatForm = document.querySelector("[data-cr-format-form]");
    this.formatSelectAll = document.querySelector("[data-cr-format-all]");
    this.formatConfirm = document.querySelector("[data-cr-format-confirm]");
    this.pickDialog = document.querySelector("[data-cr-pick-dialog]");
    this.pickSearch = document.querySelector("[data-cr-pick-search]");
    this.pickList = document.querySelector("[data-cr-pick-list]");
  };

  ClueReport.prototype.defaultClueName = function () {
    if (typeof this.options.getDefaultClueName === "function") return this.options.getDefaultClueName();
    return "监管线索";
  };

  ClueReport.prototype.seedClueMeta = function () {
    if (this.noInput) this.noInput.value = makeReportClueNo();
    if (this.nameInput) this.nameInput.value = this.defaultClueName();
  };

  ClueReport.prototype.ensureClueMeta = function () {
    if (this.noInput && !this.noInput.value.trim()) this.noInput.value = makeReportClueNo();
    if (this.nameInput && !this.nameInput.value.trim()) this.nameInput.value = this.defaultClueName();
  };

  ClueReport.prototype.setOpen = function (on) {
    this.open = !!on;
    this.host.classList.toggle("is-open", this.open);
    if (this.drawer) {
      this.drawer.inert = !this.open;
      this.drawer.setAttribute("aria-hidden", this.open ? "false" : "true");
    }
    if (this.open) this.ensureClueMeta();
    if (typeof this.options.onOpenChange === "function") this.options.onOpenChange(this.open);
    this.render();
  };

  ClueReport.prototype.openDrawer = function () { this.setOpen(true); };
  ClueReport.prototype.close = function () { this.setOpen(false); };
  ClueReport.prototype.toggle = function () { this.setOpen(!this.open); };

  ClueReport.prototype.pushClue = function (item) {
    const uid = item.uid || "c" + this.clueSeq++;
    this.clues.push({
      uid,
      alertId: item.alertId || "",
      projectId: item.projectId || "",
      projectName: item.projectName || "",
      manual: !!item.manual,
      level: item.level || "线索",
      title: item.title || "预警线索",
      note: item.note || "",
      whoNames: (item.whoNames || []).slice(),
      model: item.model || "",
      steps: (item.steps || []).slice(),
      open: item.open !== false
    });
  };

  ClueReport.prototype.refreshFromGraph = function () {
    if (typeof this.options.getGraphAlerts !== "function") return;
    const seqRef = { n: this.clueSeq };
    this.clues = buildCluesFromAlerts(this.options.getGraphAlerts() || [], {
      clueUi: this.clueUi,
      excludedIds: this.excludedAlertIds,
      clueSeqRef: seqRef,
      manualClues: this.manualClues,
      clues: this.clues
    });
    this.clueSeq = seqRef.n;
    this.render();
    if (this.open) this.syncConclusion();
  };

  ClueReport.prototype.syncFromGraphAlerts = function (alerts) {
    const seqRef = { n: this.clueSeq };
    this.clues = buildCluesFromAlerts(alerts, {
      clueUi: this.clueUi,
      excludedIds: this.excludedAlertIds,
      clueSeqRef: seqRef,
      manualClues: this.manualClues,
      clues: this.clues
    });
    this.clueSeq = seqRef.n;
  };

  ClueReport.prototype.warningRowId = function (row) {
    return row.id || row.code || row.name;
  };

  ClueReport.prototype.handoffTone = function (handoff) {
    if (handoff === "线上移交") return "st-sent";
    if (handoff === "线下移交") return "st-offline";
    return "st-move";
  };

  ClueReport.prototype.applyHandoffFromRow = function (row) {
    if (!row) {
      this.handoff = "待移交";
      this.handoffDept = "";
      this.handoffHandle = "";
      return;
    }
    this.handoff = row.handoff || "待移交";
    this.handoffDept = row.dept || "";
    this.handoffHandle = row.handle || "";
  };

  ClueReport.prototype.syncHandoffToRow = function (row) {
    if (!row) return;
    row.handoff = this.handoff;
    if (this.handoffDept) row.dept = this.handoffDept;
    if (this.handoffHandle) row.handle = this.handoffHandle;
  };

  ClueReport.prototype.syncRowClueMeta = function (row) {
    if (!row) return;
    row.clueNo = this.noInput.value;
    row.clueName = this.nameInput.value;
    this.syncHandoffToRow(row);
  };

  ClueReport.prototype.applyRowClueMeta = function (row) {
    if (!row) return;
    if (row.clueNo) this.noInput.value = row.clueNo;
    if (row.clueName) this.nameInput.value = row.clueName;
    this.applyHandoffFromRow(row);
    this.ensureClueMeta();
  };

  ClueReport.prototype.ensureClueForRow = function (row) {
    const id = this.warningRowId(row);
    if (this.clues.some((c) => c.alertId === id)) return;
    const who = row.name || row.bidder || row.project || "—";
    this.pushClue({
      alertId: id,
      level: (typeof levelShort === "function" ? levelShort(row.level) : row.level) || "高",
      title: row.point || row.warnType || row.name || "预警事项",
      note: row.point || row.warnType || "",
      whoNames: [who]
    });
  };

  ClueReport.prototype.openFromWarningRow = function (row) {
    if (!row) return;
    this.activeRow = row;
    this.applyRowClueMeta(row);
    if (!row.clueNo) this.syncRowClueMeta(row);
    this.generated = "";
    this.openDrawer();
    if (typeof this.options.getGraphAlerts === "function") this.refreshFromGraph();
    else {
      this.ensureClueForRow(row);
      this.syncConclusion();
      this.render();
    }
  };

  ClueReport.prototype.addFromWarningRow = function (row) {
    if (!row) return;
    this.activeRow = row;
    this.handoff = "待移交";
    this.handoffDept = "";
    this.handoffHandle = "";
    row.handoff = "待移交";
    this.ensureClueMeta();
    this.syncRowClueMeta(row);
    this.generated = "";
    this.openDrawer();
    if (typeof this.options.getGraphAlerts === "function") this.refreshFromGraph();
    else {
      this.ensureClueForRow(row);
      this.syncConclusion();
      this.render();
    }
  };

  ClueReport.prototype.renderHandoffBar = function () {
    if (!this.handoffEl) return;
    const handoff = this.handoff || "待移交";
    this.handoffEl.textContent = handoff;
    this.handoffEl.className = "report-handoff-pill " + this.handoffTone(handoff);
    const pending = handoff === "待移交";
    if (this.handoffBtn) {
      this.handoffBtn.disabled = !pending;
      this.handoffBtn.hidden = !pending;
    }
    if (this.reportGoBtn) this.reportGoBtn.disabled = this.clues.length === 0;
  };

  ClueReport.prototype.resetReportFormatDialog = function () {
    if (!this.formatForm) return;
    this.formatForm.querySelectorAll('input[name="crReportFormat"]').forEach((input) => {
      input.checked = true;
    });
    if (this.formatSelectAll) this.formatSelectAll.checked = true;
    this.syncReportFormatConfirmState();
  };

  ClueReport.prototype.selectedReportFormats = function () {
    if (!this.formatForm) return [];
    return [...this.formatForm.querySelectorAll('input[name="crReportFormat"]:checked')].map((input) => input.value);
  };

  ClueReport.prototype.syncReportFormatConfirmState = function () {
    if (!this.formatConfirm) return;
    this.formatConfirm.disabled = this.selectedReportFormats().length === 0;
  };

  ClueReport.prototype.openReportFormatDialog = function () {
    if (!this.clues.length || !this.formatDialog) return;
    this.resetReportFormatDialog();
    this.formatDialog.showModal();
  };

  ClueReport.prototype.clueRiskBucket = function (level) {
    const text = String(level || "");
    if (text.indexOf("高") >= 0) return "high";
    if (text.indexOf("中") >= 0) return "mid";
    if (text.indexOf("低") >= 0) return "low";
    return "other";
  };

  ClueReport.prototype.autoFindings = function () {
    if (!this.clues.length) return "";
    const names = [];
    const themes = [];
    const counts = { high: 0, mid: 0, low: 0, other: 0 };
    this.clues.forEach((item) => {
      item.whoNames.forEach((name) => { if (name && !names.includes(name)) names.push(name); });
      const theme = String(item.title || item.note || "").trim();
      if (theme && !themes.includes(theme)) themes.push(theme);
      counts[this.clueRiskBucket(item.level)] += 1;
    });
    const levelParts = [];
    if (counts.high) levelParts.push("高风险 " + counts.high + " 张");
    if (counts.mid) levelParts.push("中风险 " + counts.mid + " 张");
    if (counts.low) levelParts.push("低风险 " + counts.low + " 张");
    if (counts.other) levelParts.push("其他 " + counts.other + " 张");
    const nameText = !names.length
      ? "相关主体"
      : names.length <= 3
        ? names.join("、")
        : names.slice(0, 3).join("、") + "等 " + names.length + " 个主体";
    const themeText = !themes.length
      ? "多项异常预警"
      : themes.length <= 4
        ? themes.join("、")
        : themes.slice(0, 4).join("、") + "等";
    let text = "本次线索共归集 " + this.clues.length + " 张预警卡片";
    if (levelParts.length) text += "（" + levelParts.join("、") + "）";
    text += "，主要涉及" + nameText + "。";
    text += "综合卡片预警内容，集中反映" + themeText + "等风险信号，相关交易环节存在需重点核查的合规与公平性问题。";
    return text;
  };

  ClueReport.prototype.suggestedDepts = function () {
    const depts = [];
    const add = (name) => {
      const text = String(name || "").trim();
      if (text && !depts.includes(text)) depts.push(text);
    };
    add(this.handoffDept);
    add("公共资源交易中心");
    add("行业主管部门");
    const hasHigh = this.clues.some((item) => String(item.level || "").indexOf("高") >= 0);
    if (hasHigh) add("纪检监察部门");
    add("审计部门");
    return depts;
  };

  ClueReport.prototype.autoGuidance = function () {
    if (!this.clues.length) return "";
    const depts = this.suggestedDepts();
    const steps = [
      "1. 对照预警卡片核实涉及主体、事项及模型分析结论，补充交易过程与关系图谱等佐证。",
      "2. 结合发现问题开展交叉比对，确认是否存在围标串标、利益输送等需立案或移交的情形。",
      "3. 按职责分工发起核查、约谈或线索移交，并在系统中登记处置进展与反馈结果。"
    ];
    return steps.join("\n") + "\n\n建议移交/协同部门：" + depts.join("、") + "。";
  };

  ClueReport.prototype.typewriteInto = function (input, text, gen, done) {
    if (!input || !text) {
      if (input) input.value = "";
      if (typeof done === "function") done();
      return;
    }
    input.value = "";
    let index = 0;
    const timer = window.setInterval(() => {
      if (gen !== this.typeGen) {
        window.clearInterval(timer);
        return;
      }
      index = Math.min(text.length, index + 1);
      input.value = text.slice(0, index);
      input.scrollTop = input.scrollHeight;
      if (index >= text.length) {
        window.clearInterval(timer);
        if (typeof done === "function") done();
      }
    }, 32);
  };

  ClueReport.prototype.syncConclusion = function () {
    const findings = this.autoFindings();
    const guidance = this.autoGuidance();
    if (!findings && !guidance) {
      this.typeGen += 1;
      if (!this.userEditedFindings) this.findingsInput.value = "";
      if (!this.userEditedGuidance) this.guidanceInput.value = "";
      return;
    }
    const gen = ++this.typeGen;
    const writeGuidance = (onDone) => {
      if (this.userEditedGuidance) {
        if (typeof onDone === "function") onDone();
        return;
      }
      if (!guidance) {
        this.guidanceInput.value = "";
        if (typeof onDone === "function") onDone();
        return;
      }
      if (!this.open) {
        this.guidanceInput.value = guidance;
        if (typeof onDone === "function") onDone();
        return;
      }
      this.typewriteInto(this.guidanceInput, guidance, gen, onDone);
    };
    if (this.userEditedFindings) {
      writeGuidance();
      return;
    }
    this.userEditedFindings = false;
    if (!this.open) {
      this.findingsInput.value = findings;
      writeGuidance();
      return;
    }
    if (!findings) {
      this.findingsInput.value = "";
      writeGuidance();
      return;
    }
    this.typewriteInto(this.findingsInput, findings, gen, () => writeGuidance());
  };

  ClueReport.prototype.renderUploadFiles = function () {
    if (!this.fileList) return;
    this.fileList.innerHTML = this.files.map((file, index) =>
      '<li><span title="' + esc(file.name) + '">' + esc(file.name) + '</span><button type="button" data-remove-file="' + index + '">删除</button></li>'
    ).join("");
  };

  ClueReport.prototype.renderAlertAttachRefs = function () {
    const host = this.host.querySelector("[data-cr-attach-ref]");
    if (!host) return;
    const resolve = typeof this.options.resolveAlert === "function"
      ? this.options.resolveAlert
      : (id) => {
          const list = typeof this.options.getGraphAlerts === "function" ? this.options.getGraphAlerts() : [];
          return (list || []).find((item) => item.id === id);
        };
    const ctxFn = typeof this.options.attachContext === "function"
      ? this.options.attachContext
      : function () { return {}; };
    const poolFn = typeof this.options.getGraphAlerts === "function" ? this.options.getGraphAlerts : null;
    host.innerHTML = renderAlertAttachHtml(this.clues, {
      esc: esc,
      alerts: poolFn ? poolFn() || [] : [],
      getGraphAlerts: poolFn || undefined,
      resolveAlert: resolve,
      attachContext: ctxFn
    });
    const bind = (typeof global !== "undefined" && global.CatalogAttach) ||
      (typeof window !== "undefined" && window.CatalogAttach);
    if (bind && bind.bindRoot) bind.bindRoot(host);
  };

  ClueReport.prototype.render = function () {
    this.processCount.textContent = String(this.clues.length);
    const foldAll = this.host.querySelector("[data-cr-fold-all]");
    const allOpen = this.clues.length > 0 && this.clues.every((item) => item.open);
    if (foldAll) {
      foldAll.disabled = this.clues.length === 0;
      foldAll.classList.toggle("is-open", allOpen);
      foldAll.querySelector("span").textContent = allOpen ? "全部收起" : "全部展开";
    }
    this.renderHandoffBar();
    this.processBody.innerHTML = renderProcessBodyHtml(this.clues, {
      esc: esc,
      projectFold: this.projectFold,
      withModel: true
    });
    this.renderAlertAttachRefs();
    this.renderUploadFiles();
  };

  ClueReport.prototype.reportHeaderLines = function () {
    const lines = [];
    const no = this.noInput.value.trim();
    const name = this.nameInput.value.trim();
    if (no) lines.push("线索编号：" + no);
    if (name) lines.push("线索名称：" + name);
    return lines;
  };

  ClueReport.prototype.reportLines = function () {
    const lines = ["线索报告"];
    if (this.generatedAt) lines.push("生成时间：" + this.generatedAt);
    lines.push.apply(lines, this.reportHeaderLines());
    lines.push("");
    lines.push("发现问题");
    lines.push(this.findingsInput.value || this.autoFindings());
    lines.push("", "办案指引");
    lines.push(this.guidanceInput.value || this.autoGuidance());
    lines.push("", "预警卡片");
    if (!this.clues.length) lines.push("尚未添加线索");
    this.clues.forEach((item, index) => {
      lines.push("", (index + 1) + ". " + item.title + "（" + item.level + "）");
      lines.push("涉及主体：" + item.whoNames.join("、"));
      lines.push("事项：" + item.note);
      if (item.model) lines.push("模型：" + item.model);
      (item.steps || []).forEach((step, stepIndex) => lines.push((stepIndex + 1) + "）" + step));
    });
    lines.push("", "附件");
    if (!this.files.length) lines.push("无");
    this.files.forEach((file) => lines.push(file.name));
    return lines;
  };

  ClueReport.prototype.downloadBlob = function (bytes, name, type) {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  ClueReport.prototype.paintReport = function () {
    const width = 900;
    const max = width - 96;
    const probe = document.createElement("canvas").getContext("2d");
    probe.font = "16px PingFang SC, Microsoft YaHei, sans-serif";
    const lines = [];
    this.reportLines().forEach((text) => {
      if (!text) { lines.push(""); return; }
      let line = "";
      for (const ch of text) {
        if (probe.measureText(line + ch).width > max) {
          lines.push(line);
          line = ch;
        } else line += ch;
      }
      lines.push(line);
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.max(480, 80 + lines.length * 28);
    const g = canvas.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = "#16324f";
    g.font = "16px PingFang SC, Microsoft YaHei, sans-serif";
    lines.forEach((line, index) => g.fillText(line, 48, 56 + index * 28));
    return canvas;
  };

  ClueReport.prototype.jpegPdf = function (canvas) {
    const raw = atob(canvas.toDataURL("image/jpeg", 0.86).split(",")[1]);
    const img = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) img[i] = raw.charCodeAt(i);
    const pageW = 595;
    const pageH = Math.max(420, Math.round(pageW * canvas.height / canvas.width));
    const enc = new TextEncoder();
    const chunks = [];
    let length = 0;
    const offsets = [];
    const push = (part) => {
      const bytes = typeof part === "string" ? enc.encode(part) : part;
      const at = length;
      chunks.push(bytes);
      length += bytes.length;
      return at;
    };
    push("%PDF-1.4\n");
    offsets[1] = push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    offsets[2] = push("2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n");
    offsets[3] = push("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pageW + " " + pageH + "] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\nendobj\n");
    const stream = "q\n" + pageW + " 0 0 " + pageH + " 0 0 cm\n/Im0 Do\nQ";
    offsets[4] = push("4 0 obj\n<< /Length " + enc.encode(stream).length + " >>\nstream\n" + stream + "\nendstream\nendobj\n");
    offsets[5] = push("5 0 obj\n<< /Type /XObject /Subtype /Image /Width " + canvas.width + " /Height " + canvas.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + img.length + " >>\nstream\n");
    push(img);
    push("\nendstream\nendobj\n");
    const xrefAt = length;
    let xref = "xref\n0 6\n0000000000 65535 f \n";
    for (let i = 1; i <= 5; i += 1) xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
    push(xref);
    push("trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xrefAt + "\n%%EOF");
    const out = new Uint8Array(length);
    let cursor = 0;
    chunks.forEach((chunk) => { out.set(chunk, cursor); cursor += chunk.length; });
    return out;
  };

  ClueReport.prototype.renderCluePickList = function (query) {
    const q = (query || "").trim().toLowerCase();
    const rows = pendingClueCatalog().filter((item) => {
      if (!q) return true;
      return [item.id, item.name, item.source, item.type, item.dept].join(" ").toLowerCase().includes(q);
    });
    if (!rows.length) {
      this.pickList.innerHTML = '<div class="clue-pick-empty">暂无匹配的待移交线索</div>';
      return;
    }
    this.pickList.innerHTML = rows.map((item) =>
      '<button type="button" class="clue-pick-row" data-clue-id="' + esc(item.id) + '"><b>' + esc(item.name) +
      "</b><span>" + esc(item.id) + " · " + esc(item.source || "") + " · " + esc(item.dept || "") + " · 待移交</span></button>"
    ).join("");
  };

  ClueReport.prototype._bindEvents = function () {
    const self = this;
    this.host.querySelector("[data-cr-close]").addEventListener("click", () => self.close());
    this.host.querySelector("[data-cr-backdrop]").addEventListener("click", () => self.close());
    this.host.querySelector("[data-cr-pick]").addEventListener("click", () => {
      self.pickSearch.value = "";
      self.renderCluePickList("");
      self.pickDialog.showModal();
      self.pickSearch.focus();
    });
    document.querySelector("[data-cr-pick-close]").addEventListener("click", () => self.pickDialog.close());
    this.pickDialog.addEventListener("click", (event) => {
      if (event.target === self.pickDialog) self.pickDialog.close();
    });
    this.pickSearch.addEventListener("input", () => self.renderCluePickList(self.pickSearch.value));
    this.pickList.addEventListener("click", (event) => {
      const row = event.target.closest(".clue-pick-row");
      if (!row) return;
      const item = pendingClueCatalog().find((entry) => entry.id === row.dataset.clueId);
      if (!item) return;
      self.noInput.value = item.id;
      self.nameInput.value = item.name;
      self.pickDialog.close();
    });
    this.host.querySelector("[data-cr-fold-all]").addEventListener("click", () => {
      const open = !(self.clues.length && self.clues.every((item) => item.open));
      self.clues.forEach((item) => { item.open = open; });
      self.render();
    });
    this.processBody.addEventListener("click", (event) => {
      const projBtn = event.target.closest("[data-toggle-project]");
      if (projBtn) {
        const pid = projBtn.getAttribute("data-toggle-project");
        self.projectFold[pid] = !self.projectFold[pid];
        self.render();
        return;
      }
      const toggle = event.target.closest("[data-toggle-clue]");
      if (toggle) {
        const clue = self.clues.find((item) => item.uid === toggle.getAttribute("data-toggle-clue"));
        if (clue) clue.open = !clue.open;
        self.render();
        return;
      }
      const excludeBtn = event.target.closest("[data-exclude-clue]");
      if (excludeBtn) {
        self.excludedAlertIds.add(excludeBtn.getAttribute("data-exclude-clue"));
        self.generated = "";
        self.refreshFromGraph();
        return;
      }
      const button = event.target.closest("[data-remove-clue]");
      if (!button) return;
      const uid = button.getAttribute("data-remove-clue");
      self.manualClues = self.manualClues.filter((item) => item.uid !== uid);
      self.clues = self.clues.filter((item) => item.uid !== uid);
      self.generated = "";
      self.syncConclusion();
      self.render();
    });
    if (this.reportGoBtn) {
      this.reportGoBtn.addEventListener("click", () => self.openReportFormatDialog());
    }
    if (this.formatForm) {
      this.formatForm.querySelectorAll('input[name="crReportFormat"]').forEach((input) => {
        input.addEventListener("change", () => {
          if (self.formatSelectAll) {
            const boxes = self.formatForm.querySelectorAll('input[name="crReportFormat"]');
            self.formatSelectAll.checked = [...boxes].every((box) => box.checked);
          }
          self.syncReportFormatConfirmState();
        });
      });
      if (this.formatSelectAll) {
        this.formatSelectAll.addEventListener("change", () => {
          const on = self.formatSelectAll.checked;
          self.formatForm.querySelectorAll('input[name="crReportFormat"]').forEach((input) => {
            input.checked = on;
          });
          self.syncReportFormatConfirmState();
        });
      }
      const formatClose = this.formatForm.querySelector("[data-cr-format-close]");
      const formatCancel = this.formatForm.querySelector("[data-cr-format-cancel]");
      if (formatClose) formatClose.addEventListener("click", () => self.formatDialog.close());
      if (formatCancel) formatCancel.addEventListener("click", () => self.formatDialog.close());
      this.formatForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const formats = self.selectedReportFormats();
        if (!formats.length) return;
        if (typeof self.options.onGenerateReport === "function") {
          self.options.onGenerateReport(formats, self);
        }
        self.formatDialog.close();
      });
    }
    if (this.handoffBtn) this.handoffBtn.addEventListener("click", () => {
      if (self.handoff !== "待移交") return;
      if (!global.ClueHandoff) return;
      global.ClueHandoff.open({
        handoff: self.handoff,
        onComplete: (result) => {
          self.handoff = result.handoff;
          self.handoffDept = result.dept;
          self.handoffHandle = result.handle;
          if (self.activeRow) {
            self.activeRow.dept = result.dept;
            self.activeRow.handoff = result.handoff;
            self.activeRow.handle = result.handle;
            if (result.limit) self.activeRow.limit = result.limit;
          }
          if (typeof self.options.onHandoffChange === "function") {
            self.options.onHandoffChange(result, self.activeRow);
          }
          self.renderHandoffBar();
          if (!self.userEditedGuidance && self.clues.length) {
            const guidance = self.autoGuidance();
            const gen = ++self.typeGen;
            if (self.open) self.typewriteInto(self.guidanceInput, guidance, gen, null);
            else self.guidanceInput.value = guidance;
          }
        }
      });
    });
    this.findingsInput.addEventListener("input", () => { self.typeGen += 1; self.userEditedFindings = true; });
    this.guidanceInput.addEventListener("input", () => { self.userEditedGuidance = true; });
    this.fileInput.addEventListener("change", () => {
      [...self.fileInput.files].forEach((file) => {
        const same = self.files.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified);
        if (!same) self.files.push(file);
      });
      self.fileInput.value = "";
      self.renderUploadFiles();
    });
    this.fileList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-file]");
      if (!button) return;
      self.files.splice(Number(button.dataset.removeFile), 1);
      self.renderUploadFiles();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && self.open) self.close();
    });
  };

  ClueReport.prototype.exportState = function () {
    return {
      open: this.open,
      clues: this.clues.slice(),
      files: this.files.slice(),
      clueNo: this.noInput.value,
      clueName: this.nameInput.value,
      findings: this.findingsInput.value,
      guidance: this.guidanceInput.value
    };
  };

  ClueReport.prototype.importClues = function (items) {
    items.forEach((item) => this.pushClue(item));
    this.syncConclusion();
    this.render();
  };

  global.ClueReport = {
    create: function (options) {
      return new ClueReport(options);
    },
    mount: function (options) {
      return new ClueReport(Object.assign({ layout: "slide", parent: document.body }, options || {}));
    },
    buildCluesFromAlerts: buildCluesFromAlerts,
    renderProcessBodyHtml: renderProcessBodyHtml,
    renderAlertAttachHtml: renderAlertAttachHtml,
    groupCluesByProject: groupCluesByProject
  };
})(typeof window !== "undefined" ? window : globalThis);
