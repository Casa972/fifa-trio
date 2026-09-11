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
    return {
      matches: data.matches.filter(validMatch),
      deleted: Array.isArray(data.deleted) ? data.deleted : []
    };
  } catch (e) {
    return { matches: [], deleted: [] };
  }
}

function validMatch(m) {
  return m && PLAYERS.includes(m.p1) && PLAYERS.includes(m.p2) && m.p1 !== m.p2
    && Number.isInteger(m.s1) && Number.isInteger(m.s2) && m.s1 >= 0 && m.s2 >= 0
    && typeof m.id === "string";
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  cloudPush();
}
function fbBase() {
  const raw = (localStorage.getItem(FB_KEY) || FB_DEFAULT || "").trim().replace(/\/+$/, "").replace(/:null$/, "");
  return raw;
}
function setSync(text, on) {
  const el = $("syncLabel");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("on", !!on);
}
function asList(x) {
  if (Array.isArray(x)) return x;
  if (x && typeof x === "object") return Object.values(x);
  return [];
}
function mergeCloud(remote) {
  if (!remote || typeof remote !== "object") return false;
  const remoteMatches = asList(remote.matches);
  const deleted = new Set([...(state.deleted || []), ...asList(remote.deleted)]);
  const seen = new Set(state.matches.map((m) => m.id));
  let changed = false;
  remoteMatches.filter(validMatch).forEach((m) => {
    if (!seen.has(m.id) && !deleted.has(m.id)) {
      state.matches.push(m);
      seen.add(m.id);
      changed = true;
    }
  });
  const before = state.matches.length;
  state.matches = state.matches.filter((m) => !deleted.has(m.id));
  if (state.matches.length !== before) changed = true;
  state.deleted = Array.from(deleted);
  return changed;
}
async function cloudPull() {
  const base = fbBase();
  if (!base) { setSync("Cloud : en attente"); return; }
  try {
    const res = await fetch(base + "/league.json");
    if (!res.ok) throw new Error("http");
    const data = await res.json();
    if (mergeCloud(data || { matches: [] })) {
      localStorage.setItem(KEY, JSON.stringify(state));
      renderRank();
      renderHist();
    }
    setSync("Cloud : en ligne", true);
  } catch (e) {
    setSync("Cloud : hors ligne");
  }
}
async function cloudPush() {
  const base = fbBase();
  if (!base) return;
  try {
    const res = await fetch(base + "/league.json");
    const remote = res.ok ? await res.json() : { matches: [], deleted: [] };
    mergeCloud(remote || { matches: [] });
    await fetch(base + "/league.json", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matches: state.matches,
        deleted: state.deleted || [],
        updatedAt: Date.now()
      })
    });
    localStorage.setItem(KEY, JSON.stringify(state));
    setSync("Cloud : en ligne", true);
  } catch (e) {
    setSync("Cloud : hors ligne");
  }
}
