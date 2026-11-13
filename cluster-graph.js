/* 按需增量漫游图谱
 * 渲染用 G6。收拢态不预建 combo。
 * 点击时向 GraphAPI 要一阶邻居，当场生成 combo。
 * 已在画布上的节点不进入力模拟，坐标只从模型回写，避免漂移。
 *
 * 两种簇：
 * - 重心为项目：点击项目，项目自己进入新簇。标段连在项目上，投标人连在所属标段上；代理、招标人、专家、工作人员仍连项目。
 * - 重心为实体：点击投标人等枢纽，实体留在原簇，新出现的项目围着它形成另一个簇，连过去的边是跨簇长边。
 */
(function () {
  const page = window.ClusterPage;
  const stage = page && page.stage;
  const api = window.GraphAPI;
  if (!stage || !api) return;

  const FORCES = {
    comboStrength: -800,
    comboCollideStrength: 1,
    /* 引力只负责把新邻居拢向被点的重心，不再把整圈压扁。 */
    clusterGravity: 6,
    nodeStrength: -120,
    nodeCollideStrength: 0.8,
    /* 项目簇：标段、招标人、代理、专家、工作人员绕项目；投标人再向外连到所属标段。 */
    innerEdge: { distance: 200, strength: 0.35 },
    sectionBidder: { distance: 156, strength: 0.7 },
    innerNodeGap: 72,
    crossEdge: { distance: 140, strength: 0.2 },
    /* 从代理等节点加入的项目：先按这个距离散开，展开后再按簇的实际大小推开。 */
    projectRing: { distance: 320, strength: 0.6 },
    alphaDecay: 0.0228,
    alphaMin: 0.001,
    localTickMax: 120,
    comboChargeDistanceMax: 420
  };
  const RENDERER = "canvas";
  const VISIBLE_LIMIT = { svg: 500, canvas: 3000, webgl: 8000 };
  const SESSION_KEY = "analysis-roam-open-v11";
  const KIND = {
    project: { fill: "#f5a623", size: 52, mark: "项", role: "项目" },
    section: { fill: "#e25b78", size: 36, mark: "标", role: "标段" },
    bidder: { fill: "#3d8bfd", size: 36, mark: "投", role: "投标人" },
    agency: { fill: "#2fbe74", size: 36, mark: "代", role: "代理" },
    owner: { fill: "#12a3b0", size: 36, mark: "招", role: "招标人" },
    expert: { fill: "#8b6cf6", size: 36, mark: "专", role: "专家" },
    staff: { fill: "#c9842a", size: 36, mark: "工", role: "工作人员" },
    aggregate: { fill: "#8aa0b8", size: 40, mark: "簇", role: "聚合" }
  };

  const byId = {};
  const edges = [];
  const branches = [];
  const expanded = {};
  const holdProjects = {};
  let graph = null;
  let selectedId = "";
  let bidOn = false;
  let cameraDrag = false;
  let busy = false;
  let job = 0;
  let lodTimer = 0;
  let menuTarget = "";
  const history = [];

  function kindOf(kind) {
    return KIND[kind] || KIND.section;
  }

  function projectSize(amount) {
    const value = Number(amount) || 0;
    if (value <= 0) return KIND.project.size;
    const diameter = 60 * Math.sqrt(value / 100000000);
    return Math.round(Math.max(40, Math.min(88, diameter)));
  }

  function nodeSize(raw, visual) {
    if (raw && raw.kind === "project") return projectSize(raw.amount);
    return visual.size;
  }

  function lodOf(zoom) {
    if (zoom <= 0.3) return 0;
    if (zoom <= 0.7) return 1;
    if (zoom <= 1.2) return 2;
    return 3;
  }

  function zoomNow() {
    return graph && graph.getZoom ? graph.getZoom() : 1;
  }

  function font() {
    return "PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei, sans-serif";
  }

  function toast(text) {
    const el = document.getElementById("graphToast");
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 2400);
  }

  function branchById(id) {
    return branches.find((item) => item.id === id);
  }

  function branchOfNode(id) {
    return branches.find((item) => item.state === "open" && item.nodeIds.indexOf(id) >= 0);
  }

  function descendants(branch) {
    const own = new Set(branch.nodeIds);
    const out = [];
    let grew = true;
    while (grew) {
      grew = false;
      branches.forEach((item) => {
        if (item === branch || out.indexOf(item) >= 0 || item.state === "removed") return;
        if (own.has(item.sourceId)) {
          out.push(item);
          item.nodeIds.forEach((nid) => own.add(nid));
          grew = true;
        }
      });
    }
    return out;
  }

  /* ---------- LOD ---------- */
  function memberWanted(node, lod) {
    if (!node || node.hidden) return false;
    if (node.kind === "aggregate") return true;
    if (!node.branchId) return true;
    const branch = branchById(node.branchId);
    if (!branch || branch.state !== "open") return false;
    if (lod <= 1) return false;
    return true;
  }

  function inViewport(x, y) {
    if (!graph || !graph.getViewportByCanvas) return true;
    const point = graph.getViewportByCanvas([x, y]);
    const pad = 80;
    return point[0] >= -pad && point[1] >= -pad && point[0] <= stage.clientWidth + pad && point[1] <= stage.clientHeight + pad;
  }

  function labelOn(node, lod, zoom) {
    if (!memberWanted(node, lod)) return false;
    if (lod >= 3) return true;
    if (lod === 2) return node.size * zoom >= 28;
    return false;
  }

  function visibleCount() {
    const lod = lodOf(zoomNow());
    let count = 0;
    Object.keys(byId).forEach((id) => {
      const node = byId[id];
      if (memberWanted(node, lod) && inViewport(node.x, node.y)) count += 1;
    });
    return count;
  }

  function labelPlacementOf(node) {
    const branch = node && branchById(node.branchId);
    const source = branch && byId[branch.sourceId];
    if (!source || source.id === node.id) return "bottom";
    const dx = node.x - source.x;
    const dy = node.y - source.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
    return dy > 0 ? "bottom" : "top";
  }

  function sectionWon(node) {
    if (!node || node.kind !== "bidder" || !node.winSection) return false;
    return edges.some((edge) => edge.target === node.id && edge.source === node.winSection && byId[edge.source]);
  }

  function nodeStyle(node, lod, zoom) {
    const visible = memberWanted(node, lod) && inViewport(node.x, node.y);
    const showText = labelOn(node, lod, zoom);
    const style = {
      x: node.x,
      y: node.y,
      size: node.size,
      fill: node.fill,
      stroke: node.kind === "project" ? "#e09010" : "transparent",
      lineWidth: node.kind === "project" ? 2 : 0,
      visibility: visible ? "visible" : "hidden",
      cursor: "pointer",
      zIndex: 2,
      iconText: node.mark,
      iconFill: "#fff",
      iconFontSize: node.kind === "project" ? Math.max(16, Math.min(24, Math.round(node.size * 0.32))) : 14,
      iconFontFamily: font(),
      labelText: showText ? node.name : "",
      labelFill: "#3d4e64",
      labelFontSize: 12,
      labelFontFamily: font(),
      labelPlacement: labelPlacementOf(node),
      labelMaxWidth: node.kind === "project" ? 108 : 84,
      labelWordWrap: true,
      labelMaxLines: 2,
      labelBackground: !!showText,
      labelBackgroundFill: "#f2f4f7",
      labelPadding: [1, 3]
    };
    const badges = [];
    const warnRing = { high: "#F21818", mid: "#A639FD", low: "#FDA939" }[node.warn];
    if (warnRing) {
      const ring = Math.max(16, node.size - 3);
      badges.push({
        text: " ",
        placement: "center",
        fontSize: 1,
        fill: "transparent",
        padding: 0,
        backgroundFill: "transparent",
        backgroundStroke: warnRing,
        backgroundLineWidth: 3,
        backgroundRadius: "50%",
        backgroundWidth: ring,
        backgroundHeight: ring
      });
    }
    if (sectionWon(node)) {
      badges.push({
        text: "中",
        placement: "right-top",
        fontSize: 10,
        fontWeight: 650,
        fontFamily: font(),
        fill: "#fff",
        padding: [3, 3, 3, 3],
        backgroundFill: "#f5222d",
        backgroundRadius: "50%"
      });
    }
    if (lod >= 3) {
      badges.push({
        text: node.role,
        placement: sectionWon(node) ? "right" : "right-top",
        fontSize: 10,
        fill: "#5c6b80",
        backgroundFill: "#fff",
        padding: [1, 4]
      });
    }
    style.badge = badges.length > 0;
    style.badges = badges;
    return style;
  }

  function hullOf(branch, lod) {
    const source = byId[branch.sourceId];
    const count = branch.nodeIds.length;
    if (!source || branch.state !== "open") return null;
    if (lod === 0) return { x: source.x, y: source.y, size: 36, label: String(count), open: false };
    let radius = 46;
    branch.nodeIds.forEach((id) => {
      const node = byId[id];
      if (!node) return;
      radius = Math.max(radius, Math.hypot(node.x - source.x, node.y - source.y) + node.size / 2 + 18);
    });
    const open = lod >= 2;
    return {
      x: source.x,
      y: source.y,
      size: radius * 2,
      label: open ? "" : source.name,
      open: open
    };
  }

  function comboStyle(branch, lod) {
    const hull = hullOf(branch, lod);
    if (!hull) return { visibility: "hidden" };
    const projectCenter = branch.centerKind === "project";
    return {
      x: hull.x,
      y: hull.y,
      size: hull.size,
      fill: hull.open ? (projectCenter ? "rgba(245,166,35,0.08)" : "rgba(47,120,246,0.05)") : "#fff",
      stroke: hull.open ? "#d5deea" : "#e3e8ef",
      lineWidth: 1,
      visibility: inViewport(hull.x, hull.y) ? "visible" : "hidden",
      cursor: "pointer",
      zIndex: 0,
      labelText: hull.label,
      labelFill: "#24364c",
      labelFontSize: lod === 0 ? 12 : 13,
      labelFontFamily: font(),
      labelPlacement: "bottom",
      labelMaxWidth: 140,
      labelWordWrap: true,
      labelBackground: !!hull.label,
      labelBackgroundFill: "#f2f4f7"
    };
  }

  function edgeVisible(edge, lod) {
    const source = byId[edge.source];
    const target = byId[edge.target];
    if (!source || !target) return false;
    if (lod === 2 && edge.weight < 0.5) return false;
    if (lod <= 1 && edge.scope === "inner") return false;
    return memberWanted(source, lod) && memberWanted(target, lod) && inViewport(source.x, source.y) && inViewport(target.x, target.y);
  }

  function edgeStyle(edge, lod) {
    const cross = edge.scope === "cross";
    return {
      stroke: cross ? "#7e9fd4" : "#8eb6f2",
      lineWidth: cross ? 1.5 : 1.5,
      opacity: cross ? 0.45 : 1,
      visibility: edgeVisible(edge, lod) ? "visible" : "hidden",
      zIndex: 1
    };
  }

  function statesOf(node) {
    const states = [];
    if (node.id === selectedId) states.push("selected");
    if (bidOn && node.kind === "bidder") states.push("bid");
    return states;
  }

  function syncView() {
    if (!graph) return;
    const lod = lodOf(zoomNow());
    const zoom = zoomNow();
    const nodeData = Object.keys(byId).map((id) => {
      const node = byId[id];
      return { id: id, combo: node.comboId || undefined, style: nodeStyle(node, lod, zoom) };
    });
    if (nodeData.length) graph.updateNodeData(nodeData);
    const comboData = branches.filter((item) => item.state === "open" && item.comboId).map((item) => ({
      id: item.comboId,
      style: comboStyle(item, lod)
    }));
    try {
      if (comboData.length) graph.updateComboData(comboData);
      if (edges.length) {
        graph.updateEdgeData(edges.map((edge) => ({ id: edge.id, style: edgeStyle(edge, lod) })));
      }
      Object.keys(byId).forEach((id) => graph.setElementState(id, statesOf(byId[id])));
      graph.draw();
    } catch (err) {
      toast(err && err.message ? err.message : "图谱刷新失败");
    }
    const path = document.getElementById("graphPath");
    if (path) {
      const names = history.map((id) => {
        const branch = branchById(id);
        const source = branch && byId[branch.sourceId];
        return source ? source.name : "";
      }).filter(Boolean);
      path.textContent = names.length ? names.join(" → ") : "初始项目";
    }
  }

  function scheduleLod() {
    clearTimeout(lodTimer);
    lodTimer = setTimeout(() => {
      if (cameraDrag) return;
      syncView();
    }, 200);
  }

  /* ---------- 局部布局：只移动 newcomers ---------- */
  function obstacles(exceptComboId) {
    return branches.filter((item) => item.state === "open" && item.comboId !== exceptComboId).map((item) => {
      const hull = hullOf(item, 3);
      return hull ? { x: hull.x, y: hull.y, r: hull.size / 2 } : null;
    }).filter(Boolean);
  }

  function bindAnchors(source, newcomers, linkMode) {
    const groups = {};
    newcomers.forEach((node) => {
      node.anchorId = source.id;
      node.anchorDistance = linkMode.distance;
      node.anchorStrength = linkMode.strength;
      if (node.kind !== "bidder") return;
      const edge = edges.find((item) => item.target === node.id && byId[item.source] && byId[item.source].kind === "section");
      if (!edge) return;
      node.anchorId = edge.source;
      node.anchorDistance = FORCES.sectionBidder.distance;
      node.anchorStrength = FORCES.sectionBidder.strength;
      if (!groups[edge.source]) groups[edge.source] = [];
      groups[edge.source].push(node);
    });
    Object.keys(groups).forEach((key) => {
      groups[key].forEach((node, index) => {
        node.slot = index;
        node.slotCount = groups[key].length;
      });
    });
    const projects = newcomers.filter((node) => node.kind === "project");
    projects.forEach((node, index) => {
      node.slot = index;
      node.slotCount = projects.length;
    });
  }

  /* 投标人沿「项目 → 标段」的朝外方向散开，不绕回项目内侧。 */
  function bidderSeat(node, source) {
    const section = byId[node.anchorId];
    if (!section || node.kind !== "bidder" || section.kind !== "section") return null;
    const outward = Math.atan2(section.y - source.y, section.x - source.x);
    const count = node.slotCount || 1;
    const index = node.slot || 0;
    const step = count <= 1 ? 0 : Math.min(0.72, 1.45 / (count - 1));
    const angle = outward + (count === 1 ? 0.42 : (index - (count - 1) / 2) * step);
    const dist = FORCES.sectionBidder.distance;
    return {
      x: section.x + Math.cos(angle) * dist,
      y: section.y + Math.sin(angle) * dist
    };
  }

  /* 待加入的项目顺着代理朝外的方向散开，彼此留出以后展开的空档。 */
  function projectSeat(node, source) {
    const count = node.slotCount || 1;
    const index = node.slot || 0;
    const root = byId.project;
    let outward = 0;
    if (root && root.id !== source.id) {
      outward = Math.atan2(source.y - root.y, source.x - root.x);
    }
    const span = Math.min(2.4, Math.max(0.85, (count - 1) * 0.95));
    const step = count <= 1 ? 0 : span / (count - 1);
    const angle = outward + (index - (count - 1) / 2) * step;
    const dist = FORCES.projectRing.distance;
    return {
      x: source.x + Math.cos(angle) * dist,
      y: source.y + Math.sin(angle) * dist
    };
  }

  function ringRadius(linkMode) {
    const gain = FORCES.clusterGravity / 100;
    return linkMode.distance * linkMode.strength / (linkMode.strength + gain);
  }

  function seed(source, newcomers, obs, linkMode) {
    if (linkMode === FORCES.projectRing) {
      newcomers.forEach((node) => {
        const seat = projectSeat(node, source);
        node.x = seat.x;
        node.y = seat.y;
        node.vx = 0;
        node.vy = 0;
      });
      return;
    }
    if (linkMode === FORCES.innerEdge) {
      const radius = ringRadius(linkMode);
      const ring = newcomers.filter((node) => node.kind !== "bidder");
      ring.forEach((node, index) => {
        const angle = -Math.PI / 2 + (index / Math.max(ring.length, 1)) * Math.PI * 2;
        node.x = source.x + Math.cos(angle) * radius;
        node.y = source.y + Math.sin(angle) * radius;
        node.vx = 0;
        node.vy = 0;
      });
      const grouped = {};
      newcomers.filter((node) => node.kind === "bidder").forEach((node) => {
        const key = node.anchorId || source.id;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(node);
      });
      Object.keys(grouped).forEach((key) => {
        const group = grouped[key];
        group.forEach((node) => {
          const seat = bidderSeat(node, source);
          if (!seat) return;
          node.x = seat.x;
          node.y = seat.y;
          node.vx = 0;
          node.vy = 0;
        });
      });
      return;
    }
    let vx = 1;
    let vy = 0;
    if (obs.length) {
      vx = 0;
      vy = 0;
      obs.forEach((item) => {
        const dx = source.x - item.x;
        const dy = source.y - item.y;
        const dist = Math.hypot(dx, dy) || 1;
        vx += dx / dist;
        vy += dy / dist;
      });
      if (!vx && !vy) vx = 1;
    }
    const base = Math.atan2(vy, vx);
    const span = Math.min(Math.PI * 1.15, Math.max(0.4, newcomers.length * 0.28));
    const own = branchOfNode(source.id);
    const outside = own ? hullOf(own, 3).size / 2 + 36 : 96;
    newcomers.forEach((node, index) => {
      const angle = base + (index - (newcomers.length - 1) / 2) * (newcomers.length === 1 ? 0 : span / newcomers.length);
      node.x = source.x + Math.cos(angle) * outside;
      node.y = source.y + Math.sin(angle) * outside;
      node.vx = 0;
      node.vy = 0;
    });
  }

  function stepForce(source, newcomers, linkMode, obs, alpha) {
    const dist = linkMode.distance;
    const spring = linkMode.strength;
    const gain = FORCES.clusterGravity / 100;
    newcomers.forEach((node) => {
      node.vx = (node.vx || 0) * 0.6;
      node.vy = (node.vy || 0) * 0.6;
    });
    for (let i = 0; i < newcomers.length; i += 1) {
      for (let j = i + 1; j < newcomers.length; j += 1) {
        const a = newcomers[i];
        const b = newcomers[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        const d = Math.sqrt(d2) || 1;
        const repel = FORCES.nodeStrength * alpha / Math.max(d2, 16);
        a.vx -= dx / d * repel;
        a.vy -= dy / d * repel;
        b.vx += dx / d * repel;
        b.vy += dy / d * repel;
      }
    }
    newcomers.forEach((node) => {
      const seat = node.kind === "bidder" ? bidderSeat(node, source)
        : (linkMode === FORCES.projectRing && node.kind === "project" ? projectSeat(node, source) : null);
      if (seat) {
        const springN = node.anchorStrength == null ? spring : node.anchorStrength;
        node.vx += (seat.x - node.x) * springN * alpha;
        node.vy += (seat.y - node.y) * springN * alpha;
      } else {
        const anchor = byId[node.anchorId] || source;
        const distN = node.anchorDistance || dist;
        const springN = node.anchorStrength == null ? spring : node.anchorStrength;
        node.vx += (anchor.x - node.x) * gain * alpha;
        node.vy += (anchor.y - node.y) * gain * alpha;
        const dx = anchor.x - node.x;
        const dy = anchor.y - node.y;
        const d = Math.hypot(dx, dy) || 1;
        const pull = (d - distN) * springN * alpha;
        node.vx += dx / d * pull;
        node.vy += dy / d * pull;
      }
      obs.forEach((item) => {
        const ox = node.x - item.x;
        const oy = node.y - item.y;
        const od = Math.hypot(ox, oy) || 1;
        const min = item.r + node.size / 2 + 26;
        if (od < min) {
          const push = (min - od) * FORCES.comboCollideStrength;
          node.vx += ox / od * push;
          node.vy += oy / od * push;
        } else if (od < FORCES.comboChargeDistanceMax) {
          const repel = FORCES.comboStrength * alpha / (od * od);
          node.vx -= ox / od * repel;
          node.vy -= oy / od * repel;
        }
      });
      node.x += node.vx;
      node.y += node.vy;
    });
    // 位置修正：collideStrength 0.8 表示每拍消掉 80% 重叠。重心节点不参与位移。
    for (let pass = 0; pass < 2; pass += 1) {
      for (let i = 0; i < newcomers.length; i += 1) {
        for (let j = i + 1; j < newcomers.length; j += 1) {
          const a = newcomers[i];
          const b = newcomers[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy) || 1;
          const gap = linkMode === FORCES.innerEdge ? FORCES.innerNodeGap : 8;
          const min = (a.size + b.size) / 2 + gap;
          if (d >= min) continue;
          const shift = (min - d) / d * FORCES.nodeCollideStrength * 0.5;
          a.x += dx * shift;
          a.y += dy * shift;
          b.x -= dx * shift;
          b.y -= dy * shift;
        }
      }
      newcomers.forEach((node) => {
        const dx = node.x - source.x;
        const dy = node.y - source.y;
        const d = Math.hypot(dx, dy) || 1;
        const min = (node.size + source.size) / 2 + 10;
        if (d >= min) return;
        const shift = (min - d) / d * FORCES.nodeCollideStrength;
        node.x += dx * shift;
        node.y += dy * shift;
      });
    }
    newcomers.forEach((node) => {
      const seat = node.kind === "bidder" ? bidderSeat(node, source)
        : (linkMode === FORCES.projectRing && node.kind === "project" ? projectSeat(node, source) : null);
      if (!seat) return;
      const pull = node.kind === "project" ? 0.85 : 0.72;
      node.x += (seat.x - node.x) * pull;
      node.y += (seat.y - node.y) * pull;
    });
  }

  async function layoutNewcomers(source, newcomers, linkMode, comboId) {
    const token = job;
    const frozen = Object.keys(byId).filter((id) => newcomers.indexOf(byId[id]) < 0).map((id) => ({
      id: id, x: byId[id].x, y: byId[id].y
    }));
    const obs = obstacles(comboId);
    bindAnchors(source, newcomers, linkMode);
    seed(source, newcomers, obs, linkMode);
    let alpha = 1;
    let ticks = 0;
    while (ticks < FORCES.localTickMax && alpha > FORCES.alphaMin) {
      if (cameraDrag || token !== job) break;
      const batch = Math.min(20, FORCES.localTickMax - ticks);
      for (let i = 0; i < batch; i += 1) {
        stepForce(source, newcomers, linkMode, obs, alpha);
        alpha *= 1 - FORCES.alphaDecay;
        ticks += 1;
      }
      frozen.forEach((item) => {
        byId[item.id].x = item.x;
        byId[item.id].y = item.y;
      });
      const kept = frozen.find((item) => item.id === source.id);
      if (kept) {
        source.x = kept.x;
        source.y = kept.y;
      }
      graph.updateNodeData(newcomers.map((node) => ({ id: node.id, style: { x: node.x, y: node.y } })));
      const branch = branches.find((item) => item.comboId === comboId);
      if (branch) graph.updateComboData([{ id: comboId, style: comboStyle(branch, Math.max(lodOf(zoomNow()), 2)) }]);
      graph.draw();
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
    frozen.forEach((item) => {
      byId[item.id].x = item.x;
      byId[item.id].y = item.y;
    });
  }

  function relateComboCombined(inner) {
    if (!window.G6 || !window.G6.ComboCombinedLayout) return null;
    return new window.G6.ComboCombinedLayout({
      nodeSize: 36,
      comboPadding: 18,
      layout: (comboId) => {
        if (comboId || inner) {
          return {
            type: "d3-force",
            nodeStrength: FORCES.nodeStrength,
            preventOverlap: true,
            collideStrength: FORCES.nodeCollideStrength,
            linkDistance: FORCES.innerEdge.distance,
            edgeStrength: FORCES.innerEdge.strength,
            alphaDecay: FORCES.alphaDecay,
            alphaMin: FORCES.alphaMin,
            center: false
          };
        }
        return {
          type: "d3-force",
          nodeStrength: FORCES.comboStrength,
          manyBody: { strength: FORCES.comboStrength, distanceMax: FORCES.comboChargeDistanceMax },
          preventOverlap: true,
          collideStrength: FORCES.comboCollideStrength,
          linkDistance: FORCES.crossEdge.distance,
          edgeStrength: FORCES.crossEdge.strength,
          alphaDecay: FORCES.alphaDecay,
          alphaMin: FORCES.alphaMin,
          center: false
        };
      }
    });
  }

  /* ---------- 动态 combo ---------- */
  function adopt(raw, branchId, comboId) {
    const visual = kindOf(raw.kind);
    const node = {
      id: raw.id,
      kind: raw.kind,
      name: raw.name,
      fields: raw.fields || [],
      role: visual.role,
      mark: visual.mark,
      fill: visual.fill,
      size: nodeSize(raw, visual),
      warn: raw.warn || "",
      winSection: raw.winSection || "",
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      branchId: branchId,
      comboId: comboId,
      hidden: false
    };
    byId[node.id] = node;
    return node;
  }

  function clusterReach(node) {
    let body = node.size / 2 + 36;
    let tip = body;
    const seen = new Set([node.id]);
    const stack = [node.id];
    while (stack.length) {
      const id = stack.pop();
      branches.forEach((branch) => {
        if (branch.state !== "open" || branch.sourceId !== id) return;
        branch.nodeIds.forEach((nid) => {
          const child = byId[nid];
          if (!child || seen.has(nid) || child.kind === "project") return;
          seen.add(nid);
          stack.push(nid);
          const far = Math.hypot(child.x - node.x, child.y - node.y) + child.size / 2 + 24;
          if (child.kind === "bidder") tip = Math.max(tip, far);
          else body = Math.max(body, far);
        });
      });
    }
    return body + Math.max(0, tip - body) * 0.4;
  }

  function moveCluster(node, dx, dy) {
    if (!dx && !dy) return;
    const seen = new Set([node.id]);
    const stack = [node.id];
    while (stack.length) {
      const id = stack.pop();
      const current = byId[id];
      if (current) {
        current.x += dx;
        current.y += dy;
      }
      branches.forEach((branch) => {
        if (branch.state !== "open" || branch.sourceId !== id) return;
        branch.nodeIds.forEach((nid) => {
          const child = byId[nid];
          if (!child || seen.has(nid) || child.kind === "project") return;
          seen.add(nid);
          stack.push(nid);
        });
      });
    }
  }

  /* 项目展开后按各自簇的大小推开，避免圈和圈叠在一起。初始项目留在原地。 */
  function separateProjectClusters(focus) {
    const others = Object.keys(byId).map((id) => byId[id]).filter((node) => node && node.kind === "project" && node.id !== focus.id);
    const gap = 56;
    for (let pass = 0; pass < 6; pass += 1) {
      others.forEach((other) => {
        const dx = focus.x - other.x;
        const dy = focus.y - other.y;
        const dist = Math.hypot(dx, dy) || 1;
        const need = clusterReach(focus) + clusterReach(other) + gap;
        if (dist >= need) return;
        const push = need - dist;
        const ux = dx / dist;
        const uy = dy / dist;
        if (other.id === "project") moveCluster(focus, ux * push, uy * push);
        else if (focus.id === "project") moveCluster(other, -ux * push, -uy * push);
        else {
          moveCluster(focus, ux * push * 0.5, uy * push * 0.5);
          moveCluster(other, -ux * push * 0.5, -uy * push * 0.5);
        }
      });
    }
  }

  async function expand(sourceId) {
    if (busy || expanded[sourceId] || holdProjects[sourceId]) return;
    const source = byId[sourceId];
    if (!source || source.kind === "aggregate") return;
    const lod = lodOf(zoomNow());
    const room = VISIBLE_LIMIT[RENDERER] - visibleCount();
    if (room <= 0) {
      toast("当前图谱实体较多，请先收起部分分支再继续探查");
      return;
    }
    busy = true;
    let pack;
    try {
      pack = await api.fetchNeighbors(sourceId);
    } catch (err) {
      busy = false;
      toast("关联没有取到");
      return;
    }
    const incoming = source.kind === "project"
      ? (pack.nodes || [])
      : (pack.nodes || []).filter((item) => item.kind !== "project");
    const withheld = source.kind !== "project" && (pack.nodes || []).some((item) => item.kind === "project");
    const fresh = incoming.filter((item) => !byId[item.id]);
    const known = incoming.filter((item) => byId[item.id]);
    if (!fresh.length && !known.length) {
      busy = false;
      if (withheld) {
        holdProjects[sourceId] = true;
        return;
      }
      expanded[sourceId] = true;
      toast("没有新的一阶关联");
      saveSession();
      return;
    }
    if (!fresh.length) {
      (pack.edges || []).forEach((item) => {
        if (!byId[item.source] || !byId[item.target]) return;
        if (edges.some((edge) => edge.source === item.source && edge.target === item.target)) return;
        const edge = {
          id: "e-" + item.source + "-" + item.target,
          source: item.source,
          target: item.target,
          weight: item.weight || 0.9,
          scope: "cross",
          branchId: ""
        };
        edges.push(edge);
        graph.addEdgeData([{ id: edge.id, source: edge.source, target: edge.target, style: edgeStyle(edge, lod) }]);
      });
      expanded[sourceId] = true;
      busy = false;
      saveSession();
      syncView();
      return;
    }
    if (fresh.length > room) {
      busy = false;
      toast("当前图谱实体较多，请先收起部分分支再继续探查");
      return;
    }
    const projectCenter = source.kind === "project";
    const branchId = "b-" + sourceId + "-" + branches.length;
    const comboId = fresh.length ? "c-" + branchId : "";
    const linkMode = projectCenter ? FORCES.innerEdge : FORCES.crossEdge;
    const scope = projectCenter ? "inner" : "cross";
    if (comboId && window.G6) {
      relateComboCombined(projectCenter);
      graph.addComboData([{ id: comboId, data: { center: sourceId }, style: { x: source.x, y: source.y, zIndex: 0 } }]);
    }
    const created = fresh.map((item) => adopt(item, branchId, projectCenter ? comboId : comboId));
    if (projectCenter && comboId) source.comboId = comboId;
    const branch = {
      id: branchId,
      sourceId: sourceId,
      comboId: comboId,
      centerKind: projectCenter ? "project" : "entity",
      nodeIds: created.map((item) => item.id),
      edgeIds: [],
      state: "open",
      snapshot: null
    };
    branches.push(branch);
    history.push(branchId);
    if (created.length) {
      graph.addNodeData(created.map((node) => ({
        id: node.id,
        combo: comboId || undefined,
        data: { kind: node.kind, name: node.name },
        style: nodeStyle(node, Math.max(lod, 2), zoomNow())
      })));
    }
    (pack.edges || []).forEach((item) => {
      if (!byId[item.source] || !byId[item.target]) return;
      if (edges.some((edge) => edge.source === item.source && edge.target === item.target)) return;
      const edge = {
        id: "e-" + item.source + "-" + item.target,
        source: item.source,
        target: item.target,
        weight: item.weight || 0.9,
        scope: byId[item.target].comboId && byId[item.target].comboId === source.comboId ? "inner" : scope,
        branchId: branchId
      };
      edges.push(edge);
      branch.edgeIds.push(edge.id);
      graph.addEdgeData([{
        id: edge.id,
        source: edge.source,
        target: edge.target,
        style: edgeStyle(edge, Math.max(lod, 2))
      }]);
    });
    if (projectCenter && comboId) {
      graph.updateNodeData([{ id: source.id, combo: comboId }]);
    }
    expanded[sourceId] = true;
    graph.draw();
    try {
      if (created.length) await layoutNewcomers(source, created, linkMode, comboId);
      if (projectCenter) separateProjectClusters(source);
    } catch (err) {
      toast(err && err.message ? err.message : "局部布局失败");
    }
    branch.snapshot = created.map((node) => ({ id: node.id, x: node.x, y: node.y }));
    busy = false;
    saveSession();
    syncView();
  }

  /* ---------- 收起 ---------- */
  function removeNodes(ids) {
    const set = new Set(ids);
    const edgeIds = edges.filter((edge) => set.has(edge.source) || set.has(edge.target)).map((edge) => edge.id);
    for (let i = edges.length - 1; i >= 0; i -= 1) {
      if (edgeIds.indexOf(edges[i].id) >= 0) edges.splice(i, 1);
    }
    ids.forEach((id) => {
      delete expanded[id];
      delete byId[id];
    });
    if (edgeIds.length) graph.removeEdgeData(edgeIds);
    if (ids.length) graph.removeNodeData(ids);
  }

  function dropBranch(branch, mode) {
    if (!branch || branch.state === "removed") return;
    const kids = descendants(branch);
    kids.slice().reverse().forEach((item) => dropBranch(item, "remove"));
    const ids = branch.nodeIds.filter((id) => byId[id]);
    if (branch.comboId) {
      const source = byId[branch.sourceId];
      if (source && source.comboId === branch.comboId) source.comboId = "";
      try { graph.removeComboData([branch.comboId]); } catch (err) { /* 簇已经不在画布上 */ }
      branch.comboId = "";
    }
    if (mode === "aggregate" && ids.length) {
      const source = byId[branch.sourceId];
      removeNodes(ids);
      const visual = kindOf("aggregate");
      const agg = {
        id: "agg-" + branch.id,
        kind: "aggregate",
        name: (source ? source.name : "分支") + " 的关联 " + ids.length,
        fields: [["说明", "已聚合 " + ids.length + " 个关联节点"], ["来源", source ? source.name : ""]],
        role: visual.role,
        mark: visual.mark,
        fill: visual.fill,
        size: visual.size,
        x: source ? source.x + 72 : 0,
        y: source ? source.y + 36 : 0,
        branchId: branch.id,
        comboId: "",
        hidden: false,
        aggregateBranch: branch.id
      };
      byId[agg.id] = agg;
      branch.aggregateId = agg.id;
      branch.state = "aggregate";
      graph.addNodeData([{ id: agg.id, data: { kind: "aggregate" }, style: nodeStyle(agg, lodOf(zoomNow()), zoomNow()) }]);
      if (source) {
        const edge = {
          id: "e-agg-" + branch.id,
          source: source.id,
          target: agg.id,
          weight: 0.9,
          scope: "cross",
          branchId: branch.id
        };
        edges.push(edge);
        graph.addEdgeData([{ id: edge.id, source: edge.source, target: edge.target, style: edgeStyle(edge, lodOf(zoomNow())) }]);
      }
    } else {
      removeNodes(ids);
      branch.state = "removed";
      branch.nodeIds = [];
    }
    const at = history.indexOf(branch.id);
    if (at >= 0) history.splice(at, 1);
    delete expanded[branch.sourceId];
  }

  function collapseSelected(mode) {
    let branch = null;
    if (byId[selectedId]) {
      branch = branches.find((item) => item.state === "open" && item.sourceId === selectedId);
    }
    if (!branch) branch = branchOfNode(selectedId) || branchById(selectedId);
    if (!branch || branch.state !== "open") {
      toast("请先选中一个已展开的分支");
      return;
    }
    job += 1;
    dropBranch(branch, mode || "aggregate");
    if (byId[branch.sourceId]) selectedId = branch.sourceId;
    saveSession();
    syncView();
  }

  async function reopenAggregate(node) {
    const branch = branchById(node.aggregateBranch || node.branchId);
    if (!branch || !branch.snapshot) return;
    busy = true;
    if (byId[node.id]) {
      removeNodes([node.id]);
    }
    branch.aggregateId = "";
    branch.state = "open";
    branch.comboId = "c-" + branch.id;
    graph.addComboData([{ id: branch.comboId, style: { x: byId[branch.sourceId].x, y: byId[branch.sourceId].y, zIndex: 0 } }]);
    const source = byId[branch.sourceId];
    branch.snapshot.forEach((item) => {
      const raw = api.getNode(item.id);
      if (!raw || byId[item.id]) return;
      const created = adopt(raw, branch.id, branch.centerKind === "project" ? branch.comboId : branch.comboId);
      created.x = item.x;
      created.y = item.y;
      if (branch.nodeIds.indexOf(created.id) < 0) branch.nodeIds.push(created.id);
      graph.addNodeData([{ id: created.id, combo: branch.comboId, style: nodeStyle(created, 3, 1) }]);
    });
    if (branch.centerKind === "project" && source) {
      source.comboId = branch.comboId;
      graph.updateNodeData([{ id: source.id, combo: branch.comboId }]);
    }
    (branch.edgeIds || []).forEach((id) => {
      /* 边已在收起时删除，重新按快照连回重心 */
    });
    branch.nodeIds.forEach((id) => {
      const edgeId = "e-" + branch.sourceId + "-" + id;
      if (edges.some((edge) => edge.id === edgeId)) return;
      const edge = {
        id: edgeId,
        source: branch.sourceId,
        target: id,
        weight: 0.9,
        scope: branch.centerKind === "project" ? "inner" : "cross",
        branchId: branch.id
      };
      edges.push(edge);
      graph.addEdgeData([{ id: edge.id, source: edge.source, target: edge.target, style: edgeStyle(edge, 3) }]);
    });
    expanded[branch.sourceId] = true;
    if (history.indexOf(branch.id) < 0) history.push(branch.id);
    busy = false;
    saveSession();
    syncView();
  }

  function resetGraph() {
    job += 1;
    busy = false;
    const ids = Object.keys(byId);
    const edgeIds = edges.map((edge) => edge.id);
    const comboIds = branches.map((item) => item.comboId).filter(Boolean);
    if (edgeIds.length) graph.removeEdgeData(edgeIds);
    if (ids.length) graph.removeNodeData(ids);
    if (comboIds.length) graph.removeComboData(comboIds);
    edges.splice(0, edges.length);
    branches.splice(0, branches.length);
    history.splice(0, history.length);
    Object.keys(byId).forEach((id) => delete byId[id]);
    Object.keys(expanded).forEach((id) => delete expanded[id]);
    selectedId = "";
    putStart();
    expand("project");
  }

  function clearGraph() {
    job += 1;
    const ids = Object.keys(byId);
    const edgeIds = edges.map((edge) => edge.id);
    const comboIds = branches.map((item) => item.comboId).filter(Boolean);
    if (edgeIds.length) graph.removeEdgeData(edgeIds);
    if (ids.length) graph.removeNodeData(ids);
    if (comboIds.length) graph.removeComboData(comboIds);
    edges.splice(0, edges.length);
    branches.splice(0, branches.length);
    history.splice(0, history.length);
    Object.keys(byId).forEach((id) => delete byId[id]);
    Object.keys(expanded).forEach((id) => delete expanded[id]);
    selectedId = "";
    try { sessionStorage.removeItem(SESSION_KEY); } catch (err) { /* 忽略 */ }
    graph.draw();
    const path = document.getElementById("graphPath");
    if (path) path.textContent = "画布已清空";
    toast("画布已清空");
  }

  function putStart() {
    const raw = api.getNode("project");
    const visual = kindOf("project");
    const node = {
      id: raw.id,
      kind: raw.kind,
      name: raw.name,
      fields: raw.fields,
      role: visual.role,
      mark: visual.mark,
      fill: visual.fill,
      size: nodeSize(raw, visual),
      warn: raw.warn || "",
      x: stage.clientWidth / 2 || 480,
      y: stage.clientHeight / 2 || 320,
      branchId: "",
      comboId: "",
      hidden: false
    };
    byId[node.id] = node;
    selectedId = node.id;
    graph.addNodeData([{ id: node.id, data: { kind: node.kind, name: node.name }, style: nodeStyle(node, 3, 1) }]);
    graph.draw();
    centerOn(node.id);
    page.showNode(node.id, node);
  }

  function centerOn(id) {
    if (!graph.getViewportByCanvas || !graph.translateBy) return;
    const node = byId[id];
    if (!node) return;
    const point = graph.getViewportByCanvas([node.x, node.y]);
    if (graph.translateBy) graph.translateBy([stage.clientWidth / 2 - point[0], stage.clientHeight / 2 - point[1]]);
  }

  function saveSession() {
    try {
      const nodes = Object.keys(byId).map((id) => {
        const node = byId[id];
        return { id: id, x: node.x, y: node.y, comboId: node.comboId || "", branchId: node.branchId || "", kind: node.kind, aggregateBranch: node.aggregateBranch || "" };
      });
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        nodes: nodes,
        edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, weight: edge.weight, scope: edge.scope, branchId: edge.branchId })),
        branches: branches.map((item) => ({
          id: item.id,
          sourceId: item.sourceId,
          comboId: item.comboId,
          centerKind: item.centerKind,
          nodeIds: item.nodeIds,
          edgeIds: item.edgeIds,
          state: item.state,
          aggregateId: item.aggregateId || "",
          snapshot: item.snapshot || []
        })),
        history: history.slice(),
        expanded: expanded,
        selectedId: selectedId
      }));
    } catch (err) { /* 会话不可用时忽略 */ }
  }

  function restore(data) {
    (data.branches || []).forEach((item) => branches.push({
      id: item.id,
      sourceId: item.sourceId,
      comboId: item.comboId,
      centerKind: item.centerKind,
      nodeIds: item.nodeIds || [],
      edgeIds: item.edgeIds || [],
      state: item.state,
      aggregateId: item.aggregateId || "",
      snapshot: item.snapshot || []
    }));
    (data.history || []).forEach((id) => history.push(id));
    Object.keys(data.expanded || {}).forEach((id) => { expanded[id] = true; });
    const openCombos = {};
    branches.forEach((item) => { if (item.comboId && item.state === "open") openCombos[item.comboId] = true; });
    graph.addComboData(Object.keys(openCombos).map((id) => ({ id: id, style: { zIndex: 0 } })));
    (data.nodes || []).forEach((item) => {
      const raw = item.kind === "aggregate" ? {
        id: item.id,
        kind: "aggregate",
        name: "已聚合分支",
        fields: [["说明", "从上次会话恢复的聚合节点"]]
      } : api.getNode(item.id);
      if (!raw) return;
      const visual = kindOf(raw.kind);
      byId[item.id] = {
        id: item.id,
        kind: raw.kind,
        name: raw.name,
        fields: raw.fields || [],
        role: visual.role,
        mark: visual.mark,
        fill: visual.fill,
        size: nodeSize(raw, visual),
        warn: raw.warn || "",
        winSection: raw.winSection || "",
        x: item.x,
        y: item.y,
        branchId: item.branchId || "",
        comboId: item.comboId && openCombos[item.comboId] ? item.comboId : "",
        hidden: false,
        aggregateBranch: item.aggregateBranch || ""
      };
    });
    graph.addNodeData(Object.keys(byId).map((id) => {
      const node = byId[id];
      return { id: id, combo: node.comboId || undefined, data: { kind: node.kind }, style: nodeStyle(node, 3, 1) };
    }));
    (data.edges || []).forEach((item) => {
      if (!byId[item.source] || !byId[item.target]) return;
      edges.push(item);
    });
    if (edges.length) {
      graph.addEdgeData(edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, style: edgeStyle(edge, 3) })));
    }
    selectedId = data.selectedId && byId[data.selectedId] ? data.selectedId : "project";
    centerOn(selectedId);
  }

  function hideMenu() {
    const menu = document.getElementById("graphMenu");
    if (menu) menu.hidden = true;
    menuTarget = "";
  }

  function showMenu(x, y, id) {
    if (lodOf(zoomNow()) < 3) return;
    const menu = document.getElementById("graphMenu");
    if (!menu) return;
    menuTarget = id;
    menu.hidden = false;
    menu.style.left = x + "px";
    menu.style.top = y + "px";
  }

  function clientPoint(event) {
    if (event.client) return event.client;
    const native = event.nativeEvent || event.originalEvent || {};
    return { x: native.clientX || 0, y: native.clientY || 0 };
  }

  async function onNodeClick(id) {
    hideMenu();
    const node = byId[id];
    if (!node) return;
    const wasSelected = selectedId === id;
    selectedId = id;
    page.showNode(id, node);
    if (node.kind === "aggregate") {
      await reopenAggregate(node);
      return;
    }
    const opened = branches.find((item) => item.state === "open" && item.sourceId === id);
    if (opened && !wasSelected) {
      saveSession();
      syncView();
      return;
    }
    if (opened) {
      job += 1;
      busy = false;
      dropBranch(opened, "remove");
      saveSession();
      syncView();
      return;
    }
    if (id === "others" && page.openOthers) page.openOthers();
    await expand(id);
    syncView();
  }

  function clientOf(id) {
    if (!graph || !graph.getElementPosition || !graph.getClientByCanvas) return null;
    const pos = graph.getElementPosition(id);
    if (!pos) return null;
    const point = graph.getClientByCanvas(pos);
    return { left: point[0], top: point[1], width: 36, height: 36, right: point[0] + 18 };
  }

  async function locate(id) {
    if (!byId[id] && byId.project && !expanded.project) await expand("project");
    if (!byId[id]) return;
    selectedId = id;
    page.showNode(id, byId[id]);
    if (graph.focusElement) {
      const zoom = zoomNow();
      await graph.focusElement(id);
      if (Math.abs(zoomNow() - zoom) > 0.02) graph.zoomTo(zoom);
    }
    syncView();
  }

  function preview(id, x, y) {
    const pop = document.getElementById("memberPop");
    if (!pop) return;
    const lod = lodOf(zoomNow());
    const branch = branches.find((item) => item.comboId === id);
    let html = "";
    if (branch && lod === 1) {
      const names = branch.nodeIds.map((nid) => byId[nid] && byId[nid].name).filter(Boolean);
      html = "<b>" + (byId[branch.sourceId] ? byId[branch.sourceId].name : "簇") + "</b><br>" + names.join("、");
    } else if (byId[id] && lod === 2 && !labelOn(byId[id], lod, zoomNow())) {
      html = byId[id].name;
    }
    if (!html) {
      pop.hidden = true;
      return;
    }
    pop.innerHTML = html;
    pop.hidden = false;
    pop.style.left = Math.min(x + 12, window.innerWidth - 240) + "px";
    pop.style.top = Math.min(y + 12, window.innerHeight - 180) + "px";
  }

  async function mount() {
    if (!window.G6) {
      stage.insertAdjacentHTML("beforeend", '<p class="graph-error">图谱组件没有加载</p>');
      return;
    }
    graph = new window.G6.Graph({
      container: stage,
      autoResize: true,
      animation: false,
      zoomRange: [0.15, 3],
      data: { nodes: [], edges: [], combos: [] },
      node: {
        type: "circle",
        state: {
          selected: { halo: true, haloLineWidth: 8, haloStroke: "rgba(47,120,246,0.28)" },
          bid: { halo: true, haloLineWidth: 6, haloStroke: "rgba(47,190,116,0.45)" }
        }
      },
      combo: { type: "circle" },
      edge: { type: "line" },
      behaviors: ["drag-canvas", "zoom-canvas"]
    });
    await graph.render();
    if (window.ResizeObserver) {
      let lastW = 0;
      let lastH = 0;
      const observer = new ResizeObserver(() => {
        const width = stage.clientWidth;
        const height = stage.clientHeight;
        if (!graph || !width || !height || (width === lastW && height === lastH)) return;
        lastW = width;
        lastH = height;
        graph.resize(width, height);
      });
      observer.observe(stage);
    }
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch (err) { saved = null; }
    if (saved && saved.nodes && saved.nodes.length) restore(saved);
    else {
      putStart();
      await expand("project");
    }
    syncView();
    graph.on("node:click", (event) => onNodeClick(event.target && event.target.id));
    graph.on("combo:click", (event) => {
      const comboId = event.target && event.target.id;
      const branch = branches.find((item) => item.comboId === comboId);
      if (!branch) return;
      selectedId = branch.sourceId;
      if (byId[selectedId]) page.showNode(selectedId, byId[selectedId]);
      syncView();
    });
    graph.on("node:contextmenu", (event) => {
      if (event.preventDefault) event.preventDefault();
      const native = event.nativeEvent || event.originalEvent;
      if (native && native.preventDefault) native.preventDefault();
      const point = clientPoint(event);
      showMenu(point.x, point.y, event.target && event.target.id);
    });
    graph.on("canvas:dragstart", () => { cameraDrag = true; job += 1; hideMenu(); });
    graph.on("canvas:dragend", () => { cameraDrag = false; scheduleLod(); });
    graph.on("canvas:wheel", () => { hideMenu(); scheduleLod(); });
    graph.on("combo:pointerenter", (event) => {
      const point = clientPoint(event);
      preview(event.target && event.target.id, point.x, point.y);
    });
    graph.on("node:pointerenter", (event) => {
      const point = clientPoint(event);
      preview(event.target && event.target.id, point.x, point.y);
    });
    graph.on("combo:pointerleave", () => preview("", 0, 0));
    graph.on("node:pointerleave", () => preview("", 0, 0));
    async function addProjects(sourceId, ids) {
    const start = Date.now();
    while (busy && Date.now() - start < 4000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (busy) {
      toast("图谱还在布局，请稍后再添加");
      return false;
    }
    if (!byId[sourceId] && byId.project && !expanded.project) await expand("project");
    const source = byId[sourceId];
    if (!source) {
      toast("请先在图谱中展开该节点");
      return false;
    }
    const fresh = [];
    (ids || []).forEach((id) => {
      if (!id || byId[id]) return;
      const raw = api.getNode(id);
      if (raw) fresh.push(raw);
    });
    if (!fresh.length) {
      toast("这些项目已在图上");
      return true;
    }
    if (fresh.length > 10) {
      toast("节点过多，请保留至（10以下）");
      return false;
    }
    const room = VISIBLE_LIMIT[RENDERER] - visibleCount();
    if (fresh.length > room) {
      toast("当前图谱实体较多，请先收起部分分支再继续探查");
      return false;
    }
    busy = true;
    let branch = branches.find((item) => item.state === "open" && item.sourceId === sourceId && item.centerKind === "entity");
    let branchId = branch && branch.id;
    let comboId = branch && branch.comboId;
    if (!branch) {
      branchId = "b-" + sourceId + "-" + branches.length;
      comboId = "c-" + branchId;
      relateComboCombined(false);
      graph.addComboData([{ id: comboId, data: { center: sourceId }, style: { x: source.x, y: source.y, zIndex: 0 } }]);
      branch = {
        id: branchId,
        sourceId: sourceId,
        comboId: comboId,
        centerKind: "entity",
        nodeIds: [],
        edgeIds: [],
        state: "open",
        snapshot: []
      };
      branches.push(branch);
      history.push(branchId);
    }
    const created = fresh.map((item) => adopt(item, branchId, comboId));
    created.forEach((node) => {
      if (branch.nodeIds.indexOf(node.id) < 0) branch.nodeIds.push(node.id);
    });
    const lod = Math.max(lodOf(zoomNow()), 2);
    graph.addNodeData(created.map((node) => ({
      id: node.id,
      combo: comboId || undefined,
      data: { kind: node.kind, name: node.name },
      style: nodeStyle(node, lod, zoomNow())
    })));
    created.forEach((node) => {
      if (edges.some((edge) => edge.source === sourceId && edge.target === node.id)) return;
      const edge = {
        id: "e-" + sourceId + "-" + node.id,
        source: sourceId,
        target: node.id,
        weight: 0.9,
        scope: "cross",
        branchId: branchId
      };
      edges.push(edge);
      branch.edgeIds.push(edge.id);
      graph.addEdgeData([{ id: edge.id, source: edge.source, target: edge.target, style: edgeStyle(edge, lod) }]);
    });
    graph.draw();
    try {
      await layoutNewcomers(source, created, FORCES.projectRing, comboId);
    } catch (err) {
      toast(err && err.message ? err.message : "局部布局失败");
    }
    branch.snapshot = branch.nodeIds.map((id) => {
      const node = byId[id];
      return node ? { id: id, x: node.x, y: node.y } : null;
    }).filter(Boolean);
    busy = false;
    saveSession();
    syncView();
    toast("已加入 " + created.length + " 个项目");
    return true;
  }

  window.clusterGraph = {
      locate: locate,
      has: function (id) { return !!byId[id]; },
      clientOf: clientOf,
      setBidderHighlight: function (on) { bidOn = !!on; syncView(); },
      addProjects: addProjects,
      resize: function () {
        if (!graph || !graph.resize) return;
        const width = stage.clientWidth;
        const height = stage.clientHeight;
        if (width && height) graph.resize(width, height);
      },
      reset: resetGraph,
      clear: clearGraph
    };
    const back = document.getElementById("backBranch");
    const collapse = document.getElementById("collapseBranch");
    const reset = document.getElementById("resetGraph");
    const clear = document.getElementById("clearGraph");
    const menu = document.getElementById("graphMenu");
    if (back) back.addEventListener("click", () => {
      const id = history[history.length - 1];
      if (!id) return;
      selectedId = branchById(id).sourceId;
      collapseSelected((document.getElementById("collapseMode") || {}).value || "aggregate");
    });
    if (collapse) collapse.addEventListener("click", () => {
      collapseSelected((document.getElementById("collapseMode") || {}).value || "aggregate");
    });
    if (reset) reset.addEventListener("click", resetGraph);
    if (clear) clear.addEventListener("click", clearGraph);
    if (menu) menu.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const id = menuTarget;
      hideMenu();
      if (button.dataset.act === "expand") onNodeClick(id);
      if (button.dataset.act === "agg") { selectedId = id; collapseSelected("aggregate"); }
      if (button.dataset.act === "remove") { selectedId = id; collapseSelected("remove"); }
    });
    document.addEventListener("click", (event) => {
      if (menu && !menu.contains(event.target)) hideMenu();
    });
  }

  mount().catch((err) => {
    console.error(err);
    stage.insertAdjacentHTML("beforeend", '<p class="graph-error">' + (err && err.message ? err.message : "图谱没有布局成功") + "</p>");
  });
})();
