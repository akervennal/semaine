// sheets.js — les panneaux qui montent du bas. Meme principe que les vues :
// des chaines HTML, pilotees par data-act.

import { MOMENTS, slotLabel, orderedDays, weekRange, parseIso, addDays, fmtShort, esc, normKey } from "./model.js";
import { state, mealById, slotsUsing } from "./store.js";
import { ui } from "./uistate.js";

export const SHEETS = {

  /* Composer un creneau : plusieurs repas possibles, chacun retirable independamment */
  slot(s) {
    const arr = state.week.slots[s.slot] || [];
    let body = "";

    if (arr.length) {
      body += `<section class="card">
        <div class="card-head"><span class="eyebrow">Au menu</span></div>
        ${arr.map((planned, i) => {
          const meal = mealById(planned.mealId);
          const justAdded = ui.justAdded && ui.justAdded.slot === s.slot && ui.justAdded.index === i;
          return `<div class="menu-item${justAdded ? " enter" : ""}" style="padding:13px 14px${i ? ";border-top:1px solid var(--line)" : ""}">
            <div style="font-size:19px;font-weight:700;letter-spacing:-.02em">${esc(meal.name)}</div>
            <div class="sub" style="margin-top:4px">${esc((meal.ingredients || []).join(" · ")) || "Aucun ingrédient"}</div>
            <div class="step" style="margin-top:14px">
              <b>${planned.people ? "Pour " + planned.people + " personne" + (planned.people > 1 ? "s" : "") : "Nombre de personnes"}</b>
              <button class="pm" data-act="people" data-slot="${s.slot}" data-i="${i}" data-d="-1" aria-label="Moins">−</button>
              <button class="pm" data-act="people" data-slot="${s.slot}" data-i="${i}" data-d="1" aria-label="Plus">+</button>
            </div>
            <div class="btn-row" style="margin-top:14px">
              <button class="btn danger" data-act="remove-from-slot" data-slot="${s.slot}" data-i="${i}">Retirer</button>
            </div>
          </div>`;
        }).join("")}
      </section>`;
    }

    body += pickerHtml(s.slot, arr.length ? "Ajouter un autre repas" : "");
    return sheetShell(slotLabel(s.slot), arr.length ? "" : "Choisissez un repas dans la bibliothèque", body);
  },

  /* Detail d'un repas de la bibliotheque */
  meal(s) {
    const m = mealById(s.id);
    if (!m) return sheetShell("Repas introuvable", "", "");
    const ings = m.ingredients || [];
    const used = slotsUsing(m.id);

    const body = `<section class="card">
        <div class="card-head"><span class="eyebrow">Ingrédients</span><span class="d">sans quantités</span></div>
        ${ings.length
          ? ings.map(i => `<div class="row" style="min-height:38px;padding:8px 14px"><span class="body"><span class="title" style="font-size:16px">${esc(i)}</span></span></div>`).join("")
          : `<div class="empty" style="padding:18px">Aucun ingrédient. Modifiez le repas pour en ajouter.</div>`}
      </section>
      ${used.length ? `<p class="sub" style="margin:10px 2px">Au planning : ${used.map(u => esc(slotLabel(u))).join(", ")}.</p>` : ""}
      <div class="btn-row" style="margin-top:14px">
        <button class="btn ghost" data-act="edit-meal" data-id="${m.id}">Modifier</button>
      </div>
      <button class="btn quiet" data-act="del-meal" data-id="${m.id}" style="color:var(--red);margin-top:8px">Supprimer ce repas</button>`;

    return sheetShell(m.name, m.fav ? "★ Favori" : "", body,
      `<button class="star${m.fav ? " on" : ""}" data-act="fav" data-id="${m.id}" aria-label="Favori">${m.fav ? "★" : "☆"}</button>`);
  },

  /* Creation ou modification. Travaille sur ui.draft, jamais sur le store. */
  edit() {
    const rows = ui.draft.ingredients.map((v, i) => `<div class="ing">
        <input class="input" data-ing="${i}" value="${esc(v)}" placeholder="Ingrédient"
               autocapitalize="sentences" enterkeyhint="next" aria-label="Ingrédient ${i + 1}">
        <button class="del" data-act="ing-del" data-i="${i}" aria-label="Retirer cet ingrédient">×</button>
      </div>`).join("");

    const body = `<label class="field"><span class="eyebrow">Nom du repas</span>
        <input class="input" id="mname" value="${esc(ui.draft.name)}" placeholder="Carbonara" autocapitalize="sentences" enterkeyhint="next">
      </label>
      <span class="eyebrow" style="display:block;margin-bottom:6px">Ingrédients</span>
      ${rows}
      <button class="btn ghost" data-act="ing-add" style="margin-top:2px">+ Ajouter un ingrédient</button>
      <p class="sub" style="margin:10px 2px 0">Notez seulement les noms : « Pâtes », pas « 200 g de pâtes ». Vous connaissez les quantités.</p>
      <div class="btn-row" style="margin-top:18px"><button class="btn" data-act="save-meal">Enregistrer</button></div>`;

    return sheetShell(ui.draft.id ? "Modifier le repas" : "Nouveau repas", "", body);
  },

  /* Liste des semaines archivees */
  archive() {
    const h = state.history;
    const body = h.length
      ? `<section class="card">${h.map(w => `
          <button class="row" data-act="hist-week" data-id="${w.id}">
            <span class="body">
              <span class="title">Semaine ${esc(weekRange(w.start))}</span>
              <span class="meta">${esc(w.names.slice(0, 4).join(" · "))}${w.names.length > 4 ? " · +" + (w.names.length - 4) : ""}</span>
            </span>
            <span class="chev">›</span>
          </button>`).join("")}</section>`
      : `<div class="card"><div class="empty">Les semaines terminées s'empilent ici, pour les revoir ou les refaire.</div></div>`;

    return sheetShell("Archive", h.length ? h.length + " semaine" + (h.length > 1 ? "s" : "") : "", body);
  },

  /* Detail d'une semaine archivee, jour par jour */
  hist(s) {
    const w = state.history.find(x => x.id === s.id);
    if (!w) return sheetShell("Semaine introuvable", "", "");

    const start = parseIso(w.start);
    const days = orderedDays(w.start).map((d, i) => {
      const date = addDays(start, i);
      const rows = MOMENTS.map(m => {
        const id = d.k + "-" + m.k;
        const items = w.slots[id] || [];
        const names = items.map(p => {
          const meal = mealById(p.mealId);
          return meal ? esc(meal.name) + (p.people ? " (" + p.people + " pers.)" : "") : "(repas supprimé)";
        });
        return `<div class="row">
          <span class="slot">${esc(m.n)}</span>
          <span class="body">
            <span class="title${names.length ? "" : " empty"}">${names.length ? names.join(" · ") : "Libre"}</span>
          </span>
        </div>`;
      }).join("");
      return `<section class="card">
        <div class="card-head"><span class="eyebrow">${esc(d.n)}</span><span class="d">${esc(fmtShort(date))}</span></div>
        ${rows}
      </section>`;
    }).join("");

    const body = days + `
      <div class="btn-row" style="margin-top:14px"><button class="btn" data-act="redo" data-id="${w.id}">Refaire cette semaine</button></div>
      <button class="btn quiet" data-act="del-hist" data-id="${w.id}" style="color:var(--red);margin-top:8px">Supprimer cette archive</button>`;

    return sheetShell("Semaine " + weekRange(w.start), "", body,
      `<button class="x" data-act="archive" aria-label="Retour à l'archive">‹</button>`);
  }
};

/* ============================ fragments ============================ */

// Liste des repas cliquables, favoris en tete : le meme bloc sert au creneau et au remplacement.
export function pickerHtml(slot, label) {
  if (!state.meals.length) {
    return `<div class="card"><div class="empty"><strong>Bibliothèque vide</strong>
      Créez d'abord un repas dans l'onglet Repas.</div></div>`;
  }

  return `${label ? `<p class="eyebrow" style="margin:16px 2px 8px">${label}</p>` : ""}
    <div class="search">
      <span style="color:var(--pencil);font-size:14px" aria-hidden="true">⌕</span>
      <input id="pickq" data-slot="${slot}" type="search" placeholder="Rechercher un repas"
             value="${esc(ui.pickQuery)}" autocomplete="off" autocapitalize="off" aria-label="Rechercher un repas">
    </div>
    <div id="picker-rows">${pickerRows(slot)}</div>`;
}

// Rendu isole des lignes du picker, pour pouvoir les rafraichir seules
// pendant la frappe dans la recherche (sinon le champ perdrait le focus).
export function pickerRows(slot) {
  const q = normKey(ui.pickQuery);
  const meals = state.meals
    .filter(m => !q || normKey(m.name).includes(q) || (m.ingredients || []).some(x => normKey(x).includes(q)))
    .sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || a.name.localeCompare(b.name, "fr"));

  if (!meals.length) return `<div class="card"><div class="empty">Aucun repas ne correspond à « ${esc(ui.pickQuery)} ».</div></div>`;

  const favs = meals.filter(m => m.fav);
  const rest = meals.filter(m => !m.fav);
  const rows = arr => arr.map(m => pickRow(slot, m)).join("");

  return `${favs.length ? `<section class="card"><div class="card-head"><span class="eyebrow">Favoris</span></div>${rows(favs)}</section>` : ""}
    ${rest.length ? `<section class="card"><div class="card-head"><span class="eyebrow">${favs.length ? "Tous les repas" : "Bibliothèque"}</span></div>${rows(rest)}</section>` : ""}`;
}

// Une ligne du choix de repas : repliee (nom + ingredients), ou depliee sur place
// pour regler le nombre de personnes avant de confirmer l'ajout au creneau.
function pickRow(slot, m) {
  const open = ui.pick && ui.pick.slot === slot && ui.pick.mealId === m.id;

  if (!open) {
    return `<button class="row" data-act="pick-expand" data-slot="${slot}" data-id="${m.id}">
      <span class="body"><span class="title">${m.fav ? "★ " : ""}${esc(m.name)}</span>
      <span class="meta">${esc((m.ingredients || []).slice(0, 4).join(", "))}</span></span>
      <span class="chev">＋</span></button>`;
  }

  const people = ui.pick.people;
  return `<div class="row-expanded">
      <button class="row" data-act="pick-expand" data-slot="${slot}" data-id="${m.id}">
        <span class="body"><span class="title">${m.fav ? "★ " : ""}${esc(m.name)}</span></span>
        <span class="chev">︿</span>
      </button>
      <div class="reveal${ui.pick.opened ? " open" : ""}">
        <div class="step" style="padding:8px 14px 0">
          <b>${people ? "Pour " + people + " personne" + (people > 1 ? "s" : "") : "Nombre de personnes"}</b>
          <button class="pm" data-act="pick-people" data-d="-1" aria-label="Moins">−</button>
          <button class="pm" data-act="pick-people" data-d="1" aria-label="Plus">+</button>
        </div>
        <div style="padding:12px 14px 14px">
          <button class="btn" data-act="pick-confirm" data-slot="${slot}" data-id="${m.id}">Ajouter</button>
        </div>
      </div>
    </div>`;
}

export function sheetShell(title, sub, body, extra) {
  return `<div class="sheet-head"><span class="grab"></span>
      <div style="flex:1;min-width:0"><h2>${esc(title)}</h2>${sub ? `<p class="sub">${esc(sub)}</p>` : ""}</div>
      ${extra || ""}
      <button class="x" data-act="close" aria-label="Fermer">✕</button>
    </div>
    <div class="sheet-body">${body}</div>`;
}
