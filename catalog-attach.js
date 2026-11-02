(function (g) {
  var viewerDialog = null;

  function escapeHtml(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(text) {
    return escapeHtml(text);
  }

  function fileExt(name) {
    const hit = /\.([^.]+)$/i.exec(String(name || ""));
    return hit ? hit[1].toLowerCase() : "";
  }

  function fileKind(name) {
    const ext = fileExt(name);
    if (/^(png|jpe?g|gif|webp)$/.test(ext)) return "image";
    if (ext === "pdf") return "pdf";
    if (/^(xlsx?|csv|xml)$/.test(ext)) return "sheet";
    if (/^(docx?|txt|log)$/.test(ext)) return "doc";
    return "file";
  }

  function resolvePreviewUrl(fileName) {
    const ext = fileExt(fileName);
    const text = String(fileName || "");
    if (ext === "pdf") {
      return "assets/demo-tender-electronic-2023.pdf";
    }
    if (/^(png|jpe?g|gif|webp)$/.test(ext)) {
      if (/员工/.test(text)) return "assets/warn-card-staff.png";
      if (/代理|公告/.test(text)) return "assets/warn-card-agency.png";
      if (/专家|评标/.test(text)) return "assets/warn-card-expert.png";
      if (/招标人|业主|立项/.test(text)) return "assets/warn-card-owner.png";
      if (/投标|CA|手机号|硬盘|序列号|特征/.test(text)) return "assets/warn-card-bidder.png";
      return "assets/warn-card-project.png";
    }
    return "";
  }

  function fileTypeLabel(kind, ext) {
    if (kind === "image") return "图片 · " + (ext || "png").toUpperCase();
    if (kind === "pdf") return "PDF 文档";
    if (kind === "sheet") return "表格 / 结构化数据 · " + (ext || "").toUpperCase();
    if (kind === "doc") return "文本 / 说明文档";
    return "附件";
  }

  function mockFileMeta(name) {
    const text = String(name || "");
    if (fileExt(name) === "pdf" && /招标|澄清|公告|审定|投标|开标|评标|合同|方案|CA|证书|授权|记录/.test(text)) {
      return {
        size: "8.8 MB",
        updated: "2026-01-12 09:18:42",
        source: "电子交易系统归档"
      };
    }
    const seed = text.split("").reduce(function (acc, ch) { return acc + ch.charCodeAt(0); }, 0);
    const kb = 180 + (seed % 4200);
    const size = kb > 1024 ? (kb / 1024).toFixed(1) + " MB" : kb + " KB";
    const day = 10 + (seed % 18);
    return {
      size: size,
      updated: "2026-01-" + String(day).padStart(2, "0") + " 14:" + String(10 + (seed % 40)).padStart(2, "0") + ":08",
      source: "电子交易系统归档"
    };
  }

  function fileDescription(name) {
    const text = String(name || "");
    if (/截图|png|jpg|jpeg|webp/i.test(text)) return "系统界面或业务表单截屏，用于佐证预警命中时的留痕状态。";
    if (/CA|证书|手机号|授权/.test(text)) return "CA 办理、实名核验或授权链条材料，可与经办人、联系方式等指标交叉印证。";
    if (/投标/.test(text)) return "该标段电子投标文件归档副本，含签章与时间戳信息。";
    if (/招标|澄清|公告/.test(text)) return "招标过程公开文件，用于核对程序合规与版本一致性。";
    if (/特征|日志|序列号|MAC|CPU/.test(text)) return "设备或软件特征相关留痕，支撑特征码同源类模型判定。";
    if (/开标|评标|记录/.test(text)) return "开评标过程记录，便于回溯时间节点与参与主体。";
    return "与当前预警关联的业务附件，演示环境为模拟归档数据。";
  }

  function buildMetaOnlyHtml(fileName, objectTitle) {
    const kind = fileKind(fileName);
    const meta = mockFileMeta(fileName);
    const typeLabel = fileTypeLabel(kind, fileExt(fileName));
    return (
      '<div class="catalog-attach-dialog-meta">' +
      '<dl class="catalog-attach-dialog-facts">' +
      "<dt>所属对象</dt><dd>" + escapeHtml(objectTitle || "—") + "</dd>" +
      "<dt>文件类型</dt><dd>" + escapeHtml(typeLabel) + "</dd>" +
      "<dt>文件大小</dt><dd>" + escapeHtml(meta.size) + "</dd>" +
      "<dt>更新时间</dt><dd>" + escapeHtml(meta.updated) + "</dd>" +
      "<dt>来源</dt><dd>" + escapeHtml(meta.source) + "</dd>" +
      "<dt>说明</dt><dd>" + escapeHtml(fileDescription(fileName)) + "</dd>" +
      "</dl>" +
      '<p class="catalog-attach-dialog-empty">演示环境暂不支持该格式在线预览，可对接真实附件服务后在此嵌入。</p></div>'
    );
  }

  function ensureViewerDialog() {
    if (viewerDialog) return viewerDialog;
    viewerDialog = document.createElement("dialog");
    viewerDialog.className = "catalog-attach-dialog";
    viewerDialog.id = "catalogAttachViewer";
    viewerDialog.setAttribute("aria-labelledby", "catalogAttachViewerTitle");
    viewerDialog.innerHTML =
      '<div class="catalog-attach-dialog-panel">' +
      '<header class="catalog-attach-dialog-head">' +
      '<h2 id="catalogAttachViewerTitle"></h2>' +
      '<div class="catalog-attach-dialog-actions">' +
      '<a class="catalog-attach-dialog-open" id="catalogAttachViewerOpen" href="#" target="_blank" rel="noopener" aria-label="新窗口打开" title="新窗口打开">' +
      '<img src="assets/icon-open-new-window.png?v=1" width="16" height="16" alt="" decoding="async" /></a>' +
      '<button type="button" class="catalog-attach-dialog-x" aria-label="关闭">×</button>' +
      "</div></header>" +
      '<div class="catalog-attach-dialog-body" id="catalogAttachViewerBody"></div>' +
      "</div>";
    document.body.appendChild(viewerDialog);
    function closeViewer() {
      const body = viewerDialog.querySelector("#catalogAttachViewerBody");
      if (body) body.innerHTML = "";
      viewerDialog.close();
    }
    viewerDialog.querySelector(".catalog-attach-dialog-x").addEventListener("click", closeViewer);
    viewerDialog.addEventListener("click", function (event) {
      if (event.target === viewerDialog) closeViewer();
    });
    viewerDialog.addEventListener("cancel", function (event) {
      event.preventDefault();
      closeViewer();
    });
    return viewerDialog;
  }

  function openFilePreview(fileName, objectTitle) {
    const kind = fileKind(fileName);
    const previewUrl = resolvePreviewUrl(fileName);
    const dlg = ensureViewerDialog();
    const title = dlg.querySelector("#catalogAttachViewerTitle");
    const body = dlg.querySelector("#catalogAttachViewerBody");
    const openLink = dlg.querySelector("#catalogAttachViewerOpen");
    if (title) title.textContent = fileName;
    if (!body) return;

    if (previewUrl && kind === "pdf") {
      body.className = "catalog-attach-dialog-body is-pdf";
      body.innerHTML =
        '<iframe class="catalog-attach-dialog-frame" src="' +
        escapeAttr(previewUrl) +
        '#toolbar=1&navpanes=0" title="' +
        escapeAttr(fileName) +
        '"></iframe>';
      if (openLink) {
        openLink.href = previewUrl;
        openLink.hidden = false;
      }
    } else if (previewUrl && kind === "image") {
      body.className = "catalog-attach-dialog-body is-image";
      body.innerHTML =
        '<img class="catalog-attach-dialog-img" src="' +
        escapeAttr(previewUrl) +
        '" alt="' +
        escapeAttr(fileName) +
        '" decoding="async" />';
      if (openLink) {
        openLink.href = previewUrl;
        openLink.hidden = false;
      }
    } else {
      body.className = "catalog-attach-dialog-body is-meta";
      body.innerHTML = buildMetaOnlyHtml(fileName, objectTitle);
      if (openLink) openLink.hidden = true;
    }

    if (typeof dlg.showModal === "function") dlg.showModal();
  }

  function onFileActivate(section, row) {
    if (!section || !row) return;
    const fileName = row.getAttribute("data-attach-file") || "";
    const block = row.closest(".catalog-attach-tree-block");
    const objectTitle = (block && block.getAttribute("data-attach-object")) || "";
    section.querySelectorAll(".catalog-attach-row.is-selected").forEach(function (el) {
      el.classList.remove("is-selected");
      el.setAttribute("aria-pressed", "false");
    });
    row.classList.add("is-selected");
    row.setAttribute("aria-pressed", "true");
    openFilePreview(fileName, objectTitle);
  }

  function bindSection(section) {
    if (!section || section.dataset.attachBound === "1") return;
    section.dataset.attachBound = "1";
    section.addEventListener("click", function (event) {
      const row = event.target.closest(".catalog-attach-row.is-file");
      if (!row || !section.contains(row)) return;
      onFileActivate(section, row);
    });
    section.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      const row = event.target.closest(".catalog-attach-row.is-file");
      if (!row || !section.contains(row)) return;
      event.preventDefault();
      onFileActivate(section, row);
    });
  }

  function bindRoot(root) {
    if (!root) return;
    root.querySelectorAll(".catalog-attach-section").forEach(bindSection);
  }

  g.CatalogAttach = {
    bindRoot: bindRoot,
    openFilePreview: openFilePreview,
    resolvePreviewUrl: resolvePreviewUrl
  };
})(typeof window !== "undefined" ? window : globalThis);
