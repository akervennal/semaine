// views.js — les quatre ecrans. Chaque fonction rend une chaine HTML,
// sans effet de bord : les interactions passent par des attributs data-act
// que actions.js intercepte par delegation.

import { MOMENTS, slotLabel, orderedDays, parseIso, addDays, fmtShort, weekRange, esc, normKey } from "./model.js";
import { state, mealById, plannedCount, canPersist } from "./store.js";
import { shoppingList, doneCount, groupForDisplay, categoryOf } from "./shopping.js";
import { ui } from "./uistate.js";

/* ============================ en-tetes ============================ */

export const HEADS = {
  semaine() {
    const n = plannedCount();
    return `<div><h1>Semaine</h1><p class="sub">${esc(weekRange(state.week.start))} · ${n} repas planifié${n > 1 ? "s" : ""}</p></div>`;
  },

  repas() {
    return `<div><h1>Repas</h1><p class="sub">${state.meals.length} repas dans la bibliothèque</p></div>
      <button class="add" data-act="new-meal" aria-label="Créer un repas">+</button>`;
  },

  courses() {
    const list = shoppingList();
    const done = doneCount(list);
    return `<div><h1>Courses</h1><p class="sub">${list.length ? `${list.length - done} à prendre · ${done} pris` : "Générée depuis la semaine"}</p></div>
      ${done ? `<button class="btn quiet btn-sm" data-act="reset-checks">Tout décocher</button>` : ""}`;
  },

  plus() {
    return `<div><h1>Plus</h1><p class="sub">Semaine, historique et données</p></div>`;
  }
};

/* ============================ ecrans ============================ */

export const VIEWS = {

  /* ---------------- Semaine ---------------- */
  semaine() {
    const start = parseIso(state.week.start);
    let html = "";

    orderedDays(state.week.start).forEach((d, i) => {
      const date = addDays(start, i);
      html += `<section class="card">
        <div class="card-head"><span class="eyebrow">${esc(d.n)}</span><span class="d">${esc(fmtShort(date))}</span></div>
        ${MOMENTS.map(m => {
          const id = d.k + "-" + m.k;
          const names = (state.week.slots[id] || []).map(p => {
            const meal = mealById(p.mealId);
            return meal ? esc(meal.name) + (p.people ? " (" + p.people + " pers.)" : "") : "";
          }).filter(Boolean);
          return `<button class="row" data-act="slot" data-slot="${id}">
            <span class="slot">${esc(m.n)}</span>
            <span class="body">
              <span class="title${names.length ? "" : " empty"}">${names.length ? names.join(" · ") : "Ajouter un repas"}</span>
            </span>
            <span class="chev">›</span>
          </button>`;
        }).join("")}
      </section>`;
    });

    if (!state.meals.length) {
      html = `<div class="card"><div class="empty"><strong>Commencez par vos repas</strong>
        La semaine se remplit avec les repas de votre bibliothèque.
        <button class="btn" data-act="tab" data-tab="repas">Ouvrir la bibliothèque</button></div></div>` + html;
    }
    return html;
  },

  /* ---------------- Repas ---------------- */
  repas() {
    if (!state.meals.length) {
      return `<div class="card"><div class="empty"><strong>Votre bibliothèque est vide</strong>
        Ajoutez les plats que vous savez faire. Un nom, quelques ingrédients, sans quantités.
        <div class="btn-row" style="margin-top:16px;justify-content:center">
          <button class="btn" data-act="new-meal" style="width:auto">Créer un repas</button>
          <button class="btn ghost" data-act="seed" style="width:auto">Charger 6 exemples</button>
        </div></div></div>`;
    }
    return `<div class="search">
        <span style="color:var(--pencil);font-size:14px" aria-hidden="true">⌕</span>
        <input id="q" type="search" placeholder="Rechercher un repas" value="${esc(ui.query)}"
               autocomplete="off" autocapitalize="off" aria-label="Rechercher un repas">
      </div>
      <div id="meal-list">${mealList()}</div>`;
  },

  /* ---------------- Courses ---------------- */
  courses() {
    const list = shoppingList();

    if (!list.length) {
      return `<div class="card"><div class="empty"><strong>Rien à acheter</strong>
        Planifiez des repas dans la semaine : la liste se remplit toute seule, sans doublons.
        <button class="btn" data-act="tab" data-tab="semaine">Voir la semaine</button></div></div>`;
    }

    const done = doneCount(list);
    return `<div class="progress"><span>${done}/${list.length}</span><span class="bar"><i style="width:${Math.round(done / list.length * 100)}%"></i></span></div>
      <div class="card paper">${groupForDisplay(list).map(catGroupHtml).join("")}</div>
      <p class="sub" style="text-align:center;margin-top:14px">Chaque ingrédient indique le jour et le repas qui le réclament. Touchez le rayon pour le classer.</p>`;
  },

  /* ---------------- Plus ---------------- */
  plus() {
    const h = state.history;
    return `<section class="card">
        <div class="card-head"><span class="eyebrow">Semaine en cours</span></div>
        <div style="padding:14px">
          <label class="field" style="margin-bottom:14px">
            <span class="eyebrow">Premier jour de la semaine</span>
            <input class="input" type="date" id="wstart" value="${esc(state.week.start)}">
          </label>
          <button class="btn danger" data-act="end-week">Terminer la semaine</button>
          <p class="sub" style="margin-top:8px">La semaine actuelle sera archivée et une nouvelle semaine vide pourra être créée. La bibliothèque de repas reste intacte.</p>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><span class="eyebrow">Historique</span></div>
        <button class="row" data-act="archive">
          <span class="body"><span class="title">Archive</span>
          <span class="meta">${h.length ? h.length + " semaine" + (h.length > 1 ? "s" : "") + " archivée" + (h.length > 1 ? "s" : "") : "Aucune semaine archivée"}</span></span>
          <span class="chev">›</span>
        </button>
      </section>

      <section class="card">
        <div class="card-head"><span class="eyebrow">Données</span></div>
        <button class="row" data-act="export"><span class="body"><span class="title">Exporter en fichier</span><span class="meta">Sauvegarde de vos repas et de la semaine</span></span><span class="chev">›</span></button>
        <button class="row" data-act="import"><span class="body"><span class="title">Importer un fichier</span><span class="meta">Remplace le contenu actuel</span></span><span class="chev">›</span></button>
        ${state.meals.length ? "" : `<button class="row" data-act="seed"><span class="body"><span class="title">Charger 6 exemples</span></span><span class="chev">›</span></button>`}
        <button class="row" data-act="wipe"><span class="body"><span class="title" style="color:var(--red)">Tout effacer</span></span></button>
      </section>

      <p class="sub" style="text-align:center;margin-top:16px;line-height:1.5">
        ${canPersist()
          ? "Tout est enregistré sur cet appareil, rien ne part sur Internet."
          : "Attention : ce navigateur bloque l'enregistrement. Vos données disparaîtront à la fermeture de l'onglet."}
      </p>`;
  }
};

/* ============================ fragments ============================ */

// Un groupe = un rayon : l'entete est immobile, seuls les articles bougent
// (voir refreshCheck dans render.js, qui ne reordonne qu'un .cat-items a la fois).
function catGroupHtml(g) {
  return `<div class="cat-head">${esc(g.label)}</div>
    <div class="cat-items">${g.items.map(itemHtml).join("")}</div>`;
}

export function itemHtml(i) {
  const done = !!state.checked[i.key];
  const cat = categoryOf(i.key);
  return `<div class="item${done ? " done" : ""}" data-key="${esc(i.key)}">
    <button class="check" data-act="check" data-key="${esc(i.key)}" aria-pressed="${done}">
      <span class="box"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11"/></svg></span>
      <span class="name">${esc(i.name)}</span>
      <span class="ctx">${i.ctx.map(esc).join("<br>")}</span>
    </button>
    <button class="tag" data-act="cat-pick" data-key="${esc(i.key)}" data-name="${esc(i.name)}">${esc(cat || "Non classé")}</button>
  </div>`;
}

// Liste filtree par la recherche, favoris en tete.
export function mealList() {
  const q = normKey(ui.query);
  const meals = state.meals
    .filter(m => !q || normKey(m.name).includes(q) || (m.ingredients || []).some(x => normKey(x).includes(q)))
    .sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || a.name.localeCompare(b.name, "fr"));

  if (!meals.length) return `<div class="card"><div class="empty">Aucun repas ne correspond à « ${esc(ui.query)} ».</div></div>`;

  const favs = meals.filter(m => m.fav);
  const rest = meals.filter(m => !m.fav);
  const block = (arr, label) => !arr.length ? "" : `<section class="card">
      ${label ? `<div class="card-head"><span class="eyebrow">${label}</span></div>` : ""}
      ${arr.map(mealRow).join("")}</section>`;

  return block(favs, "Favoris") + block(rest, favs.length ? "Tous les repas" : "");
}

export function mealRow(m) {
  const ings = m.ingredients || [];
  return `<div class="row" style="padding-right:6px">
    <button class="body" data-act="meal" data-id="${m.id}" style="text-align:left;min-height:34px">
      <span class="title">${esc(m.name)}</span>
      <span class="meta">${esc(ings.slice(0, 4).join(", "))}${ings.length > 4 ? "…" : ""}</span>
    </button>
    <button class="star${m.fav ? " on" : ""}" data-act="fav" data-id="${m.id}" aria-label="Favori">${m.fav ? "★" : "☆"}</button>
  </div>`;
}
