(function (global) {
  const CONSTRUCTION_L1 = "建设工程";
  const CONSTRUCTION_SUB = ["交通工程", "水利工程", "农业农村", "房屋建筑"];

  const LEGACY_SUB = {
    交通: "交通工程",
    交通工程: "交通工程",
    水利: "水利工程",
    水利工程: "水利工程",
    农业: "农业农村",
    农业农村: "农业农村",
    住建: "房屋建筑",
    房屋建筑: "房屋建筑",
    市政工程: "房屋建筑",
    市政公用: "房屋建筑",
  };

  function hashSeed(str) {
    let n = 0;
    const s = String(str || "");
    for (let i = 0; i < s.length; i += 1) n = (n * 33 + s.charCodeAt(i)) >>> 0;
    return n;
  }

  function subFromSeed(seed) {
    return CONSTRUCTION_SUB[hashSeed(seed) % CONSTRUCTION_SUB.length];
  }

  function formatTrade(l1, sub) {
    if (!l1) return "—";
    if (l1 === CONSTRUCTION_L1 && sub) return l1 + "-" + sub;
    return l1;
  }

  function parseTrade(trade) {
    const raw = String(trade || "").trim();
    if (!raw || raw === "—") return { l1: "", sub: "" };
    const dash = raw.indexOf("-");
    if (dash >= 0) {
      return { l1: raw.slice(0, dash), sub: raw.slice(dash + 1) };
    }
    if (CONSTRUCTION_SUB.includes(raw) || LEGACY_SUB[raw]) {
      const sub = LEGACY_SUB[raw] || raw;
      return { l1: CONSTRUCTION_L1, sub };
    }
    return { l1: raw, sub: "" };
  }

  function enrichProjectTrade(row) {
    if (!row || row.tab !== "project") return row;
    let l1 = row.tradeL1;
    let sub = row.tradeSub;
    const parsed = parseTrade(row.trade);
    if (!l1) l1 = parsed.l1;
    if (!sub) sub = parsed.sub;

    if (l1 === CONSTRUCTION_L1 && !sub) {
      sub = subFromSeed(row.code || row.id || row.name);
    }
    if (!l1 && row.trade) l1 = row.trade;

    row.tradeL1 = l1 || "—";
    row.tradeSub = l1 === CONSTRUCTION_L1 ? sub || subFromSeed(row.code || row.id || row.name) : "";
    row.trade = formatTrade(row.tradeL1 === "—" ? "" : row.tradeL1, row.tradeSub);
    return row;
  }

  function matchIndustryFilter(row, l1, sub, allLabel) {
    const all = allLabel || "全部";
    if (!l1 || l1 === all) return true;
    enrichProjectTrade(row);
    const rowL1 = row.tradeL1 || parseTrade(row.trade).l1;
    const rowSub = row.tradeSub || parseTrade(row.trade).sub;
    if (rowL1 !== l1 && row.trade !== l1) return false;
    if (l1 !== CONSTRUCTION_L1 || !sub || sub === all) return true;
    return rowSub === sub || row.trade === formatTrade(l1, sub);
  }

  function industrySubOptionsHtml(allLabel) {
    const all = allLabel || "全部";
    return (
      "<option value=\"" + all + "\">" + all + "</option>" +
      CONSTRUCTION_SUB.map((name) => "<option value=\"" + name + "\">" + name + "</option>").join("")
    );
  }

  function escAttr(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  /** 驾驶舱单 select：一级、二级均可选 */
  function buildCockpitIndustrySelectHtml(industryNames, allLabel) {
    const all = allLabel || "全部行业";
    let html = "<option value=\"" + escAttr(all) + "\">" + escAttr(all) + "</option>";
    (industryNames || []).forEach((name) => {
      if (name === CONSTRUCTION_L1) {
        html += "<option value=\"" + escAttr(CONSTRUCTION_L1) + "\">" + escAttr(CONSTRUCTION_L1) + "</option>";
        CONSTRUCTION_SUB.forEach((sub) => {
          const val = formatTrade(CONSTRUCTION_L1, sub);
          html += "<option value=\"" + escAttr(val) + "\">" + escAttr(val) + "</option>";
        });
        return;
      }
      html += "<option value=\"" + escAttr(name) + "\">" + escAttr(name) + "</option>";
    });
    return html;
  }

  function splitCockpitIndustryValue(value) {
    const raw = String(value || "").trim();
    if (!raw || raw === "全部行业") return { l1: "全部行业", sub: "" };
    const parsed = parseTrade(raw);
    if (parsed.l1 === CONSTRUCTION_L1 && parsed.sub) {
      return { l1: CONSTRUCTION_L1, sub: parsed.sub };
    }
    return { l1: raw, sub: "" };
  }

  global.IndustryCatalog = {
    CONSTRUCTION_L1,
    CONSTRUCTION_SUB,
    formatTrade,
    parseTrade,
    enrichProjectTrade,
    matchIndustryFilter,
    industrySubOptionsHtml,
    buildCockpitIndustrySelectHtml,
    splitCockpitIndustryValue,
    subFromSeed,
  };
})(typeof window !== "undefined" ? window : globalThis);
