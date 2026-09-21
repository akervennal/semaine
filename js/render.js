// render.js — tout ce qui touche au DOM. Rendu integral par innerHTML :
// l'application est assez petite pour que ce soit instantane, et ca evite
// une couche de reconciliation. La position de defilement est preservee.

import { esc } from "./model.js";
import { shoppingList, remaining, pruneChecked, categoryOf, groupOf } from "./shopping.js";
import { ui } from "./uistate.js";
import { HEADS, VIEWS } from "./views.js";
import { SHEETS } from "./sheets.js";

const $ = sel => document.querySelector(sel);

export function render() {
  const y = window.scrollY;
  // Un ingredient qui disparait de la semaine (repas retire, repas supprime...)
  // doit oublier sa case cochee tout de suite, pas seulement en rouvrant Courses.
  pruneChecked(shoppingList());
  $("#topbar").innerHTML = `<div class="wrap">${HEADS[ui.tab]()}</div>`;
  $("#view").innerHTML = VIEWS[ui.tab]();
  renderTabbar();
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

  // Un re-rendu de feuille remplace tout le contenu : sans ca, la liste du
  // picker (ou toute autre liste scrollable de la feuille) sauterait en haut
  // a chaque interaction (deplier un repas, regler les personnes...).
  const prevBody = root.querySelector(".sheet-body");
  const scrollY = prevBody ? prevBody.scrollTop : 0;

  root.innerHTML = SHEETS[ui.sheet.type](ui.sheet);

  const body = root.querySelector(".sheet-body");
  if (body) body.scrollTop = scrollY;

  document.body.classList.add("locked");
  scrim.classList.add("on");
  if (animate) requestAnimationFrame(() => root.classList.add("on"));
  else root.classList.add("on");

  // La ligne de repas qui vient de se deplier demarre fermee (voir sheets.js) :
  // on la laisse s'ouvrir en douceur au lieu d'apparaitre d'un coup. Mais pas
  // a chaque re-rendu (regler le nombre de personnes ne doit pas la rejouer).
  if (ui.pick && !ui.pick.opened) {
    const acc = root.querySelector(".acc.pick:not(.open)");
    if (acc) requestAnimationFrame(() => acc.classList.add("open"));
    ui.pick.opened = true;
  }

  // Le repas tout juste ajoute demarre plie (voir sheets.js) : on le laisse
  // s'installer en douceur dans "Au menu" plutot que d'apparaitre d'un coup.
  if (ui.justAdded) {
    const acc = root.querySelector(".acc.menu:not(.open)");
    if (acc) requestAnimationFrame(() => acc.classList.add("open"));
    ui.justAdded = null;
  }

  // Le nombre de personnes qui vient de changer (picker ou "Au menu") pulse
  // brievement au lieu de changer silencieusement.
  if ((ui.pick && ui.pick.bump) || ui.menuBump) {
    const b = root.querySelector(".count-value.bump");
    if (b) requestAnimationFrame(() => b.classList.remove("bump"));
    if (ui.pick) ui.pick.bump = false;
    ui.menuBump = null;
  }
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
  ui.pickQuery = "";
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
// Les articles coches glissent en fin DE LEUR RAYON (FLIP : on mesure avant,
// on reordonne le DOM, puis on anime depuis l'ancienne position). Les autres
// rayons ne sont pas touches.
export function refreshCheck(el) {
  const item = el.closest(".item");
  const wrap = item && item.closest(".cat-items");
  const items = wrap ? [...wrap.children] : [];
  const before = new Map(items.map(it => [it, it.getBoundingClientRect()]));

  item.classList.toggle("done");
  el.setAttribute("aria-pressed", item.classList.contains("done"));

  const list = shoppingList();

  if (wrap) {
    const byKey = new Map(items.map(it => [it.dataset.key, it]));
    groupOf(list, categoryOf(item.dataset.key)).forEach(i => {
      const node = byKey.get(i.key);
      if (node) wrap.appendChild(node);
    });
    items.forEach(it => {
      const dy = before.get(it).top - it.getBoundingClientRect().top;
      if (!dy) return;
      it.classList.add("sliding");
      it.style.transition = "none";
      it.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => {
        it.style.transition = "transform .32s cubic-bezier(.2,.7,.3,1)";
        it.style.transform = "";
      });
      it.addEventListener("transitionend", () => {
        it.style.transition = it.style.transform = "";
        it.classList.remove("sliding");
      }, { once: true });
    });
  }

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
