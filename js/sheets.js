// sheets.js — les panneaux qui montent du bas. Meme principe que les vues :
// des chaines HTML, pilotees par data-act.

import { SLOTS, slotLabel, esc } from "./model.js";
import { state, mealById, slotsUsing } from "./store.js";
import { ui } from "./uistate.js";

export const SHEETS = {

  /* Choisir, remplacer ou vider le repas d'un creneau */
  slot(s) {
    const planned = state.week.slots[s.slot];
    const meal = planned ? mealById(planned.mealId) : null;
    const people = planned && planned.people ? planned.people : 0;
    let body = "";

    if (meal) {
      body += `<section class="card">
        <div class="card-head"><span class="eyebrow">Au menu</span></div>
        <div style="padding:13px 14px">
          <div style="font-size:19px;font-weight:700;letter-spacing:-.02em">${esc(meal.name)}</div>
          <div class="sub" style="margin-top:4px">${esc((meal.ingredients || []).join(" · ")) || "Aucun ingrédient"}</div>
          <div class="step" style="margin-top:14px">
            <b>${people ? "Pour " + people + " personne" + (people > 1 ? "s" : "") : "Nombre de personnes"}</b>
            <button class="pm" data-act="people" data-slot="${s.slot}" data-d="-1" aria-label="Moins">−</button>
            <button class="pm" data-act="people" data-slot="${s.slot}" data-d="1" aria-label="Plus">+</button>
          </div>
          <div class="btn-row" style="margin-top:14px">
            <button class="btn danger" data-act="clear-slot" data-slot="${s.slot}">Retirer</button>
          </div>
        </div></section>`;
    }

    body += pickerHtml(s.slot, meal ? "Remplacer par" : "");
    return sheetShell(slotLabel(s.slot), meal ? "" : "Choisissez un repas dans la bibliothèque", body);
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
        <button class="btn" data-act="assign" data-id="${m.id}">Ajouter à la semaine</button>
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

  /* Placer un repas : grille des 14 creneaux */
  assign(s) {
    const m = mealById(s.id);
    const body = `<div class="slotgrid">${SLOTS.map(id => {
      const planned = state.week.slots[id];
      const taken = planned ? mealById(planned.mealId) : null;
      return `<button class="sl${taken ? " taken" : ""}" data-act="assign-slot" data-id="${s.id}" data-slot="${id}">
          <span class="k">${esc(slotLabel(id))}</span>
          <span class="v ${taken ? "" : "free"}">${taken ? esc(taken.name) : "Libre"}</span>
        </button>`;
    }).join("")}</div>`;
    return sheetShell("Placer " + (m ? m.name : "le repas"), "Un créneau occupé sera remplacé", body);
  },

  /* Placement groupe apres selection multiple */
  place(s) {
    const options = SLOTS.map(sid => {
      const planned = state.week.slots[sid];
      const taken = planned ? mealById(planned.mealId) : null;
      return `<option value="${sid}">${esc(slotLabel(sid))}${taken ? " — " + esc(taken.name) : ""}</option>`;
    }).join("");

    const body = s.ids.map(id => {
      const m = mealById(id);
      return `<label class="field"><span class="eyebrow">${esc(m ? m.name : "")}</span>
        <select class="input" data-place="${id}"><option value="">Ne pas placer maintenant</option>${options}</select></label>`;
    }).join("")
      + `<div class="btn-row" style="margin-top:4px"><button class="btn" data-act="place-confirm">Ajouter à ma semaine</button></div>
         <p class="sub" style="margin:10px 2px 0">Laissez « Ne pas placer » pour garder un créneau libre.</p>`;

    return sheetShell(s.ids.length + " repas choisis", "Où les mettre ?", body);
  }
};

/* ============================ fragments ============================ */

// Liste des repas cliquables, favoris en tete : le meme bloc sert au creneau et au remplacement.
export function pickerHtml(slot, label) {
  if (!state.meals.length) {
    return `<div class="card"><div class="empty"><strong>Bibliothèque vide</strong>
      Créez d'abord un repas dans l'onglet Repas.</div></div>`;
  }

  const meals = state.meals.slice().sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || a.name.localeCompare(b.name, "fr"));
  const favs = meals.filter(m => m.fav);
  const rest = meals.filter(m => !m.fav);

  const rows = arr => arr.map(m => pickRow(slot, m)).join("");

  return `${label ? `<p class="eyebrow" style="margin:16px 2px 8px">${label}</p>` : ""}
    ${favs.length ? `<section class="card"><div class="card-head"><span class="eyebrow">Favoris</span></div>${rows(favs)}</section>` : ""}
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
      <div class="step" style="padding:8px 14px 0">
        <b>${people ? "Pour " + people + " personne" + (people > 1 ? "s" : "") : "Nombre de personnes"}</b>
        <button class="pm" data-act="pick-people" data-d="-1" aria-label="Moins">−</button>
        <button class="pm" data-act="pick-people" data-d="1" aria-label="Plus">+</button>
      </div>
      <div style="padding:12px 14px 14px">
        <button class="btn" data-act="pick-confirm" data-slot="${slot}" data-id="${m.id}">Ajouter</button>
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
