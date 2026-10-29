(function (g) {
  function levelShort(level) {
    const text = String(level == null ? "" : level).trim();
    const map = { "高风险": "高", "中风险": "中", "低风险": "低", "高": "高", "中": "中", "低": "低" };
    if (map[text]) return map[text];
    if (/风险$/.test(text) && text.length > 1) return text.charAt(0);
    return text || "高";
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
  g.levelShort = levelShort;
  g.levelTone = levelTone;
  g.normalizeWarnAlert = normalizeWarnAlert;
  g.warnTopicKey = warnTopicKey;
  g.dedupeAlertsByTopic = dedupeAlertsByTopic;
})(typeof window !== "undefined" ? window : globalThis);
