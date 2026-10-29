(function (global) {
  function esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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
    '<section class="report-meta" aria-label="线索基本信息"><div class="pair">' +
    '<div class="field"><label class="lab" for="cr-reportClueNo">线索编号</label><input id="cr-reportClueNo" class="clue-field-input" type="text" autocomplete="off" readonly /></div>' +
    '<div class="field"><label class="lab" for="cr-reportClueName">线索名称</label><div class="clue-name-row">' +
    '<input id="cr-reportClueName" class="clue-field-input" type="text" maxlength="80" autocomplete="off" readonly />' +
    '<div class="clue-pick-wrap"><button class="clue-pick-btn" type="button" data-cr-pick aria-label="从待移交线索中选择">' +
    '<img src="assets/icon-clue-directory.png" width="18" height="18" alt="" /></button>' +
    '<span class="clue-pick-tip" role="tooltip" hidden>点击可选已有线索</span></div></div></div></div></section>' +
    '<section class="report-conclusion" id="cr-reportConclusionBox"><h3>描述及AI查办指引</h3>' +
    '<textarea id="cr-reportConclusion" aria-label="描述及AI查办指引" placeholder="暂未能自动总结原因，请输入描述及查办指引"></textarea>' +
    '<button class="report-grip" type="button" data-cr-grip aria-label="调整结论区域高度"></button></section>' +
    '<div class="report-body"><section class="report-process">' +
    '<div class="process-head"><h3>分析过程<b data-cr-count>0</b></h3>' +
    '<button class="fold-all" type="button" data-cr-fold-all><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6.2l5 4.6 5-4.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>全部展开</span></button></div>' +
    '<div class="process-body" data-cr-process></div></section>' +
    '<section class="report-files"><h3>附件</h3><label class="attach-pick">上传附件<input type="file" data-cr-files multiple accept=".pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.avi,.mp3,.wav,.zip,.txt,.csv,.html,.htm" /></label>' +
    '<p class="hint">可一次选择多个文件，也能继续追加</p><ul class="file-list" data-cr-file-list></ul></section></div>' +
    '<div class="report-bar"><div class="report-handoff-meta"><span class="report-handoff-lab">线索状态</span>' +
    '<span class="report-handoff-pill st-move" data-cr-handoff>待移交</span></div>' +
    '<button class="report-handoff-btn" type="button" data-cr-handoff-btn>移交</button></div></aside>';

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
    this.userEdited = false;
    this.clueSeq = 1;
    this.typeGen = 0;
    this.handoff = "待移交";
    this.handoffDept = "";
    this.handoffHandle = "";
    this.activeRow = null;
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
    } else {
      this.host = document.createElement("div");
      this.host.className = "clue-report-host " + layout;
      this.host.innerHTML = DRAWER_HTML;
      parent.appendChild(this.host);
      if (!document.querySelector("[data-cr-pick-dialog]")) {
        document.body.insertAdjacentHTML("beforeend", PICK_DIALOG_HTML);
      }
    }
    this.drawer = this.host.querySelector(".clue-report-drawer");
    this.$ = (sel) => this.host.querySelector(sel);
    this.noInput = this.$("#cr-reportClueNo");
    this.nameInput = this.$("#cr-reportClueName");
    this.conclusion = this.$("#cr-reportConclusion");
    this.conclusionBox = this.$("#cr-reportConclusionBox");
    this.processBody = this.host.querySelector("[data-cr-process]");
    this.processCount = this.host.querySelector("[data-cr-count]");
    this.fileList = this.host.querySelector("[data-cr-file-list]");
    this.fileInput = this.host.querySelector("[data-cr-files]");
    this.handoffEl = this.host.querySelector("[data-cr-handoff]");
    this.handoffBtn = this.host.querySelector("[data-cr-handoff-btn]");
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
      level: item.level || "线索",
      title: item.title || "预警线索",
      note: item.note || "",
      whoNames: (item.whoNames || []).slice(),
      model: item.model || "",
      steps: (item.steps || []).slice(),
      open: item.open !== false
    });
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
    this.ensureClueForRow(row);
    this.applyRowClueMeta(row);
    if (!row.clueNo) this.syncRowClueMeta(row);
    this.generated = "";
    this.openDrawer();
    this.syncConclusion();
    this.render();
  };

  ClueReport.prototype.addFromWarningRow = function (row) {
    if (!row) return;
    this.activeRow = row;
    const id = this.warningRowId(row);
    if (this.clues.some((c) => c.alertId === id)) {
      this.applyRowClueMeta(row);
      this.openDrawer();
      this.render();
      return;
    }
    this.handoff = "待移交";
    this.handoffDept = "";
    this.handoffHandle = "";
    row.handoff = "待移交";
    this.ensureClueForRow(row);
    this.ensureClueMeta();
    this.syncRowClueMeta(row);
    this.generated = "";
    this.openDrawer();
    this.syncConclusion();
    this.render();
  };

  ClueReport.prototype.renderHandoffBar = function () {
    if (!this.handoffEl || !this.handoffBtn) return;
    const handoff = this.handoff || "待移交";
    this.handoffEl.textContent = handoff;
    this.handoffEl.className = "report-handoff-pill " + this.handoffTone(handoff);
    const pending = handoff === "待移交";
    this.handoffBtn.disabled = !pending;
    this.handoffBtn.hidden = !pending;
  };

  ClueReport.prototype.canSummarize = function (item) {
    return !!(item && (item.note || item.model || (item.steps && item.steps.length)));
  };

  ClueReport.prototype.autoConclusion = function () {
    const ready = this.clues.filter((item) => this.canSummarize(item));
    if (!ready.length) return "";
    const names = [];
    ready.forEach((item) => item.whoNames.forEach((name) => { if (!names.includes(name)) names.push(name); }));
    const lines = ready.map((item, index) => (index + 1) + ". " + item.whoNames.join("与") + "：" + item.title + "。" + item.note);
    return "围绕" + names.join("、") + "，本次归集 " + ready.length + " 条预警线索。\n" + lines.join("\n") + "\n综合上述情形，相关交易存在需核查的异常关联，建议责任部门结合关系图与模型分析过程开展核查。";
  };

  ClueReport.prototype.typewrite = function (text) {
    const gen = ++this.typeGen;
    this.conclusion.value = "";
    let index = 0;
    const timer = window.setInterval(() => {
      if (gen !== this.typeGen) {
        window.clearInterval(timer);
        return;
      }
      index = Math.min(text.length, index + 1);
      this.conclusion.value = text.slice(0, index);
      this.conclusion.scrollTop = this.conclusion.scrollHeight;
      if (index >= text.length) window.clearInterval(timer);
    }, 32);
  };

  ClueReport.prototype.syncConclusion = function () {
    const text = this.autoConclusion();
    if (!text) {
      this.typeGen += 1;
      if (!this.userEdited) this.conclusion.value = "";
      return;
    }
    this.userEdited = false;
    if (!this.open) {
      this.typeGen += 1;
      this.conclusion.value = text;
      return;
    }
    this.typewrite(text);
  };

  ClueReport.prototype.renderAttach = function () {
    this.fileList.innerHTML = this.files.map((file, index) =>
      '<li><span title="' + esc(file.name) + '">' + esc(file.name) + '</span><button type="button" data-remove-file="' + index + '">删除</button></li>'
    ).join("");
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
    if (!this.clues.length) {
      this.processBody.innerHTML = '<p class="process-empty">尚未添加线索</p>';
      return;
    }
    this.processBody.innerHTML = this.clues.map((item) => {
      const tone = item.level === "中风险" ? " mid" : item.level === "低风险" ? " low" : "";
      const folded = item.open ? "" : " is-folded";
      const steps = (item.steps || []).map((step) => "<li>" + esc(step) + "</li>").join("");
      const analysis = item.model
        ? '<p class="clue-line"><em>分析</em>' + esc(item.model) + "</p>"
        : "";
      return '<article class="clue-item' + tone + folded + '"><div class="clue-top"><span class="sev">' + esc(item.level) +
        "</span><strong>" + esc(item.title) + '</strong><button type="button" class="clue-del" data-remove-clue="' + esc(item.uid) +
        '">删除</button></div><p class="clue-line"><em>涉及主体</em>' + esc(item.whoNames.join("、")) +
        '</p><p class="clue-line"><em>事项</em>' + esc(item.note || "待补充原因") + "</p>" + analysis + "</article>";
    }).join("");
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
    lines.push(this.conclusion.value || this.autoConclusion());
    lines.push("", "分析过程");
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
      const button = event.target.closest("[data-remove-clue]");
      if (!button) return;
      self.clues = self.clues.filter((item) => item.uid !== button.dataset.removeClue);
      self.generated = "";
      self.syncConclusion();
      self.render();
    });
    this.handoffBtn.addEventListener("click", () => {
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
        }
      });
    });
    this.conclusion.addEventListener("input", () => { self.typeGen += 1; self.userEdited = true; });
    const grip = this.host.querySelector("[data-cr-grip]");
    grip.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const startY = event.clientY;
      const startH = self.conclusionBox.getBoundingClientRect().height;
      const max = Math.max(160, self.drawer.clientHeight - 180);
      function move(nextEvent) {
        const next = Math.min(max, Math.max(128, startH + nextEvent.clientY - startY));
        self.conclusionBox.style.height = next + "px";
      }
      function end() {
        grip.removeEventListener("pointermove", move);
        grip.removeEventListener("pointerup", end);
        grip.removeEventListener("pointercancel", end);
      }
      grip.setPointerCapture(event.pointerId);
      grip.addEventListener("pointermove", move);
      grip.addEventListener("pointerup", end);
      grip.addEventListener("pointercancel", end);
    });
    this.fileInput.addEventListener("change", () => {
      [...self.fileInput.files].forEach((file) => {
        const same = self.files.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified);
        if (!same) self.files.push(file);
      });
      self.fileInput.value = "";
      self.renderAttach();
    });
    this.fileList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-file]");
      if (!button) return;
      self.files.splice(Number(button.dataset.removeFile), 1);
      self.renderAttach();
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
      conclusion: this.conclusion.value
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
    }
  };
})(window);
