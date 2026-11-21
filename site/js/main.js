(() => {
  const cfg = window.GNODE;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── text bindings ───────────────────────────────
  document.querySelectorAll("[data-bind]").forEach((n) => {
    const v = cfg[n.dataset.bind];
    if (v != null) n.textContent = v;
  });
  document.title = `${cfg.hostname} — homelab`;

  // ── stats ───────────────────────────────────────
  const live = cfg.services.filter((s) => s.status === "live").length;
  const queued = cfg.services.length - live;
  countUp($("#stat-live"), live);
  countUp($("#stat-planned"), queued);

  function countUp(node, target) {
    if (reduced) return (node.textContent = target);
    let i = 0;
    const t = setInterval(() => {
      node.textContent = ++i >= target ? target : i;
      if (i >= target) clearInterval(t);
    }, 120);
  }

  function uptime() {
    const ms = Date.now() - new Date(cfg.onlineSince).getTime();
    if (!(ms > 0)) return "0d";
    const d = Math.floor(ms / 864e5);
    const h = Math.floor((ms % 864e5) / 36e5);
    return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((ms % 36e5) / 6e4)}m`;
  }
  const tick = () => {
    $("#clock").textContent = new Date().toLocaleTimeString([], { hour12: false });
    $("#stat-uptime").textContent = uptime();
  };
  tick();
  setInterval(tick, 1000);

  // ── service cards ───────────────────────────────
  const cards = $("#cards");
  cfg.services.forEach((s, i) => {
    const c = el("article", "card");
    c.dataset.status = s.status;
    const title = s.url && s.url !== "/" ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : esc(s.name);
    c.innerHTML = `
      <div class="card-top">
        <span class="card-kind mono">${esc(s.kind || "service")}</span>
        <span class="card-status mono"><i class="dot ${esc(s.status)}"></i><span class="st">${esc(s.status)}</span></span>
      </div>
      <h3>${title}</h3>
      <p>${esc(s.desc || "")}</p>
      <div class="tags">${(s.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>`;
    cards.appendChild(c);
    if (s.status === "live" && s.url && location.protocol !== "file:") probe(s, c);
  });

  // Real reachability check from the visitor's browser.
  // no-cors means we can't read the response, but a resolved fetch = host answered.
  async function probe(s, card) {
    const st = card.querySelector(".st");
    const dot = card.querySelector(".dot");
    st.textContent = "probing…";
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 5000);
    const t0 = performance.now();
    try {
      await fetch(s.url, { mode: "no-cors", cache: "no-store", signal: ctrl.signal });
      st.textContent = `live · ${Math.round(performance.now() - t0)}ms`;
      s._up = true;
    } catch {
      st.textContent = "unreachable";
      dot.className = "dot down";
      s._up = false;
    } finally {
      clearTimeout(to);
    }
  }

  // ── spec sheet ──────────────────────────────────
  const spec = $("#spec");
  cfg.node.forEach(({ label, value }) => {
    spec.appendChild(el("dt", null, esc(label)));
    spec.appendChild(el("dd", null, esc(value)));
  });

  // ── footer links ────────────────────────────────
  const links = $("#links");
  (cfg.links || []).forEach((l) => {
    const a = el("a", null, esc(l.label));
    a.href = l.url;
    a.target = "_blank";
    a.rel = "noopener";
    links.appendChild(a);
  });

  // ── pipeline highlight loop ─────────────────────
  const steps = [...document.querySelectorAll(".pipeline li")];
  if (!reduced && steps.length) {
    let k = 0;
    setInterval(() => {
      steps.forEach((s, i) => s.classList.toggle("active", i === k));
      k = (k + 1) % steps.length;
    }, 1100);
  }

  // ── terminal ────────────────────────────────────
  const term = $("#term");
  const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);
  const node = cfg.nodeName || cfg.hostname;
  const rows = cfg.services
    .filter((s) => s.status === "live" && s.pod)
    .map((s) => {
      const [ns, name] = s.pod.split("/");
      const n = s.replicas || 1;
      return `${pad(ns, 14)}${pad(name, 16)}${pad(`${n}/${n}`, 8)}<span class="ok">Running</span>`;
    });
  const script = [
    { cmd: "kubectl get nodes" },
    { out: `<span class="dim">NAME${" ".repeat(12)}STATUS   ROLES</span>\n${pad(node, 16)}<span class="ok">Ready</span>    control-plane` },
    { cmd: "kubectl get deploy -A" },
    { out: `<span class="dim">${pad("NAMESPACE", 14)}${pad("NAME", 16)}${pad("READY", 8)}STATUS</span>\n${rows.join("\n")}` },
    { cmd: `echo "${queued} more on the way"` },
    { out: `${queued} more on the way` },
  ];
  typeTerm(script);

  async function typeTerm(lines) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));
    let html = "";
    const render = (extra = "") => (term.innerHTML = html + extra + '<span class="cursor"></span>');
    // wait until the terminal scrolls into view
    await new Promise((res) => {
      const io = new IntersectionObserver((e) => e[0].isIntersecting && (io.disconnect(), res()));
      io.observe(term);
    });
    for (const l of lines) {
      if (l.cmd) {
        html += '<span class="p">$</span> ';
        for (const ch of l.cmd) {
          html += esc(ch);
          render();
          await sleep(35 + Math.random() * 40);
        }
        html += "\n";
        await sleep(300);
      } else {
        html += l.out + "\n\n";
        render();
        await sleep(500);
      }
    }
    html += '<span class="p">$</span> ';
    render();
  }

  // ── topology canvas ─────────────────────────────
  const cv = $("#topology");
  const ctx = cv.getContext("2d");
  let W = 0, H = 0, dpr = 1;
  const css = getComputedStyle(document.documentElement);
  const C = {
    accent: css.getPropertyValue("--accent").trim(),
    accent2: css.getPropertyValue("--accent-2").trim(),
    warn: css.getPropertyValue("--warn").trim(),
    off: css.getPropertyValue("--off").trim(),
    text: css.getPropertyValue("--text").trim(),
    muted: css.getPropertyValue("--muted").trim(),
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    W = r.width; H = r.height;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", resize);
  resize();

  // Ring order: traffic chain first, then the services it routes to, then the rest,
  // so the public path (internet → tunnel → ingress → sites) sits on adjacent nodes.
  const chain = (cfg.traffic || []).filter((n) => cfg.services.some((s) => s.name === n));
  const last = chain[chain.length - 1];
  const routed = cfg.services.filter((s) => last && s.via === last);
  const ordered = [
    ...chain.map((n) => cfg.services.find((s) => s.name === n)),
    ...routed,
    ...cfg.services.filter((s) => !chain.includes(s.name) && !routed.includes(s)),
  ];
  const onPath = new Set([...chain, ...routed.map((s) => s.name)]);
  const nodes = ordered.map((s, i) => ({
    s,
    a: (i / ordered.length) * Math.PI * 2 - Math.PI / 2,
  }));
  // traffic edges as [from, to] service names
  const routes = [
    ...chain.slice(1).map((n, i) => [chain[i], n]),
    ...routed.map((s) => [last, s.name]),
  ];
  const stars = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.2, p: Math.random() * 6 }));
  const colorFor = (s) => (s._up === false ? "#ff5d6c" : s.status === "live" ? C.accent : s.status === "building" ? C.warn : C.off);

  let t0 = performance.now();
  function frame(now) {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.34;
    const rot = reduced ? 0 : t * 0.05;

    // background stars
    stars.forEach((st) => {
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t + st.p);
      ctx.fillStyle = C.muted;
      ctx.beginPath(); ctx.arc(st.x * W, st.y * H, st.r, 0, 7); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // orbit rings
    ctx.strokeStyle = "rgba(120,160,200,0.12)";
    ctx.lineWidth = 1;
    [R, R * 0.62, R * 1.32].forEach((rr, i) => {
      ctx.setLineDash(i === 2 ? [2, 6] : []);
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.setLineDash([]);

    // sweeping scanner
    if (!reduced) {
      const sa = t * 0.8;
      const g = ctx.createConicGradient ? ctx.createConicGradient(sa, cx, cy) : null;
      if (g) {
        g.addColorStop(0, "rgba(55,226,196,0.16)");
        g.addColorStop(0.08, "rgba(55,226,196,0)");
        g.addColorStop(1, "rgba(55,226,196,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, R * 1.32, 0, Math.PI * 2); ctx.fill();
      }
    }

    // positions
    const pos = {};
    nodes.forEach((n) => {
      n.ang = n.a + rot;
      n.x = cx + Math.cos(n.ang) * R;
      n.y = cy + Math.sin(n.ang) * R;
      n.on = n.s.status === "live" && n.s._up !== false;
      pos[n.s.name] = n;
    });

    // cluster spokes: core → every node. Nodes on the public path get a quiet
    // spoke; their packets travel along the traffic route instead.
    nodes.forEach((n, i) => {
      const quiet = onPath.has(n.s.name);
      drawEdge(cx, cy, n.x, n.y, colorFor(n.s), n.on && !quiet, t + i, 1, quiet && n.on ? 0.2 : null);
    });

    // internet uplink (top) → entry of the traffic chain (or the core if none)
    const ix = cx, iy = Math.max(26, cy - R * 1.32);
    const entry = pos[chain[0]];
    drawEdge(ix, iy, entry ? entry.x : cx, entry ? entry.y : cy, C.accent2, true, t, 0.6);
    ctx.fillStyle = C.accent2;
    ctx.beginPath(); ctx.arc(ix, iy, 4, 0, 7); ctx.fill();
    label("internet", ix, iy - 12, C.muted, "center");

    // public traffic route: tunnel → ingress → each site
    routes.forEach(([a, b], i) => {
      const p = pos[a], q = pos[b];
      drawEdge(p.x, p.y, q.x, q.y, C.accent2, p.on && q.on, t + i * 0.3, 0.6);
    });

    // service nodes
    nodes.forEach((n) => {
      const { x, y, ang: a, on } = n;
      const col = colorFor(n.s);

      // node glyph
      ctx.save();
      ctx.translate(x, y);
      if (on) { ctx.shadowColor = col; ctx.shadowBlur = 18; }
      ctx.fillStyle = "#0c1017";
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(on || n.s.status === "building" ? [] : [3, 3]);
      roundRect(-9, -9, 18, 18, 4);
      ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      if (on || n.s.status === "building") {
        ctx.fillStyle = col;
        ctx.globalAlpha = n.s.status === "building" ? 0.5 + 0.5 * Math.sin(t * 4) : 1;
        ctx.fillRect(-3, -3, 6, 6);
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      const lx = Math.cos(a) >= 0 ? "left" : "right";
      const off = Math.cos(a) >= 0 ? 16 : -16;
      label(n.s.name, x + off, y - 2, on ? C.text : C.muted, lx, 12);
      const ns = routed.includes(n.s) && n.s.pod ? ` · ns/${n.s.pod.split("/")[0]}` : "";
      label((n.s.kind || "") + ns, x + off, y + 13, C.muted, lx, 10);
    });

    // core node
    const pr = 26 + (reduced ? 0 : Math.sin(t * 2) * 2);
    ctx.save();
    ctx.shadowColor = C.accent; ctx.shadowBlur = 30;
    hex(cx, cy, pr);
    ctx.fillStyle = "#0c1017"; ctx.fill();
    ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    hex(cx, cy, pr * 0.45);
    ctx.fillStyle = C.accent; ctx.fill();
    label(cfg.nodeName || cfg.hostname, cx, cy + pr + 18, C.text, "center", 13);
    label("k3s control-plane", cx, cy + pr + 33, C.muted, "center", 10);

    if (!reduced) requestAnimationFrame(frame);
  }

  function drawEdge(x1, y1, x2, y2, col, on, t, speed, alpha) {
    ctx.strokeStyle = col;
    ctx.globalAlpha = alpha != null ? alpha : on ? 0.35 : 0.15;
    ctx.lineWidth = 1;
    ctx.setLineDash(on || alpha != null ? [] : [4, 5]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    if (!on || reduced) return;
    // two packets per edge, travelling outward
    for (let k = 0; k < 2; k++) {
      const p = ((t * 0.35 * speed + k * 0.5) % 1 + 1) % 1;
      const px = x1 + (x2 - x1) * p, py = y1 + (y2 - y1) * p;
      ctx.fillStyle = col;
      ctx.shadowColor = col; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(px, py, 2, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  function label(txt, x, y, col, align, size = 11) {
    ctx.font = `${size}px ${getComputedStyle(document.body).getPropertyValue("--mono") || "monospace"}`;
    ctx.fillStyle = col;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(txt, x, y);
  }
  function hex(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      ctx[i ? "lineTo" : "moveTo"](x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  requestAnimationFrame(frame);
  // in reduced-motion mode, redraw once probes settle so status colors update
  if (reduced) setTimeout(() => requestAnimationFrame(frame), 5500);
})();
