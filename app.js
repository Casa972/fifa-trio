const PLAYERS = ["Steeve", "Noham", "Luc"];
const KEY = "fifa-trio-v1";
const FB_KEY = "fifa-trio-fb-url";
const FB_DEFAULT = "https://fifa-trio-default-rtdb.firebaseio.com";
const $ = (id) => document.getElementById(id);
const state = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { matches: [], deleted: [] };
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.matches)) return { matches: [], deleted: [] };
    return { matches: data.matches.filter(validMatch), deleted: Array.isArray(data.deleted) ? data.deleted : [] };
  } catch (e) { return { matches: [], deleted: [] }; }
}
function validMatch(m) {
  return m && PLAYERS.includes(m.p1) && PLAYERS.includes(m.p2) && m.p1 !== m.p2 && Number.isInteger(m.s1) && Number.isInteger(m.s2) && m.s1 >= 0 && m.s2 >= 0 && typeof m.id === "string";
}
function save() { localStorage.setItem(KEY, JSON.stringify(state)); cloudPush(); }
function fbBase() { return (localStorage.getItem(FB_KEY) || FB_DEFAULT || "").trim().replace(/\/+$/, "").replace(/:null$/, ""); }
function setSync(text, on) { const el = $("syncLabel"); if (!el) return; el.textContent = text; el.classList.toggle("on", !!on); }
function asList(x) { if (Array.isArray(x)) return x; if (x && typeof x === "object") return Object.values(x); return []; }
function mergeCloud(remote) {
  if (!remote || typeof remote !== "object") return false;
  const remoteMatches = asList(remote.matches);
  const deleted = new Set([...(state.deleted || []), ...asList(remote.deleted)]);
  const seen = new Set(state.matches.map((m) => m.id));
  let changed = false;
  remoteMatches.filter(validMatch).forEach((m) => { if (!seen.has(m.id) && !deleted.has(m.id)) { state.matches.push(m); seen.add(m.id); changed = true; } });
  const before = state.matches.length;
  state.matches = state.matches.filter((m) => !deleted.has(m.id));
  if (state.matches.length !== before) changed = true;
  state.deleted = Array.from(deleted);
  return changed;
}
async function cloudPull() {
  const base = fbBase(); if (!base) { setSync("Cloud : en attente"); return; }
  try {
    const res = await fetch(base + "/league.json"); if (!res.ok) throw new Error("http");
    const data = await res.json();
    if (mergeCloud(data || { matches: [] })) { localStorage.setItem(KEY, JSON.stringify(state)); renderRank(); renderHist(); }
    setSync("Cloud : en ligne", true);
  } catch (e) { setSync("Cloud : hors ligne"); }
}
async function cloudPush() {
  const base = fbBase(); if (!base) return;
  try {
    const res = await fetch(base + "/league.json");
    const remote = res.ok ? await res.json() : { matches: [], deleted: [] };
    mergeCloud(remote || { matches: [] });
    await fetch(base + "/league.json", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matches: state.matches, deleted: state.deleted || [], updatedAt: Date.now() }) });
    localStorage.setItem(KEY, JSON.stringify(state));
    setSync("Cloud : en ligne", true);
  } catch (e) { setSync("Cloud : hors ligne"); }
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function compute() {
  const table = {};
  PLAYERS.forEach((p) => { table[p] = { name: p, j: 0, g: 0, n: 0, p: 0, bp: 0, bc: 0, diff: 0, pts: 0 }; });
  state.matches.forEach((m) => {
    const a = table[m.p1], b = table[m.p2]; a.j++; b.j++; a.bp += m.s1; a.bc += m.s2; b.bp += m.s2; b.bc += m.s1;
    if (m.s1 > m.s2) { a.g++; b.p++; a.pts += 3; } else if (m.s1 < m.s2) { b.g++; a.p++; b.pts += 3; } else { a.n++; b.n++; a.pts += 1; b.pts += 1; }
  });
  PLAYERS.forEach((p) => { table[p].diff = table[p].bp - table[p].bc; });
  return PLAYERS.map((p) => table[p]).sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.bp - a.bp || a.name.localeCompare(b.name));
}
function fillSelects() {
  $("p1").innerHTML = PLAYERS.map((p) => `<option value="${p}">${p}</option>`).join("");
  $("p2").innerHTML = PLAYERS.map((p) => `<option value="${p}">${p}</option>`).join("");
  $("p1").value = "Steeve"; $("p2").value = "Noham";
}
function renderRank() {
  const rows = compute(); const medals = ["\uD83E\uDD47", "\uD83E\uDD48", "\uD83E\uDD49"]; const order = [rows[1], rows[0], rows[2]];
  $("podium").innerHTML = order.map((r, i) => { const real = i === 1 ? 0 : i === 0 ? 1 : 2; return `<div class="${real === 0 ? "pod first" : "pod"}"><div class="medal">${medals[real]}</div><div class="name">${r.name}</div><div class="pts">${r.pts} pts</div><div class="sub">${r.g}V · ${r.n}N · ${r.p}D</div></div>`; }).join("");
  $("tableBody").innerHTML = rows.map((r, i) => `<div class="row"><div class="rank">${i + 1}</div><div class="pname"><span class="av ${r.name}">${r.name[0]}</span>${r.name}</div><div class="muted">${r.j}</div><div class="muted">${r.g}</div><div class="muted">${r.n}</div><div class="muted">${r.diff > 0 ? "+" + r.diff : r.diff}</div><div class="pts-cell">${r.pts}</div></div>`).join("");
}
function renderHist() {
  const list = $("histList");
  if (!state.matches.length) { list.innerHTML = `<div class="empty">Aucun match pour le moment.<br>Ajoute le premier résultat ⚽</div>`; return; }
  list.innerHTML = [...state.matches].sort((a, b) => (b.ts || 0) - (a.ts || 0)).map((m) => {
    const date = new Date(m.ts || Date.now()).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    return `<div class="match"><div class="m-main"><div class="m-date">${date}</div><div class="m-score">${m.p1} <b>${m.s1} – ${m.s2}</b> ${m.p2}</div></div><button class="del" type="button" data-id="${m.id}">Suppr.</button></div>`;
  }).join("");
}
function show(tab) {
  document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.tab === tab));
  $("panel-" + tab).classList.add("active");
}
function clampScore(n) { n = parseInt(n, 10); if (!Number.isFinite(n) || n < 0) n = 0; if (n > 99) n = 99; return n; }
function setScore(id, val) { $(id).value = String(clampScore(val)); }
function flash(el, msg) { el.textContent = msg; el.style.display = "block"; setTimeout(() => { el.style.display = "none"; }, 2200); }
function addMatch() {
  const p1 = $("p1").value, p2 = $("p2").value, s1 = clampScore($("s1").value), s2 = clampScore($("s2").value);
  if (p1 === p2) return flash($("err"), "Choisis deux joueurs différents.");
  state.matches.push({ id: uid(), ts: Date.now(), p1, p2, s1, s2 });
  save(); setScore("s1", 0); setScore("s2", 0); renderRank(); renderHist(); flash($("ok"), "Match enregistré.");
}
function encodeShare() { return btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, matches: state.matches })))); }
function importShare(raw) {
  const parsed = JSON.parse(decodeURIComponent(escape(atob(raw.trim()))));
  if (!parsed || !Array.isArray(parsed.matches)) throw new Error("Code invalide.");
  const seen = new Set(state.matches.map((m) => m.id)); let added = 0;
  parsed.matches.filter(validMatch).forEach((m) => { if (!seen.has(m.id)) { state.matches.push(m); seen.add(m.id); added++; } });
  save(); renderRank(); renderHist(); return added;
}
document.querySelectorAll(".tab").forEach((btn) => btn.addEventListener("click", () => show(btn.dataset.tab)));
document.querySelectorAll(".step").forEach((btn) => btn.addEventListener("click", () => setScore(btn.dataset.target, clampScore($(btn.dataset.target).value) + Number(btn.dataset.delta))));
["s1", "s2"].forEach((id) => $(id).addEventListener("input", () => setScore(id, $(id).value.replace(/\D/g, ""))));
$("saveBtn").addEventListener("click", addMatch);
$("histList").addEventListener("click", (e) => {
  const btn = e.target.closest(".del"); if (!btn) return; if (!confirm("Supprimer ce match ?")) return;
  if (!Array.isArray(state.deleted)) state.deleted = []; state.deleted.push(btn.dataset.id);
  state.matches = state.matches.filter((m) => m.id !== btn.dataset.id); save(); renderRank(); renderHist();
});
$("menuBtn").addEventListener("click", () => $("modal").classList.add("show"));
$("closeModal").addEventListener("click", () => $("modal").classList.remove("show"));
$("modal").addEventListener("click", (e) => { if (e.target === $("modal")) $("modal").classList.remove("show"); });
$("exportBtn").addEventListener("click", async () => { const code = encodeShare(); $("shareBox").value = code; try { await navigator.clipboard.writeText(code); $("exportBtn").textContent = "Copié !"; setTimeout(() => { $("exportBtn").textContent = "Copier le code"; }, 1500); } catch (e) {} });
$("importBtn").addEventListener("click", () => { try { alert(importShare($("shareBox").value) + " match(s) importé(s)."); } catch (e) { alert("Import impossible."); } });
$("resetBtn").addEventListener("click", () => {
  if (!confirm("Effacer tous les matchs de ce téléphone ?")) return;
  if (!Array.isArray(state.deleted)) state.deleted = [];
  state.matches.forEach((m) => state.deleted.push(m.id)); state.matches = []; save(); renderRank(); renderHist(); $("modal").classList.remove("show");
});
if ($("fbUrl")) $("fbUrl").value = fbBase();
if ($("saveFb")) $("saveFb").addEventListener("click", () => {
  const url = ($("fbUrl").value || "").trim().replace(/\/+$/, "");
  localStorage.setItem(FB_KEY, url || FB_DEFAULT); $("modal").classList.remove("show"); cloudPush().then(cloudPull);
});
fillSelects(); renderRank(); renderHist(); cloudPull(); setInterval(cloudPull, 4000);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
