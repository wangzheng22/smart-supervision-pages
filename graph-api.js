/* 一阶邻居接口。
 * 页面只在点击时调用 fetchNeighbors，不预加载整张网络。
 * 当前是本地模拟；接后端时保持返回结构不变。
 */
(function () {
  const catalog = {};
  const next = {};
  const weight = {};

  function add(node, neighborIds, weakIds) {
    catalog[node.id] = node;
    next[node.id] = neighborIds || [];
    (weakIds || []).forEach((id) => { weight[node.id + ">" + id] = 0.35; });
  }

  add({
    id: "project", kind: "project", name: "观山湖区第八小学扩建工程",
    fields: [["项目名称", "观山湖区第八小学扩建工程"], ["招标人", "贵州省教育局"], ["招标代理", "贵州恒信招标有限公司"], ["标段", "设计标段、施工标段"]]
  }, ["sec1", "sec2", "b1", "b2", "b3", "b4", "b5", "b6", "others", "agency", "owner", "exp1", "exp2", "exp3", "staff"]);

  add({ id: "sec1", kind: "section", name: "设计标段", fields: [["标段名称", "设计标段"], ["所属项目", "观山湖区第八小学扩建工程"]] }, []);
  add({ id: "sec2", kind: "section", name: "施工标段", fields: [["标段名称", "施工标段"], ["所属项目", "观山湖区第八小学扩建工程"]] }, []);
  add({ id: "b1", kind: "bidder", winSection: "sec1", name: "恒基建设发展有限公司", fields: [["企业名称", "恒基建设发展有限公司"], ["角色", "投标人"], ["所属标段", "设计标段"], ["风险", "高风险"]] }, ["p3"]);
  add({ id: "b2", kind: "bidder", name: "瑞达建设工程有限公司", fields: [["企业名称", "瑞达建设工程有限公司"], ["角色", "投标人"], ["所属标段", "设计标段"]] }, []);
  add({ id: "b3", kind: "bidder", name: "云诚云启科技有限公司", fields: [["企业名称", "云诚云启科技有限公司"], ["角色", "投标人"], ["所属标段", "设计标段"]] }, []);
  add({ id: "b4", kind: "bidder", winSection: "sec2", name: "华宇建工集团有限公司", fields: [["企业名称", "华宇建工集团有限公司"], ["角色", "投标人"], ["所属标段", "施工标段"]] }, []);
  add({ id: "b5", kind: "bidder", name: "黔中建设集团有限公司", fields: [["企业名称", "黔中建设集团有限公司"], ["角色", "投标人"], ["所属标段", "施工标段"]] }, []);
  add({ id: "b6", kind: "bidder", name: "林城工程有限公司", fields: [["企业名称", "林城工程有限公司"], ["角色", "投标人"], ["所属标段", "施工标段"]] }, []);
  add({ id: "others", kind: "bidder", name: "其他投标单位", fields: [["名称", "其他投标单位"], ["数量", "83"], ["角色", "投标人"], ["所属标段", "施工标段"]] }, []);
  add({ id: "agency", kind: "agency", name: "贵州恒信招标有限公司", fields: [["名称", "贵州恒信招标有限公司"], ["角色", "招标代理"], ["关联预警", "代理与中标人沟通过密"], ["风险", "高风险"]] }, ["p4"]);
  add({ id: "owner", kind: "owner", name: "贵州省教育局", fields: [["名称", "贵州省教育局"], ["角色", "招标人"], ["关联项目", "观山湖区第八小学扩建工程、观山湖区实验中学综合楼工程"]] }, ["p2"]);
  add({ id: "exp1", kind: "expert", name: "刘诗涵", fields: [["姓名", "刘诗涵"], ["角色", "评标专家"], ["关联预警", "专家打分异常"], ["风险", "高风险"]] }, ["p3"]);
  add({ id: "exp2", kind: "expert", name: "胡静", fields: [["姓名", "胡静"], ["角色", "评标专家"], ["所属项目", "观山湖区第八小学扩建工程"]] }, []);
  add({ id: "exp3", kind: "expert", name: "张明", fields: [["姓名", "张明"], ["角色", "评标专家"], ["所属项目", "观山湖区第八小学扩建工程"]] }, []);
  add({ id: "staff", kind: "staff", warn: "mid", name: "梁辉", fields: [["姓名", "梁辉"], ["角色", "项目人员"], ["关联预警", "跨项目人员关联"]] }, ["p2"]);

  add({
    id: "p2", kind: "project", name: "观山湖区实验中学综合楼工程",
    fields: [["项目名称", "观山湖区实验中学综合楼工程"], ["招标人", "贵州省教育局"], ["招标代理", "贵州恒信招标有限公司"], ["标段", "施工标段"]]
  }, ["owner", "agency", "p2-staff", "p2-exp", "p2-sec", "p2-b1", "p2-b2", "p2-b3"]);
  add({ id: "p2-staff", kind: "staff", name: "王磊", fields: [["姓名", "王磊"], ["角色", "项目人员"], ["关联预警", "与梁辉跨项目人员关联"], ["风险", "中风险"]] }, []);
  add({ id: "p2-exp", kind: "expert", name: "陈雪", fields: [["姓名", "陈雪"], ["角色", "评标专家"]] }, []);
  add({ id: "p2-sec", kind: "section", name: "施工标段", fields: [["标段名称", "施工标段"], ["所属项目", "观山湖区实验中学综合楼工程"]] }, []);
  add({ id: "p2-b1", kind: "bidder", winSection: "p2-sec", name: "宏达建设有限公司", fields: [["企业名称", "宏达建设有限公司"], ["角色", "投标人"], ["所属标段", "施工标段"]] }, ["p4"]);
  add({ id: "p2-b2", kind: "bidder", name: "启明工程有限公司", fields: [["企业名称", "启明工程有限公司"], ["角色", "投标人"], ["所属标段", "施工标段"]] }, []);
  add({ id: "p2-b3", kind: "bidder", name: "筑城建设工程有限公司", fields: [["企业名称", "筑城建设工程有限公司"], ["角色", "投标人"], ["所属标段", "施工标段"]] }, []);

  add({
    id: "p3", kind: "project", name: "云岩区教师周转房项目",
    fields: [["项目名称", "云岩区教师周转房项目"], ["招标人", "云岩区住房和城乡建设局"], ["招标代理", "中盛工程咨询有限公司"], ["标段", "施工标段"]]
  }, ["p3-owner", "p3-agency", "p3-staff", "p3-exp", "p3-sec", "p3-b1", "p3-b2", "p3-b3"]);
  add({ id: "p3-owner", kind: "owner", name: "云岩区住房和城乡建设局", fields: [["名称", "云岩区住房和城乡建设局"], ["角色", "招标人"]] }, []);
  add({ id: "p3-agency", kind: "agency", name: "中盛工程咨询有限公司", fields: [["名称", "中盛工程咨询有限公司"], ["角色", "招标代理"]] }, []);
  add({ id: "p3-staff", kind: "staff", name: "赵宁", fields: [["姓名", "赵宁"], ["角色", "项目人员"]] }, []);
  add({ id: "p3-exp", kind: "expert", name: "周倩", fields: [["姓名", "周倩"], ["角色", "评标专家"], ["关联预警", "与刘诗涵评分关联"], ["风险", "中风险"]] }, []);
  add({ id: "p3-sec", kind: "section", name: "施工标段", fields: [["标段名称", "施工标段"], ["所属项目", "云岩区教师周转房项目"]] }, []);
  add({ id: "p3-b1", kind: "bidder", winSection: "p3-sec", name: "恒通建设有限公司", fields: [["企业名称", "恒通建设有限公司"], ["角色", "投标人"], ["所属标段", "施工标段"], ["关联预警", "与恒基建设特征码相同"], ["风险", "高风险"]] }, []);
  add({ id: "p3-b2", kind: "bidder", name: "博远建设工程有限公司", fields: [["企业名称", "博远建设工程有限公司"], ["角色", "投标人"], ["所属标段", "施工标段"]] }, []);
  add({ id: "p3-b3", kind: "bidder", name: "贵安建工有限公司", fields: [["企业名称", "贵安建工有限公司"], ["角色", "投标人"], ["所属标段", "施工标段"]] }, []);

  add({
    id: "p4", kind: "project", name: "南明区第二幼儿园新建工程",
    fields: [["项目名称", "南明区第二幼儿园新建工程"], ["招标人", "南明区教育局"], ["招标代理", "贵州恒信招标有限公司"], ["标段", "施工标段"]]
  }, ["p4-owner", "agency", "p4-exp", "p4-sec", "p2-b1", "p4-b2", "p4-b3"]);
  add({ id: "p4-owner", kind: "owner", name: "南明区教育局", fields: [["名称", "南明区教育局"], ["角色", "招标人"]] }, []);
  add({ id: "p4-exp", kind: "expert", name: "何敏", fields: [["姓名", "何敏"], ["角色", "评标专家"]] }, []);
  add({ id: "p4-sec", kind: "section", name: "施工标段", fields: [["标段名称", "施工标段"], ["所属项目", "南明区第二幼儿园新建工程"]] }, []);
  add({ id: "p4-b2", kind: "bidder", winSection: "p4-sec", name: "启航建设有限公司", fields: [["企业名称", "启航建设有限公司"], ["角色", "投标人"], ["所属标段", "施工标段"]] }, []);
  add({ id: "p4-b3", kind: "bidder", name: "南明建设有限公司", fields: [["企业名称", "南明建设有限公司"], ["角色", "投标人"], ["所属标段", "施工标段"]] }, []);

  function highestWarn(alerts) {
    const rank = { low: 1, mid: 2, high: 3 };
    let best = "";
    (alerts || []).forEach((item) => {
      if ((rank[item.level] || 0) > (rank[best] || 0)) best = item.level;
    });
    return best;
  }

  function fieldWarn(node) {
    if (node.warn === "high" || node.warn === "mid" || node.warn === "low") return node.warn;
    const risk = (node.fields || []).find((row) => row[0] === "风险");
    return { "高风险": "high", "中风险": "mid", "低风险": "low" }[(risk || [])[1]] || "";
  }

  function clone(node) {
    return {
      id: node.id,
      kind: node.kind,
      name: node.name,
      winSection: node.winSection || "",
      amount: node.amount || 0,
      warn: fieldWarn(node),
      fields: node.fields.map((row) => row.slice())
    };
  }

  function sectionOf(projectId, bidder) {
    const ids = next[projectId] || [];
    const sections = ids.filter((nid) => catalog[nid] && catalog[nid].kind === "section");
    const field = (bidder.fields || []).find((row) => row[0] === "所属标段");
    if (field) {
      const named = sections.find((nid) => catalog[nid].name === field[1]);
      if (named) return named;
    }
    return sections.length ? sections[0] : "";
  }

  function edgesOf(id) {
    const center = catalog[id];
    const ids = (next[id] || []).filter((nid) => catalog[nid]);
    if (!center || center.kind !== "project") {
      return ids.map((nid) => ({ source: id, target: nid, weight: weight[id + ">" + nid] || 0.9 }));
    }
    return ids.map((nid) => {
      const node = catalog[nid];
      const sectionId = node.kind === "bidder" ? sectionOf(id, node) : "";
      return {
        source: sectionId || id,
        target: nid,
        weight: weight[id + ">" + nid] || 0.9
      };
    });
  }

  function fetchNeighbors(id) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const center = catalog[id];
        if (!center) {
          resolve({ centerKind: "", nodes: [], edges: [] });
          return;
        }
        const ids = (next[id] || []).filter((nid) => catalog[nid]);
        resolve({
          centerKind: center.kind,
          nodes: ids.map((nid) => clone(catalog[nid])),
          edges: edgesOf(id)
        });
      }, 160);
    });
  }

  function wanAmount(n) {
    const wan = (Number(n) || 0) / 10000;
    const text = Math.abs(wan - Math.round(wan)) < 0.05 ? String(Math.round(wan)) : String(Math.round(wan * 10) / 10);
    return text + "万";
  }
  function projectFields(card) {
    return [
      ["招标单位", card.owner || "—"],
      ["招标代理", card.agency || "—"],
      ["监管部门", card.regulator || "—"],
      ["交易中心", card.center || "—"],
      ["中标单位", card.winner || "—"],
      ["项目规模", card.amount ? wanAmount(card.amount) : "—"],
      ["是否远程异地", card.remote || "否"],
      ["是否暗标评审", card.sealed || "否"]
    ];
  }

  function remember(card) {
    const fields = projectFields(card);
    if (!catalog[card.id]) {
      catalog[card.id] = { id: card.id, kind: "project", name: card.name, amount: card.amount || 0, warn: highestWarn(card.alerts), fields: fields };
      next[card.id] = [];
    } else if (catalog[card.id].kind === "project") {
      catalog[card.id].fields = fields;
      if (card.amount) catalog[card.id].amount = card.amount;
      const warn = highestWarn(card.alerts);
      if (warn) catalog[card.id].warn = warn;
    }
    return card;
  }

  const school = remember({
    id: "project", name: "观山湖区第八小学扩建工程", date: "2026-04-27", industry: "房建", warn: "高风险",
    amount: 86500000, owner: "贵州省教育局", agency: "贵州恒信招标有限公司",
    regulator: "贵州省教育厅", center: "贵州省公共资源交易中心", winner: "恒基建设发展有限公司、华宇建工集团有限公司", remote: "是", sealed: "是",
    bidders: ["恒基建设发展有限公司", "瑞达建设工程有限公司", "云诚云启科技有限公司", "华宇建工集团有限公司", "黔中建设集团有限公司", "林城工程有限公司"],
    experts: ["刘诗涵", "胡静", "张明"],
    alerts: [
      { level: "high", text: "CA锁联系人相同" },
      { level: "high", text: "投标人特征码相同" },
      { level: "high", text: "专家打分异常" },
      { level: "mid", text: "投标文件下载异常" }
    ]
  });
  const p2card = remember({
    id: "p2", name: "观山湖区实验中学综合楼工程", date: "2026-02-16", industry: "房建", warn: "中风险",
    amount: 126800000, owner: "贵州省教育局", agency: "贵州恒信招标有限公司",
    regulator: "贵州省教育厅", center: "贵州省公共资源交易中心", winner: "宏达建设有限公司", remote: "否", sealed: "是",
    bidders: ["宏达建设有限公司", "启明工程有限公司", "筑城建设工程有限公司"], experts: ["陈雪"],
    alerts: [{ level: "mid", text: "跨项目人员关联" }]
  });
  const p3card = remember({
    id: "p3", name: "云岩区教师周转房项目", date: "2026-03-04", industry: "房建", warn: "高风险",
    amount: 54200000, owner: "云岩区住房和城乡建设局", agency: "中盛工程咨询有限公司",
    regulator: "贵阳市住房和城乡建设局", center: "贵阳市公共资源交易中心", winner: "恒通建设有限公司", remote: "是", sealed: "否",
    bidders: ["恒通建设有限公司", "博远建设工程有限公司", "贵安建工有限公司"], experts: ["周倩"],
    alerts: [
      { level: "high", text: "投标人特征码相同" },
      { level: "low", text: "保证金到账偏晚" }
    ]
  });
  const p4card = remember({
    id: "p4", name: "南明区第二幼儿园新建工程", date: "2026-03-18", industry: "房建", warn: "高风险",
    amount: 28600000, owner: "南明区教育局", agency: "贵州恒信招标有限公司",
    regulator: "贵阳市教育局", center: "贵阳市公共资源交易中心", winner: "启航建设有限公司", remote: "否", sealed: "否",
    bidders: ["宏达建设有限公司", "启航建设有限公司", "南明建设有限公司"], experts: ["何敏"],
    alerts: [{ level: "high", text: "代理与中标人沟通过密" }]
  });
  const extraMeta = {
    dp1: { amount: 41800000, regulator: "贵阳市教育局", center: "贵阳市公共资源交易中心", winner: "宏达建设有限公司", remote: "否", sealed: "是", alerts: [{ level: "mid", text: "投标报价偏离" }] },
    dp2: { amount: 186500000, regulator: "贵阳市卫生健康局", center: "贵阳市公共资源交易中心", winner: "博远建设工程有限公司", remote: "是", sealed: "否", alerts: [{ level: "low", text: "公告期限偏短" }] },
    dp3: { amount: 97300000, regulator: "贵阳市城市管理局", center: "贵阳市公共资源交易中心", winner: "贵阳建工市政公司", remote: "否", sealed: "否", alerts: [{ level: "high", text: "投标人特征码相同" }, { level: "mid", text: "报价呈规律性差异" }] },
    dp4: { amount: 63400000, regulator: "贵阳市水务局", center: "贵阳市公共资源交易中心", winner: "恒基建设发展有限公司", remote: "是", sealed: "是", alerts: [{ level: "mid", text: "文件下载异常" }] },
    dp5: { amount: 112400000, regulator: "贵阳市城市管理局", center: "贵阳市公共资源交易中心", winner: "华宇建工集团有限公司", remote: "否", sealed: "是", alerts: [{ level: "high", text: "CA锁联系人相同" }] },
    dp6: { amount: 15800000, regulator: "贵州省交通运输厅", center: "贵州省公共资源交易中心", winner: "黔通建设有限公司", remote: "是", sealed: "否", alerts: [{ level: "low", text: "签章信息不完整" }] },
    dp7: { amount: 245000000, regulator: "贵州省交通运输厅", center: "贵州省公共资源交易中心", winner: "路桥建设有限公司", remote: "是", sealed: "是", alerts: [{ level: "high", text: "投标报价异常" }, { level: "low", text: "人员社保断档" }] },
    dp8: { amount: 73600000, regulator: "贵阳市交通运输局", center: "贵阳市公共资源交易中心", winner: "宏达建设有限公司", remote: "否", sealed: "否", alerts: [{ level: "mid", text: "跨项目人员关联" }] },
    dp9: { amount: 158600000, regulator: "贵州省教育厅", center: "贵州省公共资源交易中心", winner: "恒基建设发展有限公司", remote: "是", sealed: "否", alerts: [{ level: "high", text: "专家打分异常" }] },
    dp10: { amount: 39200000, regulator: "贵阳市交通运输局", center: "贵阳市公共资源交易中心", winner: "启航建设有限公司", remote: "否", sealed: "是", alerts: [] }
  };
  const extraCards = [
    ["dp1", "花溪区第三小学教学楼工程", "2026-05-09", "房建", "中风险", "贵阳市教育局", ["宏达建设有限公司", "启明工程有限公司"], ["陈雪"]],
    ["dp2", "乌当区人民医院门诊楼", "2026-06-21", "房建", "低风险", "云岩区住房和城乡建设局", ["博远建设工程有限公司"], ["周倩"]],
    ["dp3", "观山湖区市政道路改造工程", "2026-01-15", "市政", "高风险", "贵阳市城市管理局", ["贵阳建工市政公司", "路桥建设有限公司"], ["吴凯"]],
    ["dp4", "南明区排水管网改造工程", "2026-02-08", "市政", "中风险", "观山湖区住房和城乡建设局", ["恒基建设发展有限公司"], ["刘诗涵"]],
    ["dp5", "白云区城市道路提升工程", "2026-07-02", "市政", "高风险", "南明区城市管理局", ["华宇建工集团有限公司", "瑞达建设工程有限公司"], ["张明"]],
    ["dp6", "贵阳环城路照明工程", "2026-08-19", "市政", "低风险", "贵州省交通运输厅", ["黔通建设有限公司"], ["何敏"]],
    ["dp7", "贵阳至安顺公路养护工程", "2026-09-03", "交通", "高风险", "贵州省交通运输厅", ["黔通建设有限公司", "路桥建设有限公司"], ["吴凯"]],
    ["dp8", "观山湖区公交场站工程", "2026-09-28", "交通", "中风险", "贵阳市交通投资集团", ["宏达建设有限公司"], ["陈雪"]],
    ["dp9", "花溪大学城道路工程", "2026-10-16", "交通", "高风险", "贵州省教育局", ["恒基建设发展有限公司"], ["刘诗涵"]],
    ["dp10", "南明区桥梁维修工程", "2026-11-06", "交通", "无预警", "南明区教育局", ["启航建设有限公司", "云诚云启科技有限公司"], ["胡静"]]
  ].map((row) => remember(Object.assign({
    id: row[0], name: row[1], date: row[2], industry: row[3], warn: row[4], owner: row[5],
    bidders: row[6], experts: row[7], agency: "贵州恒信招标有限公司"
  }, extraMeta[row[0]])));

  const categoryOf = {
    project: "高标准农田",
    p2: "高标准农田",
    p3: "国企采购",
    p4: "国企采购",
    dp1: "高标准农田",
    dp2: "国企采购",
    dp3: "高标准农田",
    dp4: "国企采购",
    dp5: "国企采购",
    dp6: "国企采购",
    dp7: "高标准农田",
    dp8: "国企采购",
    dp9: "国企采购",
    dp10: "国企采购"
  };
  [school, p2card, p3card, p4card].concat(extraCards).forEach((card) => {
    card.category = categoryOf[card.id] || "国企采购";
  });

  const related = {
    agency: [school, p4card].concat(extraCards),
    owner: [school, p2card],
    staff: [school, p2card],
    exp1: [school, p3card],
    b1: [school, p3card],
    exp2: [school],
    exp3: [school],
    b2: [school],
    b3: [school],
    b4: [school],
    others: [school],
    sec1: [school],
    sec2: [school]
  };

  function copyCard(card) {
    return {
      id: card.id,
      name: card.name,
      date: card.date,
      industry: card.industry,
      warn: card.warn,
      owner: card.owner,
      bidders: card.bidders.slice(),
      experts: card.experts.slice(),
      amount: card.amount || 0,
      agency: card.agency || "",
      category: card.category || "",
      alerts: (card.alerts || []).map((item) => ({ level: item.level, text: item.text }))
    };
  }

  window.GraphAPI = {
    fetchNeighbors: fetchNeighbors,
    getNode: function (id) {
      return catalog[id] ? clone(catalog[id]) : null;
    },
    relatedProjects: function (id) {
      return (related[id] || []).map(copyCard);
    },
    allProjects: function () {
      return [school, p2card, p3card, p4card].concat(extraCards).map(copyCard);
    }
  };
})();
