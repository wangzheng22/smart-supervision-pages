(function (global) {
  const IC = () => global.IndustryCatalog;

  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function displayLabel(allL1, l1, sub, subAllLabel) {
    const catalog = IC();
    const all = allL1 || "全部";
    if (!l1 || l1 === all) return all;
    if (sub && sub !== subAllLabel) {
      return catalog ? catalog.formatTrade(l1, sub) : l1 + "-" + sub;
    }
    return l1;
  }

  function mount(host, options) {
    if (!host) return null;
    const opts = options || {};
    const allL1 = opts.allL1Label != null ? opts.allL1Label : "全部";
    const subAll = opts.subAllLabel != null ? opts.subAllLabel : "全部";
    const l1Names = (opts.l1Names || []).slice();
    const theme = opts.theme === "light" ? "light" : "cockpit";
    let value = {
      l1: opts.value && opts.value.l1 != null ? opts.value.l1 : allL1,
      sub: opts.value && opts.value.sub != null ? opts.value.sub : "",
    };

    host.classList.add("industry-cascade", "industry-cascade--" + theme);
    host.innerHTML =
      "<button type=\"button\" class=\"industry-cascade-trigger\" aria-haspopup=\"listbox\" aria-expanded=\"false\">" +
      "<span class=\"industry-cascade-label\"></span></button>" +
      "<div class=\"industry-cascade-panel\" hidden role=\"listbox\">" +
      "<ul class=\"industry-cascade-col industry-cascade-col-l1\"></ul>" +
      "<ul class=\"industry-cascade-col industry-cascade-col-l2 is-empty\"></ul>" +
      "</div>";

    const trigger = host.querySelector(".industry-cascade-trigger");
    const labelEl = host.querySelector(".industry-cascade-label");
    const panel = host.querySelector(".industry-cascade-panel");
    const l1Col = host.querySelector(".industry-cascade-col-l1");
    const l2Col = host.querySelector(".industry-cascade-col-l2");
    const CON = IC() ? IC().CONSTRUCTION_L1 : "建设工程";
    const subs = IC() ? IC().CONSTRUCTION_SUB.slice() : [];

    let hoverL1 = "";
    let open = false;

    function syncLabel() {
      labelEl.textContent = displayLabel(allL1, value.l1, value.sub, subAll);
    }

    function commit(next, closePanel) {
      value = { l1: next.l1, sub: next.sub || "" };
      syncLabel();
      paintSelected();
      if (typeof opts.onChange === "function") {
        opts.onChange({
          l1: value.l1,
          sub: value.sub,
          label: labelEl.textContent,
          key: value.sub && value.l1 === CON && IC()
            ? IC().formatTrade(value.l1, value.sub)
            : value.l1,
        });
      }
      if (closePanel !== false) setOpen(false);
    }

    function paintSelected() {
      l1Col.querySelectorAll(".industry-cascade-item").forEach((node) => {
        const name = node.getAttribute("data-l1");
        const sel = name === value.l1 || (value.l1 === allL1 && name === allL1);
        node.classList.toggle("is-selected", sel && !value.sub);
        if (value.sub && name === value.l1) node.classList.add("is-selected");
      });
      l2Col.querySelectorAll(".industry-cascade-item").forEach((node) => {
        const sub = node.getAttribute("data-sub");
        node.classList.toggle("is-selected", value.l1 === hoverL1 && sub === value.sub);
      });
    }

    function syncL2Visible(show) {
      panel.classList.toggle("has-l2", !!show);
      l2Col.classList.toggle("is-empty", !show);
    }

    function renderL2(forL1) {
      l2Col.innerHTML = "";
      if (forL1 !== CON) {
        syncL2Visible(false);
        return;
      }
      syncL2Visible(true);
      const items = [{ sub: subAll, text: subAll }].concat(subs.map((s) => ({ sub: s, text: s })));
      items.forEach((item) => {
        const li = document.createElement("li");
        li.className = "industry-cascade-item";
        li.setAttribute("data-sub", item.sub);
        li.setAttribute("role", "option");
        li.textContent = item.text;
        li.addEventListener("click", (event) => {
          event.stopPropagation();
          commit({ l1: CON, sub: item.sub === subAll ? "" : item.sub });
        });
        l2Col.appendChild(li);
      });
      paintSelected();
    }

    function renderL1() {
      l1Col.innerHTML = "";
      const list = [allL1].concat(l1Names);
      list.forEach((name) => {
        const li = document.createElement("li");
        li.className = "industry-cascade-item";
        if (name === CON) li.classList.add("has-children");
        li.setAttribute("data-l1", name);
        li.setAttribute("role", "option");
        li.textContent = name;
        li.addEventListener("mouseenter", () => {
          hoverL1 = name;
          l1Col.querySelectorAll(".industry-cascade-item").forEach((n) => {
            n.classList.toggle("is-active", n.getAttribute("data-l1") === name);
          });
          renderL2(name);
        });
        li.addEventListener("click", (event) => {
          event.stopPropagation();
          if (name === CON) {
            hoverL1 = CON;
            renderL2(CON);
            return;
          }
          commit({ l1: name, sub: "" });
        });
        l1Col.appendChild(li);
      });
    }

    function setOpen(next) {
      open = next;
      panel.hidden = !open;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        hoverL1 = value.l1 === allL1 ? allL1 : value.l1;
        renderL1();
        renderL2(hoverL1 === CON ? CON : "");
        l1Col.querySelectorAll(".industry-cascade-item").forEach((n) => {
          n.classList.toggle("is-active", n.getAttribute("data-l1") === hoverL1);
        });
        paintSelected();
      }
    }

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      setOpen(!open);
    });

    host._cascadeDocClick = (event) => {
      if (!host.contains(event.target)) setOpen(false);
    };
    document.addEventListener("click", host._cascadeDocClick);

    host._cascadeKeydown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", host._cascadeKeydown);

    syncLabel();

    const api = {
      getValue() {
        return { l1: value.l1, sub: value.sub, label: labelEl.textContent };
      },
      setValue(next) {
        if (!next) return;
        value = {
          l1: next.l1 != null ? next.l1 : allL1,
          sub: next.sub != null ? next.sub : "",
        };
        syncLabel();
      },
      setL1Names(names) {
        l1Names.length = 0;
        (names || []).forEach((n) => l1Names.push(n));
      },
      destroy() {
        document.removeEventListener("click", host._cascadeDocClick);
        document.removeEventListener("keydown", host._cascadeKeydown);
        host.innerHTML = "";
        host.classList.remove("industry-cascade", "industry-cascade--" + theme);
      },
    };

    host.industryCascade = api;
    return api;
  }

  global.IndustryCascade = { mount, displayLabel };
})(typeof window !== "undefined" ? window : globalThis);
