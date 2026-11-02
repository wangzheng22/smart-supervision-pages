(function (g) {
  function levelShort(level) {
    const text = String(level == null ? "" : level).trim();
    const map = { "高风险": "高", "中风险": "中", "低风险": "低", "高": "高", "中": "中", "低": "低" };
    if (map[text]) return map[text];
    if (/风险$/.test(text) && text.length > 1) return text.charAt(0);
    return text || "高";
  }
  function riskLevelLabel(level, levelFull) {
    if (levelFull) return String(levelFull).trim();
    const text = String(level || "").trim();
    if (text === "高" || text === "高风险") return "高风险";
    if (text === "中" || text === "中风险") return "中风险";
    if (text === "低" || text === "低风险") return "低风险";
    return text || "—";
  }
  function levelTone(level) {
    const text = String(level || "").trim();
    if (text === "低风险" || text === "低") return "low";
    if (text === "中风险" || text === "中") return "mid";
    return "high";
  }
  function normalizeWarnAlert(item) {
    if (!item || typeof item !== "object") return item;
    const levelFull = String(item.levelFull != null ? item.levelFull : item.level || "高风险").trim();
    return Object.assign({}, item, {
      levelFull: levelFull,
      level: levelShort(levelFull),
      tone: item.tone || levelTone(levelFull)
    });
  }
  function warnTopicKey(alert) {
    if (!alert) return "";
    const text = alert.topic || alert.warnType || alert.title || alert.point || "";
    return String(text).trim();
  }
  function mergeAlertSubjects(base, extra) {
    const set = new Set((base || []).concat(extra || []));
    return Array.from(set);
  }
  function pickStrongerAlert(a, b) {
    const rank = { high: 3, mid: 2, low: 1 };
    const ra = rank[levelTone(a.levelFull || a.level)] || 0;
    const rb = rank[levelTone(b.levelFull || b.level)] || 0;
    if (rb > ra) return b;
    return a;
  }
  function dedupeAlertsByTopic(alerts) {
    const seen = new Map();
    const out = [];
    (alerts || []).forEach((raw) => {
      const alert = raw;
      const key = warnTopicKey(alert) || ("__id:" + alert.id);
      if (!seen.has(key)) {
        const copy = Object.assign({}, alert);
        copy._mergedAlertIds = [alert.id];
        seen.set(key, copy);
        out.push(copy);
        return;
      }
      const kept = seen.get(key);
      kept._mergedAlertIds.push(alert.id);
      kept.subjects = mergeAlertSubjects(kept.subjects, alert.subjects);
      kept.whoNames = mergeAlertSubjects(kept.whoNames, alert.whoNames);
      const stronger = pickStrongerAlert(kept, alert);
      if (stronger !== kept) {
        Object.assign(kept, stronger, {
          subjects: kept.subjects,
          whoNames: kept.whoNames,
          _mergedAlertIds: kept._mergedAlertIds
        });
      }
    });
    return out;
  }
  g.RISK_COLOR = { high: "#f21818", mid: "#a639fd", low: "#fda939" };
  g.RISK_INK = { high: "#f21818", mid: "#a639fd", low: "#c88400" };
  g.riskHex = function (tone) {
    return g.RISK_COLOR[tone] || g.RISK_COLOR.high;
  };
  function warnEventSceneMeta(alert) {
    const title = String(alert.title || "");
    const model = String(alert.model || "");
    const hay = title + model + String(alert.note || "");
    if (/CA|经办人|联系人|手机号/.test(hay)) {
      return {
        code: "21-1",
        modelLabel: "场景21-1 投标人CA经办人相同",
        anomalyType: "围标串标",
        subType: "CA联系人相同",
        relation: "CA联系人相同 + 企业群组 + 共同投标",
        rule: "场景21-1 R1（共同投标公共规则）"
      };
    }
    if (/特征码|MAC|CPU|硬盘|设备/.test(hay)) {
      return {
        code: "18-2",
        modelLabel: "场景18-2 投标人特征码相同",
        anomalyType: "围标串标",
        subType: "设备特征码同源",
        relation: "投标设备特征 + 企业群组 + 共同投标",
        rule: "场景18-2 R1（特征码公共规则）"
      };
    }
    if (/报价|趋同|异常/.test(hay)) {
      return {
        code: "12-3",
        modelLabel: "场景12-3 投标报价异常趋同",
        anomalyType: "围标串标",
        subType: "报价异常趋同",
        relation: "报价分布 + 企业群组",
        rule: "场景12-3 R1"
      };
    }
    return {
      code: "00-0",
      modelLabel: model || "监管预警模型",
      anomalyType: alert.warnType || "程序异常",
      subType: title || "—",
      relation: "关系维度待补充",
      rule: "命中规则待补充"
    };
  }

  function parseAlertSteps(steps) {
    const indicators = [];
    const evidences = [];
    const judges = [];
    const narrative = [];
    (steps || []).forEach((step) => {
      const text = String(step || "").trim();
      if (!text) return;
      if (/^指标[：:]/.test(text)) indicators.push(text.replace(/^指标[：:]\s*/, ""));
      else if (/^证据[：:]/.test(text)) evidences.push(text.replace(/^证据[：:]\s*/, ""));
      else if (/^判定[：:]/.test(text)) judges.push(text.replace(/^判定[：:]\s*/, ""));
      else narrative.push(text);
    });
    return { indicators, evidences, judges, narrative };
  }

  function extractAlertProjectCode(alert, ctx) {
    if (ctx && ctx.projectCode) return String(ctx.projectCode).trim();
    const hay = [(alert && alert.note), (alert && alert.steps)].flat().filter(Boolean).join(" ");
    const hit = hay.match(/PRJ\d+|[A-Z]{2,}\d{3,}/);
    return hit ? hit[0] : "";
  }

  function formatSegmentLabel(alert, ctx) {
    const code = extractAlertProjectCode(alert, ctx);
    const name = (ctx && ctx.projectName) || "当前标段";
    if (code) return "标段 " + code + "（" + name + "）";
    return name;
  }

  function extractBidderRange(text) {
    const hit = String(text || "").match(/B\d+\s*[~～\-至]\s*B\d+/i);
    if (hit) return hit[0].replace(/\s/g, "");
    const list = String(text || "").match(/B\d+(?:[、,/]B\d+)+/i);
    return list ? list[0] : "";
  }

  function parseFeatureFingerprint(text) {
    const raw = String(text || "");
    const cpu = raw.match(/CPU[-\w]+/i);
    const disk = raw.match(/DISK[-\w]+/i);
    const mac = raw.match(/MAC[-\w]+/i);
    return {
      cpu: cpu ? cpu[0] : "",
      disk: disk ? disk[0] : "",
      mac: mac ? mac[0] : ""
    };
  }

  function renderFingerprintCompare(fp, escFn) {
    const rows = [
      { key: "CPU 序列号", val: fp.cpu },
      { key: "硬盘序列号", val: fp.disk },
      { key: "MAC 地址", val: fp.mac }
    ].filter((row) => row.val);
    if (!rows.length) return "";
    return (
      '<div class="catalog-fp-table" role="table" aria-label="设备特征码比对">' +
      rows.map((row) =>
        '<div class="catalog-fp-row" role="row">' +
        '<span class="catalog-fp-k" role="cell">' + escFn(row.key) + "</span>" +
        '<code class="catalog-fp-v" role="cell">' + escFn(row.val) + "</code>" +
        '<span class="catalog-fp-tag" role="cell" title="多家投标人一致">一致</span></div>'
      ).join("") +
      "</div>"
    );
  }

  function buildAnomalyDescHtml(alert, ctx, escFn) {
    if (alert.anomalyDescHtml) return alert.anomalyDescHtml;
    const segment = formatSegmentLabel(alert, ctx);
    const who = (alert.whoNames || []).join("、");
    const parsed = parseAlertSteps(alert.steps);
    const indicatorText = parsed.indicators.join("；");
    const hay = [alert.title, alert.note, indicatorText, parsed.narrative.join(" ")].join(" ");

    if (/CPU|MAC|DISK|硬盘|特征码|计价锁|加密锁/.test(hay)) {
      const fp = parseFeatureFingerprint(indicatorText);
      const bidders = extractBidderRange(indicatorText) || extractBidderRange(alert.who || "") || who || "相关投标人";
      let html = "<p>在<strong>" + escFn(segment) + "</strong>开标/解密环节，投标人 <strong>" + escFn(bidders) + "</strong> 上传文件经系统比对，";
      if (fp.cpu || fp.disk || fp.mac) {
        html += "下列设备特征码<strong>完全一致</strong>：</p>" + renderFingerprintCompare(fp, escFn);
      } else {
        html += escFn(indicatorText || alert.note || alert.title) + "。</p>";
      }
      if (parsed.judges.length) html += "<p class=\"catalog-event-sub\">判定规则：" + escFn(parsed.judges[0]) + "</p>";
      return html;
    }

    if (/CA|手机号|地址|经办|联系人/.test(hay)) {
      let html = "<p>在<strong>" + escFn(segment) + "</strong>，";
      if (who) html += "投标人 " + escFn(who) + " 等 ";
      html += "办理 CA 时出现相同信息：</p><ul class=\"catalog-event-list\">";
      (parsed.indicators.length ? parsed.indicators : [alert.note || alert.title]).forEach((line) => {
        html += "<li>" + escFn(line) + "</li>";
      });
      html += "</ul>";
      if (parsed.judges.length) html += "<p class=\"catalog-event-sub\">判定规则：" + escFn(parsed.judges[0]) + "</p>";
      return html;
    }

    let html = "<p>涉及 <strong>" + escFn(segment) + "</strong>。" + escFn(alert.note || alert.title || "—") + "</p>";
    if (parsed.indicators.length) {
      html += "<ul class=\"catalog-event-list\">" + parsed.indicators.map((line) => "<li>" + escFn(line) + "</li>").join("") + "</ul>";
    }
    return html;
  }

  function evidenceThumbTitle(part) {
    const text = String(part || "");
    if (/员工表/.test(text)) return "员工信息表截图";
    if (/投标记录/.test(text)) return "投标记录表截图";
    if (/解密|下载/.test(text)) return "开标签到截图";
    if (/评标/.test(text)) return "评标系统截图";
    if (/关系/.test(text)) return "关联关系截图";
    return "系统留痕截图";
  }

  function attachLeaf(name) {
    return { name: name };
  }
  function attachFolder(name, children) {
    return { name: name, children: children || [] };
  }
  function isAttachFolder(node) {
    return !!(node && node.name && Array.isArray(node.children));
  }
  function isAttachFileNode(node) {
    return !!(node && node.name && !isAttachFolder(node));
  }
  function normalizeAttachNode(node) {
    if (!node || !node.name) return null;
    if (Array.isArray(node.files) && node.files.length) {
      return {
        name: node.name,
        children: node.files.map(function (f) {
          return typeof f === "string" ? attachLeaf(f) : normalizeAttachNode(f);
        }).filter(Boolean)
      };
    }
    if (isAttachFolder(node)) {
      return {
        name: node.name,
        children: (node.children || []).map(normalizeAttachNode).filter(Boolean)
      };
    }
    return { name: node.name };
  }
  function normalizeAttachRoots(roots) {
    return (roots || []).map(normalizeAttachNode).filter(Boolean);
  }
  function alertSceneFlags(alert) {
    const hay = String(alert.title || "") + String(alert.note || "") + String(alert.model || "");
    return {
      ca: /CA|经办人|联系人|手机号/.test(hay),
      fp: /特征码|MAC|CPU|硬盘|设备/.test(hay),
      quote: /报价|趋同/.test(hay)
    };
  }
  function evidenceAttachmentNames(parsed) {
    const files = [];
    parsed.evidences.forEach((block) => {
      String(block).split(/[;；]/).map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (part) {
        if (/员工表/.test(part)) files.push("员工信息表截图.png");
        else if (/投标记录/.test(part)) files.push("投标记录表截图.png");
        else if (/解密|下载/.test(part)) files.push("开标签到截图.png");
        else if (/评标/.test(part)) files.push("评标系统截图.png");
        else files.push(String(part).slice(0, 36) + (part.length > 36 ? "…" : "") + ".png");
      });
    });
    return files;
  }
  function pruneAttachNode(node) {
    const norm = normalizeAttachNode(node);
    if (!norm) return null;
    if (isAttachFileNode(norm)) return norm;
    const children = (norm.children || []).map(pruneAttachNode).filter(Boolean);
    if (!children.length) return null;
    return { name: norm.name, children: children };
  }
  function collectAttachFileLeaves(roots, pathPrefix, out) {
    (roots || []).forEach(function (node) {
      const norm = normalizeAttachNode(node);
      if (!norm) return;
      if (isAttachFolder(norm)) {
        const next = pathPrefix ? pathPrefix + " / " + norm.name : norm.name;
        collectAttachFileLeaves(norm.children, next, out);
        return;
      }
      if (isAttachFileNode(norm)) {
        out.push({ name: norm.name, path: pathPrefix || "" });
      }
    });
  }
  function pruneAttachRoots(roots) {
    return (roots || []).map(pruneAttachNode).filter(Boolean);
  }
  function pruneAttachmentTrees(trees) {
    return (trees || []).map(function (tree) {
      const roots = pruneAttachRoots(tree.roots);
      if (!roots.length) return null;
      return { title: tree.title, roots: roots };
    }).filter(Boolean);
  }
  function buildBidderAttachmentRoots(name, code, flags) {
    const safe = String(name || "投标主体").replace(/[\\/:*?"<>|]/g, "_");
    const roots = [
      attachFolder("投标文件", [
        attachLeaf("投标文件_" + safe + ".pdf"),
        attachLeaf("工程量清单_" + code + ".xml"),
        attachLeaf("投标函.pdf")
      ])
    ];
    if (flags.ca) {
      roots.push(attachFolder("CA 与实名", [
        attachLeaf("CA办理回执.pdf"),
        attachLeaf("经办人授权书.pdf"),
        attachLeaf("手机号验证截图.png")
      ]));
    } else {
      roots.push(attachFolder("CA 与证书", [attachLeaf("数字证书信息.pdf")]));
    }
    if (flags.fp) {
      roots.push(attachFolder("设备特征留痕", [
        attachLeaf("造价软件特征码.txt"),
        attachLeaf("文件生成日志.log"),
        attachLeaf("硬盘序列号截图.png")
      ]));
    }
    return roots;
  }
  function buildRoleAttachmentRoots(role, name, code, flags, parsed) {
    if (role === "招标人") {
      return [
        attachFolder("立项与审批", [attachLeaf("立项批复.pdf"), attachLeaf("资金证明.pdf")]),
        attachFolder("招标组织", [attachLeaf("招标方案.docx"), attachLeaf("招标文件审定稿.pdf")])
      ];
    }
    if (role === "招标代理") {
      return [
        attachFolder("代理履职", [attachLeaf("代理合同.pdf"), attachLeaf("招标文件编制说明.docx")]),
        attachFolder("过程留痕", [attachLeaf("公告发布截图.png"), attachLeaf("开评标组织记录.pdf")])
      ];
    }
    if (role === "项目") {
      return [
        attachFolder("标段资料", [
          attachLeaf("标段概况_" + code + ".pdf"),
          attachLeaf("合同条款.docx")
        ]),
        attachFolder("过程归档", evidenceAttachmentNames(parsed).map(attachLeaf))
      ];
    }
    if (role === "投标企业" || role === "投标人") {
      return buildBidderAttachmentRoots(name, code, flags);
    }
    return [
      attachFolder("关联材料", (parsed.indicators.slice(0, 3).length ? parsed.indicators.slice(0, 3) : ["关联说明"]).map(function (t) {
        return attachLeaf(String(t).slice(0, 28) + ".pdf");
      })),
      attachFolder("证据归档", evidenceAttachmentNames(parsed).map(attachLeaf))
    ];
  }
  function buildAttachmentTreesData(alert, ctx) {
    if (alert.attachmentTrees && Array.isArray(alert.attachmentTrees) && alert.attachmentTrees.length) {
      return pruneAttachmentTrees(alert.attachmentTrees);
    }
    const parsed = parseAlertSteps(alert.steps);
    const flags = alertSceneFlags(alert);
    const code = extractAlertProjectCode(alert, ctx) || "PRJ001";
    const who = (alert.whoNames || []).slice(0, 4);
    const trees = [];
    const seen = new Set();
    function pushTree(key, title, roots) {
      if (seen.has(key)) return;
      seen.add(key);
      trees.push({ title: title, roots: normalizeAttachRoots(roots) });
    }
    const role = ctx && ctx.subjectRole;
    const sname = ctx && ctx.subjectName;
    const sid = ctx && ctx.subjectId;
    pushTree("tree:project", "对象 · 标段资料（" + code + "）", [
      attachFolder("招标与过程", [
        attachFolder("招标文件", [attachLeaf("招标公告.pdf"), attachLeaf("招标文件正文.docx"), attachLeaf("澄清答疑.pdf")]),
        attachFolder("开标评标", [attachLeaf("开标记录表.pdf"), attachLeaf("评标报告.pdf")])
      ]),
      attachFolder("证据归档", evidenceAttachmentNames(parsed).map(attachLeaf))
    ]);
    if (role && sname && !(role === "项目" && (sid === "project" || !sid))) {
      pushTree("tree:subject:" + sid + ":" + sname, "对象 · " + role + "（" + sname + "）",
        buildRoleAttachmentRoots(role, sname, code, flags, parsed));
    }
    who.forEach(function (name) {
      if (name === sname && (role === "投标企业" || role === "投标人")) return;
      pushTree("tree:bidder:" + name, "对象 · 投标企业（" + name + "）",
        buildBidderAttachmentRoots(name, code, flags));
    });
    return trees;
  }
  function escAttr(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }
  function renderAttachFileRow(file, escFn) {
    const name = file.name || "";
    const pathHint = file.path ? '<span class="catalog-attach-path">' + escFn(file.path) + "</span>" : "";
    return (
      '<li class="catalog-attach-leaf">' +
      '<div class="catalog-attach-row is-file" role="button" tabindex="0" data-attach-file="' + escAttr(name) + '">' +
      '<span class="catalog-attach-caret catalog-attach-caret--sp" aria-hidden="true"></span>' +
      '<span class="catalog-attach-icon file" aria-hidden="true"></span>' +
      '<span class="catalog-attach-label">' + escFn(name) + pathHint + "</span></div></li>"
    );
  }
  function renderAttachNode(node, escFn) {
    const pruned = pruneAttachNode(node);
    if (!pruned) return "";
    if (isAttachFolder(pruned)) {
      const childHtml = pruned.children.map(function (c) { return renderAttachNode(c, escFn); }).join("");
      if (!childHtml) return "";
      return (
        '<li class="catalog-attach-has-children">' +
        '<div class="catalog-attach-row is-folder">' +
        '<span class="catalog-attach-caret" aria-hidden="true">▾</span>' +
        '<span class="catalog-attach-icon folder" aria-hidden="true"></span>' +
        '<span class="catalog-attach-label">' + escFn(pruned.name) + "</span></div>" +
        "<ul>" + childHtml + "</ul></li>"
      );
    }
    return renderAttachFileRow({ name: pruned.name, path: "" }, escFn);
  }
  function mergeAttachRootLists(a, b) {
    const byName = new Map();
    function ingest(list) {
      (list || []).forEach(function (node) {
        if (!node || !node.name) return;
        if (!byName.has(node.name)) {
          byName.set(
            node.name,
            isAttachFolder(node)
              ? { name: node.name, children: (node.children || []).slice() }
              : { name: node.name }
          );
          return;
        }
        const existing = byName.get(node.name);
        if (isAttachFolder(node)) {
          if (!isAttachFolder(existing)) {
            byName.set(node.name, { name: node.name, children: (node.children || []).slice() });
            return;
          }
          existing.children = mergeAttachRootLists(existing.children, node.children || []);
        }
      });
    }
    ingest(a);
    ingest(b);
    return Array.from(byName.values());
  }
  function mergeAttachmentTreesFromAlerts(alerts, ctxFn) {
    const map = new Map();
    (alerts || []).forEach(function (alert) {
      if (!alert) return;
      const ctx = typeof ctxFn === "function" ? ctxFn(alert) : {};
      buildAttachmentTreesData(alert, ctx).forEach(function (tree) {
        const key = tree.title || "";
        if (!map.has(key)) {
          map.set(key, { title: tree.title, roots: (tree.roots || []).slice() });
          return;
        }
        const bucket = map.get(key);
        bucket.roots = mergeAttachRootLists(bucket.roots, tree.roots || []);
      });
    });
    return pruneAttachmentTrees(Array.from(map.values()));
  }
  function renderAttachmentForestHtmlFromTrees(trees, escFn) {
    const list = pruneAttachmentTrees(trees);
    if (!list.length) return "";
    return list.map(function (tree) {
      const prunedRoots = pruneAttachRoots(tree.roots);
      const files = [];
      collectAttachFileLeaves(prunedRoots, "", files);
      if (!files.length) return "";
      const items = files.map(function (file) { return renderAttachFileRow(file, escFn); }).join("");
      return (
        '<div class="catalog-attach-tree-block" data-attach-object="' + escAttr(tree.title) + '">' +
        '<div class="catalog-attach-tree-title">' + escFn(tree.title) + "</div>" +
        '<div class="catalog-attach-tree"><ul class="catalog-attach-file-list">' + items + "</ul></div></div>"
      );
    }).filter(Boolean).join("");
  }
  function buildWarnAttachmentForestInner(alert, ctx, escFn) {
    return renderAttachmentForestHtmlFromTrees(buildAttachmentTreesData(alert, ctx || {}), escFn);
  }
  function buildMergedWarnAttachmentForestHtml(alerts, ctxFn, escFn, opts) {
    const inner = renderAttachmentForestHtmlFromTrees(mergeAttachmentTreesFromAlerts(alerts, ctxFn), escFn);
    if (!inner) return "";
    if (opts && opts.innerOnly) {
      return (
        '<section class="catalog-attach-section" aria-label="预警附件">' +
        '<div class="catalog-attach-forest">' + inner + "</div></section>"
      );
    }
    return (
      '<section class="catalog-attach-section" aria-label="附件">' +
      '<h3 class="catalog-attach-heading">附件</h3>' +
      '<div class="catalog-attach-forest">' + inner + "</div></section>"
    );
  }
  function buildWarnAttachmentForestHtml(alert, ctx, escFn, opts) {
    const inner = buildWarnAttachmentForestInner(alert, ctx, escFn);
    if (!inner) return "";
    if (opts && opts.innerOnly) {
      return (
        '<section class="catalog-attach-section" aria-label="预警附件">' +
        '<div class="catalog-attach-forest">' + inner + "</div></section>"
      );
    }
    return (
      '<section class="catalog-attach-section" aria-label="附件">' +
      '<h3 class="catalog-attach-heading">附件</h3>' +
      '<div class="catalog-attach-forest">' + inner + "</div></section>"
    );
  }

  function buildEvidenceSnapshotHtml(alert, ctx, escFn) {
    if (alert.evidenceSnapshotHtml) return alert.evidenceSnapshotHtml;
    const parsed = parseAlertSteps(alert.steps);
    const cards = [];
    parsed.evidences.forEach((block) => {
      String(block).split(/[;；]/).map((s) => s.trim()).filter(Boolean).forEach((part) => {
        cards.push({ title: evidenceThumbTitle(part), caption: part });
      });
    });
    if (!cards.length) {
      const fallback = [alert.note, parsed.indicators[0], parsed.narrative[0]].filter(Boolean)[0] || "暂无结构化证据";
      cards.push({ title: "预警分析摘录", caption: fallback });
    }
    const segment = formatSegmentLabel(alert, ctx);
    return (
      '<div class="catalog-evidence-stack">' +
      cards.map((card, index) =>
        '<figure class="catalog-evidence-item">' +
        '<div class="catalog-evidence-thumb" aria-hidden="true">' +
        '<span class="catalog-evidence-thumb-tag">' + escFn(card.title) + "</span>" +
        '<span class="catalog-evidence-thumb-meta">' + escFn(segment) + "</span></div>" +
        '<figcaption><b>记录 ' + (index + 1) + "</b> · " + escFn(card.caption) + "</figcaption></figure>"
      ).join("") +
      "</div>"
    );
  }

  function warnEventDetailFields(alert, ctx, escFn) {
    const esc = escFn || function (text) { return String(text == null ? "" : text); };
    const meta = warnEventSceneMeta(alert);
    const dateTag = (ctx && ctx.dateTag) || String((ctx && ctx.projectDate) || "").replace(/-/g, "") || "20260101";
    const seq = String(alert.id || "001").split("-").pop() || "001";
    const eventNo = alert.eventNo || (meta.code + "-" + dateTag + "-" + seq);
    const anomalyType = alert.anomalyType || (meta.anomalyType + (meta.subType ? "（子类型：" + meta.subType + "）" : ""));
    const generatedAt = alert.generatedAt || (ctx && ctx.generatedAt) ||
      ((ctx && ctx.projectDate) ? ctx.projectDate + " 14:32:08" : "—");
    return {
      eventNo: eventNo,
      supervisoryModel: alert.supervisoryModel || meta.modelLabel,
      anomalyType: anomalyType,
      warningLevel: riskLevelLabel(alert.level, alert.levelFull),
      anomalyDescHtml: buildAnomalyDescHtml(alert, ctx, esc),
      generatedAt: generatedAt,
      evidenceSnapshotHtml: buildEvidenceSnapshotHtml(alert, ctx, esc)
    };
  }

  function renderWarnEventDetailPanel(alert, ctx, helpers) {
    const escFn = (helpers && helpers.esc) || function (text) { return String(text == null ? "" : text); };
    const fields = warnEventDetailFields(alert, ctx || {}, escFn);
    const tone = levelTone(alert.levelFull || alert.level);
    const dealMeta = helpers && helpers.dealMarkHtml ? helpers.dealMarkHtml(alert.id) : "";
    const actions = helpers && helpers.actionsHtml ? helpers.actionsHtml(alert) : "";
    return (
      '<div class="catalog-detail-head"><h2>' + escFn(alert.title || "风险预警事件") + '</h2><div class="catalog-detail-meta">' +
      '<span class="sev ' + tone + '">' + escFn(riskLevelLabel(alert.level, alert.levelFull)) + "</span>" + dealMeta + "</div></div>" +
      '<dl class="catalog-facts catalog-event-facts">' +
      "<dt>预警事件编号</dt><dd>" + escFn(fields.eventNo) + "</dd>" +
      "<dt>监管模型</dt><dd>" + escFn(fields.supervisoryModel) + "</dd>" +
      "<dt>异常类型</dt><dd>" + escFn(fields.anomalyType) + "</dd>" +
      '<dt>预警级别</dt><dd><span class="catalog-event-level tag ' + tone + '">' + escFn(fields.warningLevel) + "</span></dd>" +
      '<dt>异常说明</dt><dd class="catalog-event-anomaly">' + fields.anomalyDescHtml + "</dd>" +
      "<dt>生成时间</dt><dd>" + escFn(fields.generatedAt) + "</dd>" +
      '<dt>证据快照</dt><dd class="catalog-event-evidence">' + fields.evidenceSnapshotHtml + "</dd>" +
      "</dl>" +
      buildWarnAttachmentForestHtml(alert, ctx, escFn) +
      actions
    );
  }

  g.riskLevelLabel = riskLevelLabel;
  g.levelShort = levelShort;
  g.levelTone = levelTone;
  g.normalizeWarnAlert = normalizeWarnAlert;
  g.warnTopicKey = warnTopicKey;
  g.dedupeAlertsByTopic = dedupeAlertsByTopic;
  g.warnEventDetailFields = warnEventDetailFields;
  g.renderWarnEventDetailPanel = renderWarnEventDetailPanel;
  g.buildWarnAttachmentForestHtml = buildWarnAttachmentForestHtml;
  g.buildMergedWarnAttachmentForestHtml = buildMergedWarnAttachmentForestHtml;
  g.mergeAttachmentTreesFromAlerts = mergeAttachmentTreesFromAlerts;
})(typeof window !== "undefined" ? window : globalThis);
