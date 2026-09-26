// views.js — les quatre ecrans. Chaque fonction rend une chaine HTML,
// sans effet de bord : les interactions passent par des attributs data-act
// que actions.js intercepte par delegation.

import { MOMENTS, orderedDays, parseIso, addDays, esc, normKey, iso, cap } from "./model.js";
import { state, mealById, canPersist } from "./store.js";
import { shoppingList, doneCount, groupForDisplay, categoryOf } from "./shopping.js";
import { ui } from "./uistate.js";

/* ============================ en-tetes ============================ */

export const HEADS = {
  semaine() {
    return `<h1>Semaine</h1>`;
  },

  repas() {
    return `<h1>Repas</h1>
      <button class="add" data-act="new-meal" aria-label="Créer un repas">+</button>`;
  },

  courses() {
    const done = doneCount(shoppingList());
    return `<h1>Courses</h1>
      ${done ? `<button class="btn quiet btn-sm" data-act="reset-checks">Tout décocher</button>` : ""}`;
  },

  plus() {
    return `<h1>Plus</h1>`;
  }
};

/* ============================ ecrans ============================ */

export const VIEWS = {

  /* ---------------- Semaine ---------------- */
  // Agenda a bandes : une ligne par jour (date en badge + deux puces Midi/Soir),
  // toute la semaine tient sur un ecran sans defiler.
  semaine() {
    const start = parseIso(state.week.start);
    const todayIso = iso(new Date());

    const days = orderedDays(state.week.start).map((d, i) => {
      const date = addDays(start, i);
      const isToday = iso(date) === todayIso;

      const chips = MOMENTS.map(m => {
        const id = d.k + "-" + m.k;
        const names = (state.week.slots[id] || []).map(p => (mealById(p.mealId) || {}).name).filter(Boolean);
        const lines = names.length
          ? names.map(n => `<span class="ag-chip-line">${esc(n)}</span>`).join("")
          : `<span class="ag-chip-line empty">Ajouter</span>`;
        const full = d.n + " " + m.n.toLowerCase() + " : " + (names.length ? names.join(", ") : "libre");
        return `<button class="ag-chip${names.length ? "" : " empty"}" data-act="slot" data-slot="${id}" aria-label="${esc(full)}">
            <span class="ag-chip-label">${esc(m.n)}</span>
            ${lines}
          </button>`;
      }).join("");

      return `<div class="ag-day${isToday ? " today" : ""}">
          <div class="ag-date"><span class="ag-num">${date.getDate()}</span><span class="ag-dow">${esc(cap(d.k))}</span></div>
          <div class="ag-slots">${chips}</div>
        </div>`;
    }).join("");

    const agenda = `<div class="agenda">${days}</div>`;

    if (!state.meals.length) {
      return `<div class="card"><div class="empty"><strong>Commencez par vos repas</strong>
        La semaine se remplit avec les repas de votre bibliothèque.
        <button class="btn" data-act="tab" data-tab="repas">Ouvrir la bibliothèque</button></div></div>` + agenda;
    }
    return agenda;
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
      <div class="card paper">${groupForDisplay(list).map(catGroupHtml).join("")}</div>`;
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

// Un groupe = un rayon, ou la pile "Pris" (voir shopping.groupForDisplay).
// L'entete est immobile ; data-cat permet a refreshCheck (render.js) de
// retrouver le bon groupe pour y deplacer un article coche/decoche.
function catGroupHtml(g) {
  return `<div class="cat-head">${esc(g.label)}</div>
    <div class="cat-items" data-cat="${esc(g.key)}">${g.items.map(itemHtml).join("")}</div>`;
}

export function itemHtml(i) {
  const done = !!state.checked[i.key];
  const cat = categoryOf(i.key);
  // Une fois classe, le rayon est deja dit par l'entete du groupe : repeter
  // son nom sur chaque ligne serait redondant. On garde juste une petite
  // icone discrete pour pouvoir corriger. "Non classe" reste en toutes
  // lettres, pour qu'on pense a le ranger.
  const tag = cat
    ? `<button class="tag icon" data-act="cat-pick" data-key="${esc(i.key)}" data-name="${esc(i.name)}" aria-label="Changer de rayon (${esc(cat)})">⋯</button>`
    : `<button class="tag" data-act="cat-pick" data-key="${esc(i.key)}" data-name="${esc(i.name)}">Non classé</button>`;
  return `<div class="item${done ? " done" : ""}" data-key="${esc(i.key)}">
    <button class="check" data-act="check" data-key="${esc(i.key)}" aria-pressed="${done}">
      <span class="box"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11"/></svg></span>
      <span class="name">${esc(i.name)}</span>
      <span class="ctx">${i.ctx.map(esc).join("<br>")}</span>
    </button>
    ${tag}
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
