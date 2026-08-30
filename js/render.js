// render.js — tout ce qui touche au DOM. Rendu integral par innerHTML :
// l'application est assez petite pour que ce soit instantane, et ca evite
// une couche de reconciliation. La position de defilement est preservee.

import { esc } from "./model.js";
import { state } from "./store.js";
import { shoppingList, remaining } from "./shopping.js";
import { ui } from "./uistate.js";
import { HEADS, VIEWS } from "./views.js";
import { SHEETS } from "./sheets.js";

const $ = sel => document.querySelector(sel);

export function render() {
  const y = window.scrollY;
  $("#topbar").innerHTML = `<div class="wrap">${HEADS[ui.tab]()}</div>`;
  $("#view").innerHTML = VIEWS[ui.tab]();
  renderTabbar();
  renderSelbar();
  window.scrollTo(0, y);
}

const TABS = [
  ["semaine", "📅", "Semaine"],
  ["repas", "🍝", "Repas"],
  ["courses", "🛒", "Courses"],
  ["plus", "⋯", "Plus"]
];

export function renderTabbar() {
  const left = remaining(shoppingList());
  $("#tabbar").innerHTML = TABS.map(([k, ic, lb]) =>
    `<button data-act="tab" data-tab="${k}" class="${ui.tab === k ? "on" : ""}" style="position:relative"
             aria-current="${ui.tab === k ? "page" : "false"}">
      <span class="ic" aria-hidden="true">${ic}</span><span class="lb">${lb}</span>
      ${k === "courses" && left ? `<span class="dot"></span>` : ""}
    </button>`).join("");
}

// Barre flottante du mode selection multiple.
export function renderSelbar() {
  const old = $("#selbar");
  if (old) old.remove();
  if (ui.tab !== "repas" || !ui.selection || !ui.selection.size) return;

  const el = document.createElement("div");
  el.className = "selbar";
  el.id = "selbar";
  el.innerHTML = `<div class="wrap"><button class="btn" data-act="place-open">Ajouter à ma semaine (${ui.selection.size})</button></div>`;
  document.body.appendChild(el);
}

export function renderSheet(animate) {
  const root = $("#sheet");
  const scrim = $("#scrim");

  if (!ui.sheet) {
    root.classList.remove("on");
    scrim.classList.remove("on");
    document.body.classList.remove("locked");
    // On vide apres la transition de sortie, sauf si une autre feuille a rouvert entre-temps.
    setTimeout(() => { if (!ui.sheet) root.innerHTML = ""; }, 300);
    return;
  }

  root.innerHTML = SHEETS[ui.sheet.type](ui.sheet);
  document.body.classList.add("locked");
  scrim.classList.add("on");
  if (animate) requestAnimationFrame(() => root.classList.add("on"));
  else root.classList.add("on");
}

export function openSheet(sheet) {
  const fresh = !ui.sheet;      // n'animer que la premiere ouverture, pas les re-rendus
  ui.sheet = sheet;
  renderSheet(fresh);
}

export function closeSheet() {
  ui.sheet = null;
  ui.draft = null;
  ui.pick = null;
  renderSheet();
}

/* ---------- retours legers ---------- */

let toastTimer = null;
export function toast(msg) {
  const t = $("#toast");
  t.innerHTML = `<div class="toast">${esc(msg)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.innerHTML = ""), 1900);
}

let dialogResolve = null;
export const isDialogOpen = () => !!dialogResolve;

/**
 * Confirmation modale. `await ask({...})` renvoie true ou false.
 * @param {{title:string, text:string, ok?:string, danger?:boolean}} o
 */
export function ask(o) {
  return new Promise(resolve => {
    dialogResolve = resolve;
    $("#dialog").innerHTML =
      `<div class="dlg-scrim" data-act="dlg-no"><div class="dlg" role="alertdialog" aria-label="${esc(o.title)}">
        <h3>${esc(o.title)}</h3><p>${esc(o.text)}</p>
        <div class="btn-row">
          <button class="btn ghost" data-act="dlg-no">Annuler</button>
          <button class="btn" data-act="dlg-yes"${o.danger ? ' style="background:var(--red)"' : ""}>${esc(o.ok || "Confirmer")}</button>
        </div></div></div>`;
  });
}

export function closeDialog(value) {
  $("#dialog").innerHTML = "";
  if (dialogResolve) {
    dialogResolve(value);
    dialogResolve = null;
  }
}

// Mise a jour ciblee d'une ligne de courses : cocher ne doit pas
// reconstruire la liste ni faire sauter le defilement en plein magasin.
export function refreshCheck(el) {
  el.classList.toggle("done");
  el.setAttribute("aria-pressed", el.classList.contains("done"));

  const list = shoppingList();
  const done = list.length - remaining(list);
  const bar = $(".bar i");
  const label = $(".progress span");
  if (bar) bar.style.width = Math.round(done / list.length * 100) + "%";
  if (label) label.textContent = done + "/" + list.length;

  const sub = $(".topbar .sub");
  if (sub) sub.textContent = (list.length - done) + " à prendre · " + done + " pris";

  renderTabbar();

  const btn = $(".topbar [data-act='reset-checks']");
  if (done && !btn) {
    const b = document.createElement("button");
    b.className = "btn quiet btn-sm";
    b.dataset.act = "reset-checks";
    b.textContent = "Tout décocher";
    $(".topbar .wrap").appendChild(b);
  }
  if (!done && btn) btn.remove();
}
