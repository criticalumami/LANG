// LANG // renders data.json (written hourly by Billy's server: site_export.py in gemini-telegram-bot).
"use strict";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Target-language text: isolated for mixed Hebrew/Latin lines, Hebrew font for Hebrew.
const t = (s, lang) => `<bdi dir="auto"${lang === "he" ? ' lang="he"' : ""}>${esc(s)}</bdi>`;
const bar = (done, total, width = 20) => {
  const n = total ? Math.round((width * done) / total) : 0;
  return `<span class="bar">${"█".repeat(n)}${"░".repeat(width - n)}</span>`;
};
const pct = (v) => (v == null ? "–" : `${v}%`);
const mark = (v) => (v == null ? "⬜" : v >= 75 ? "✅" : v >= 50 ? "🟡" : "❌");
const fmtDate = (d) => (d ? new Date(d + "T12:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "–");

let DATA = null;
let LANG_FILTER = "all";
try { LANG_FILTER = localStorage.getItem("lang-filter") || "all"; } catch (e) {}

const langs = () => Object.entries(DATA.langs).filter(([code]) => LANG_FILTER === "all" || LANG_FILTER === code);
const byLang = (rows) => rows.filter((r) => LANG_FILTER === "all" || r.lang === LANG_FILTER);

function chart(scores) {
  if (!scores.length) return '<p class="dim">No graded quizzes yet.</p>';
  const W = 600, H = 140, P = 22;
  const xs = scores.map((_, i) => P + (scores.length === 1 ? 0 : (i * (W - 2 * P)) / (scores.length - 1)));
  const ys = scores.map((s) => H - P - ((H - 2 * P) * s.score) / 100);
  const grid = [0, 50, 75, 100].map((v) => {
    const y = H - P - ((H - 2 * P) * v) / 100;
    return `<line class="grid" x1="${P}" x2="${W - 4}" y1="${y}" y2="${y}"/><text x="2" y="${y + 3}">${v}</text>`;
  }).join("");
  const pts = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const dots = xs.map((x, i) => `<circle cx="${x.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="2.5"><title>${esc(scores[i].date)} · ${esc(scores[i].kind)} · ${scores[i].score}%</title></circle>`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Quiz scores over time">${grid}<polyline points="${pts}"/>${dots}</svg>`;
}

function renderStatus() {
  const out = langs().map(([code, L]) => {
    const c = L.current;
    const avg = (rows) => (rows.length ? Math.round(rows.reduce((a, s) => a + s.score, 0) / rows.length) : null);
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    const thisWeek = avg(L.scores.filter((s) => s.date > weekAgo));
    const levels = L.levels.map((l) => `<tr><td>${esc(l.level)}</td><td>${bar(l.done, l.total)}</td><td class="num">${l.done}/${l.total}</td></tr>`).join("");
    const mod = L.modules.find((m) => m.status === "current");
    return `<div class="panel">
      <h1>${esc(L.flag)} ${esc(L.name)}</h1>
      <dl class="kv">
        <dt>now</dt><dd><b>${esc(c.module)} · unit ${c.number}/${c.of}</b> · ${t(c.title, code)}</dd>
        <dt>module</dt><dd>${mod ? esc(mod.title) : "–"}</dd>
        <dt>objective</dt><dd>${esc(c.objective || "–")}</dd>
        <dt>reading</dt><dd>${esc(c.book || "–")}</dd>
        <dt>course</dt><dd>${L.done_pct}% done · ${L.remaining_units} units to C1</dd>
        <dt>pace</dt><dd>${L.pace != null ? `${L.pace} units/week` : "measured after a week"} · C1 ≈ ${fmtDate(L.eta)}</dd>
        <dt>quizzes</dt><dd>${L.scores.length} graded · this week ${pct(thisWeek)} · all-time ${pct(avg(L.scores))}</dd>
        <dt>flashcards</dt><dd>${L.cards.boxes.reduce((a, b) => a + b, 0)} cards · ${L.cards.due} due · boxes 1–5: ${L.cards.boxes.join(" / ")}</dd>
        <dt>level tests</dt><dd>${L.level_tests.length ? L.level_tests.map((x) => `${esc(x.est_level)} (${esc(x.local_date)})`).join(", ") : "none yet"}</dd>
      </dl>
      <h2>levels</h2><table>${levels}</table>
      <h2>quiz scores</h2>${chart(L.scores)}
    </div>`;
  });
  return `<div class="grid">${out.join("")}</div>`;
}

function renderWeak() {
  return `<div class="grid">${langs().map(([code, L]) => `<div class="panel">
    <h1>${esc(L.flag)} ${esc(L.name)} · difficulties</h1>
    <h2>topics with the most mistakes</h2>
    ${L.weak_topics.length ? `<table><tr><th>topic</th><th class="num">mistakes</th></tr>${L.weak_topics.map((w) => `<tr><td>${t(w.topic, code)}</td><td class="num">${w.n}</td></tr>`).join("")}</table>` : '<p class="dim">none yet</p>'}
    <h2>hardest flashcards (box 1)</h2>
    ${L.cards.hard.length ? `<table><tr><th>prompt</th><th>answer</th><th>type</th></tr>${L.cards.hard.map((h) => `<tr><td>${t(h.front, code)}</td><td>${t(h.back, code)}</td><td>${esc(h.source)}</td></tr>`).join("")}</table>` : '<p class="dim">none</p>'}
    <h2>recent mistakes</h2>
    ${L.mistakes.length ? `<div class="table-wrap"><table><tr><th>date</th><th>wrote</th><th>correct</th><th>rule</th></tr>${L.mistakes.map((m) => `<tr><td class="num">${esc(m.local_date)}</td><td><s>${t(m.wrong, code)}</s></td><td><b>${t(m.correct, code)}</b></td><td>${esc(m.rule)}</td></tr>`).join("")}</table></div>` : '<p class="dim">none yet</p>'}
  </div>`).join("")}</div>`;
}

function renderSyllabus() {
  return langs().map(([code, L]) => `<div class="panel" style="margin-bottom:12px">
    <h1>${esc(L.flag)} ${esc(L.name)} · syllabus</h1>
    ${L.modules.map((m) => `<details ${m.status === "current" ? "open" : ""}>
      <summary><b>${esc(m.code)}</b> <span>${t(m.title, code)}</span> <span class="tag">${esc(m.level)}</span>
        <span class="tag ${m.status === "current" ? "solid" : ""}">${m.status}</span>
        ${m.grade ? `<span class="tag solid">grade ${esc(m.grade.grade)} · ${m.grade.score}%</span>` : ""}
        <span class="dim">${m.units.length} units</span></summary>
      <div class="body table-wrap"><table>
        <tr><th class="num">#</th><th>unit</th><th>objective</th><th>reading</th></tr>
        ${m.units.map((u) => `<tr class="${u.status === "current" ? "current" : u.status === "next" ? "next" : ""}"><td class="num">${u.status === "done" ? "✓" : u.number}</td><td>${t(u.title, code)}</td><td>${esc(u.objective)}</td><td>${esc(u.book)}</td></tr>`).join("")}
      </table><p class="dim">ends with a module exam (20 items + writing, graded A–F, pass from 60%)</p></div>
    </details>`).join("")}
  </div>`).join("");
}

function lessonBody(l) {
  const x = l.lesson, code = l.lang, k = code;
  const val = (o) => o?.[k] ?? o?.de ?? o?.he ?? "";
  const vocab = (x.vocab || []).map((v) => `<tr><td>${t(val(v), code)}</td><td>${esc(v.tr || "")}</td><td>${esc(v.en)}</td><td>${v.ar ? t(v.ar) : ""}</td></tr>`).join("");
  const g = x.grammar || {};
  return `<p><b>goal:</b> ${esc(x.goal)}</p>
    <h2>vocabulary</h2><div class="table-wrap"><table>${vocab}</table></div>
    <h2>grammar · ${esc(g.name)}</h2><p>${esc(g.explanation)}</p>${g.pattern ? `<pre>${t(g.pattern, code)}</pre>` : ""}
    <ul>${(g.examples || []).map((e) => `<li>${t(val(e), code)} — <i>${esc(e.en)}</i></li>`).join("")}</ul>
    <h2>reading · ${t(x.text?.title, code)}</h2><p>${t(val(x.text || {}), code)}</p><p class="dim">${esc(x.text?.en_gist)}</p>
    ${(x.phrases || []).length ? `<h2>phrases</h2><ul>${x.phrases.map((p) => `<li>${t(val(p), code)} — <i>${esc(p.en)}</i></li>`).join("")}</ul>` : ""}
    ${x.exam_tip ? `<p>💡 ${esc(x.exam_tip)}</p>` : ""}`;
}

function renderLessons() {
  const rows = byLang(DATA.lessons).slice().reverse();
  if (!rows.length) return '<p class="dim">No lessons yet.</p>';
  return `<h1>lessons (${rows.length})</h1>` + rows.map((l) => `<details>
    <summary><span class="num">${esc(l.date)}</span> <span>${esc(DATA.langs[l.lang]?.flag || l.lang)}</span>
      <b>${l.unit ? `${esc(l.unit.module)}.${l.unit.number}` : "material"}</b> ${t(l.lesson.title, l.lang)}
      <span class="dim">${l.unit ? esc(l.unit.title) : ""}</span></summary>
    <div class="body">${lessonBody(l)}</div></details>`).join("");
}

function renderQuizzes() {
  const rows = byLang(DATA.quizzes).slice().reverse();
  if (!rows.length) return '<p class="dim">No quizzes yet.</p>';
  return `<h1>quizzes &amp; tests (${rows.length})</h1>` + rows.map((q) => {
    const results = Object.fromEntries((q.results || []).map((r) => [r.n, r]));
    const items = q.items.map((it, i) => {
      const r = results[i + 1];
      return `<tr><td class="num">${r ? (r.ok ? "✔" : "✘") : ""} ${i + 1}</td><td>${t(it.q, q.lang)}</td>
        <td>${it.a != null ? t(r && !r.ok && r.correction ? r.correction : it.a, q.lang) : '<span class="dim">after grading</span>'}</td>
        <td class="dim">${esc(r?.note || "")}</td></tr>`;
    }).join("");
    return `<details><summary><span>${esc(q.date)}</span> <span>${esc(DATA.langs[q.lang]?.flag || q.lang)}</span>
        <b>${esc(q.kind)}</b> ${t(q.lesson_title || q.topic, q.lang)} <span>${mark(q.score)} ${pct(q.score)}</span></summary>
      <div class="body">${q.tip ? `<p class="muted">${esc(q.tip)}</p>` : ""}
        ${q.summary ? `<p><b>feedback:</b> ${esc(q.summary)}</p>` : q.score == null ? '<p class="dim">open: answer it in Telegram or Obsidian</p>' : ""}
        <div class="table-wrap"><table><tr><th class="num">#</th><th>question</th><th>answer</th><th>note</th></tr>${items}</table></div>
        ${q.answer ? `<h2>my answers</h2><pre>${t(q.answer, q.lang)}</pre>` : ""}</div></details>`;
  }).join("");
}

function renderTranscript() {
  return `<div class="grid">${langs().map(([code, L]) => {
    const graded = L.modules.filter((m) => m.grade);
    return `<div class="panel"><h1>${esc(L.flag)} ${esc(L.name)} · transcript</h1>
      <table><tr><th>module</th><th>title</th><th>level</th><th>grade</th><th class="num">score</th><th>date</th></tr>
      ${L.modules.map((m) => `<tr class="${m.status === "next" ? "next" : m.status === "current" ? "current" : ""}"><td>${esc(m.code)}</td><td>${t(m.title, code)}</td><td>${esc(m.level)}</td>
        <td>${m.grade ? `<b>${esc(m.grade.grade)}</b>` : m.status === "current" ? "in progress" : "–"}</td>
        <td class="num">${m.grade ? m.grade.score + "%" : ""}</td><td>${m.grade ? esc(m.grade.date) : ""}</td></tr>`).join("")}
      </table>
      <p class="dim">${graded.length} of ${L.modules.length} modules graded · A ≥90 · B ≥80 · C ≥70 · D ≥60 · F &lt;60</p></div>`;
  }).join("")}</div>`;
}

const RENDER = { status: renderStatus, weak: renderWeak, syllabus: renderSyllabus, lessons: renderLessons, quizzes: renderQuizzes, transcript: renderTranscript };

function show(tab) {
  document.querySelectorAll(".dwm-tag").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
  document.querySelectorAll("section[data-panel]").forEach((s) => {
    s.hidden = s.dataset.panel !== tab;
    if (!s.hidden) s.innerHTML = RENDER[tab]();
  });
  try { localStorage.setItem("tab", tab); } catch (e) {}
  history.replaceState(null, "", "#" + tab);
}

function current() {
  return document.querySelector('.dwm-tag[aria-selected="true"]')?.dataset.tab || "status";
}

async function main() {
  try {
    DATA = await (await fetch("data.json", { cache: "no-cache" })).json();
  } catch (e) {
    document.querySelector("main").innerHTML = '<p>Could not load data.json.</p>';
    return;
  }
  document.getElementById("generated").textContent = "updated " + DATA.generated.replace("T", " ").slice(0, 16);
  const sel = document.getElementById("lang");
  sel.value = LANG_FILTER;
  sel.addEventListener("change", () => {
    LANG_FILTER = sel.value;
    try { localStorage.setItem("lang-filter", LANG_FILTER); } catch (e) {}
    show(current());
  });
  document.querySelectorAll(".dwm-tag").forEach((b) => b.addEventListener("click", () => show(b.dataset.tab)));
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, select, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
    const tab = document.querySelectorAll(".dwm-tag")[Number(e.key) - 1];
    if (tab) show(tab.dataset.tab);
  });
  document.getElementById("theme").addEventListener("click", () => {
    const meta = document.querySelector('meta[name="color-scheme"]');
    const dark = meta.content === "dark" || (meta.content === "light dark" && matchMedia("(prefers-color-scheme: dark)").matches);
    meta.content = dark ? "light" : "dark";
    try { localStorage.setItem("color-scheme", meta.content); } catch (e) {}
  });
  let tab = location.hash.slice(1);
  if (!RENDER[tab]) { try { tab = localStorage.getItem("tab"); } catch (e) {} }
  show(RENDER[tab] ? tab : "status");
}

main();
