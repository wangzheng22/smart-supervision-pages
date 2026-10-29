(function (global) {
  let bound = false;

  function esc(text) {
    return String(text).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  }

  function isHandoffOnline(item) {
    return item.handoff === "线上移交";
  }

  function isHandoffOffline(item) {
    return item.handoff === "线下移交";
  }

  function flowStepStatus(index, item, stepCount) {
    if (isHandoffOffline(item)) {
      return index <= 1 ? "done" : "pending";
    }
    if (item.handoff === "待移交") {
      if (index === 0) return "done";
      if (index === 1) return "current";
      return "pending";
    }
    if (isHandoffOnline(item) && item.handle === "已办理") return "done";
    if (isHandoffOnline(item)) {
      const active = item.handle === "办理中" ? 4 : 2;
      if (index < active) return "done";
      if (index === active) return "current";
      return "pending";
    }
    return index < stepCount - 1 ? "done" : "pending";
  }

  function flowSteps(item) {
    const mark = item.sensitive ? "有" : "无";
    const limit = item.limit && item.limit !== "—" ? "时限" + item.limit + "（黄灯预警）" : "继续核查中";
    const onlineSteps = [
      {
        title: "线索归集",
        subtitle: "模型向量自动纳入",
        time: "2026-03-26 09:40:12",
        doneNote: "来源：" + item.source + " " + item.id + "；敏感标记：" + mark
      },
      {
        title: "初核移交",
        subtitle: "移交至：" + item.dept,
        time: "2026-03-26 09:41:08",
        doneNote: "移交方式：" + (isHandoffOffline(item) ? "线下移交打包" : item.handoff === "待移交" ? "待确认" : "线上移交") + "；依据：" + item.type + " / " + item.source
      },
      {
        title: "接收确认",
        subtitle: item.dept + " 已签收",
        time: "2026-03-26 14:22:31",
        currentText: "等待 " + item.dept + " 确认接收并指定办理人，请留意待办提醒~",
        futureText: "主办部门确认接收后，系统将记录签收人并进入受理环节。"
      },
      {
        title: "受理",
        subtitle: "符合受理条件",
        time: "2026-03-27 10:05:18",
        currentText: "正在核验线索材料完整性并生成受理编号，请耐心等待~",
        futureText: "材料核验通过后出具受理意见，并同步启动核查时限计时。"
      },
      {
        title: "核查处置",
        subtitle: "过程记录 4 条",
        time: "2026-03-28 09:00:00",
        currentText: "已调取相关主体文件元数据并固定证据；" + limit + "，请继续补充笔录与佐证~",
        futureText: "按核查指引完成现场或远程取证，过程记录将自动留痕。"
      },
      {
        title: "反馈归档",
        subtitle: "办结核验",
        time: item.handle === "已办理" && isHandoffOnline(item) ? "2026-04-02 16:20:00" : "",
        currentText: "请上传办结报告与佐证材料，系统将进行办结核验~",
        futureText: "办结报告审核通过后，线索状态更新为已办理并归档存证。"
      }
    ];
    const steps = isHandoffOffline(item) ? onlineSteps.slice(0, 2) : onlineSteps;
    return steps.map((step, index) => ({
      ...step,
      status: flowStepStatus(index, item, steps.length)
    }));
  }

  function renderFlowStep(step) {
    const cls = "flow-step flow-step--" + step.status;
    if (step.status === "pending") {
      return "<li class=\"" + cls + "\"><b>" + esc(step.title) + "</b><div class=\"flow-future\">" + esc(step.futureText || step.doneNote || "尚未启动") + "</div></li>";
    }
    if (step.status === "current") {
      return "<li class=\"" + cls + "\"><b>" + esc(step.title) + "</b><span class=\"flow-sub\">" + esc(step.subtitle || "") + "</span><p class=\"flow-now\">" + esc(step.currentText || step.doneNote || "") + "</p></li>";
    }
    const note = step.doneNote ? "<span class=\"flow-sub flow-done-note\">" + esc(step.doneNote) + "</span>" : "";
    const when = step.time ? "<time>" + esc(step.time) + "</time>" : "";
    return "<li class=\"" + cls + "\"><b>" + esc(step.title) + "</b><span class=\"flow-sub\">" + esc(step.subtitle || "") + "</span>" + note + when + "</li>";
  }

  function bindEvents() {
    if (bound) return;
    bound = true;
    const mask = document.getElementById("detailMask");
    const closeBtn = document.getElementById("detailClose");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        mask.classList.remove("is-open");
      });
    }
    if (mask) {
      mask.addEventListener("click", (event) => {
        const note = event.target.closest("[data-note]");
        if (!note) return;
        const summary = document.getElementById("detailSummary");
        if (summary) summary.textContent = note.dataset.note;
      });
    }
  }

  function open(item) {
    if (!item) return;
    bindEvents();
    const pendingHandoff = item.handoff === "待移交";
    document.getElementById("detailTitle").textContent = item.name;
    document.getElementById("detailGrid").classList.toggle("is-handoff-pending", pendingHandoff);
    document.getElementById("detailSummary").textContent =
      "系统已归集「" + item.name + "」（" + item.source + "）。关联主体 3 家、关联项目 5 个、关联预警 8 条，与「" + item.type + "」高度重合。根据规则引擎，建议取证重点：文件元数据、CA 锁办理流水、办理人社保记录、企业间同标率。";
    const files = [
      [item.type + "元数据固定快照.pdf", "表单快照", "系统", "已取证"],
      ["CA锁办理流水.xlsx", "书证", "李××（" + item.dept + "）", "已取证"],
      ["询问笔录（纸）", "笔录", "—", "待上传"]
    ];
    document.getElementById("detailProof").innerHTML = files.map((row) => {
      const state = row[3] === "已取证" ? "got" : "wait";
      return "<tr><td>" + esc(row[0]) + "</td><td>" + esc(row[1]) + "</td><td>" + esc(row[2]) + '</td><td class="' + state + '">' + esc(row[3]) + "</td></tr>";
    }).join("");
    document.getElementById("detailFlow").innerHTML = pendingHandoff
      ? ""
      : flowSteps(item).slice().reverse().map(renderFlowStep).join("");
    document.getElementById("detailMask").classList.add("is-open");
  }

  global.ClueDetail = { open: open };
})(window);
