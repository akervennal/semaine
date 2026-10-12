// store.js — les donnees et elles seules. Persistance dans localStorage,
// avec repli en memoire si le navigateur la refuse (Safari en navigation privee, iframes).
//
// Modele :
//   meal    = { id, name, ingredients: [string], fav: bool }   -> bibliotheque permanente
//   planned = { mealId, people? }                              -> une occurrence dans un creneau
//   extra   = { id, name }                                     -> article ajoute a la main a la liste
// Un creneau contient une LISTE de planned : plusieurs repas peuvent partager le
// meme jour/moment (ex. plat + dessert). La bibliotheque reste independante :
// un meme repas peut occuper plusieurs creneaux sans y etre duplique.
// Les extras (papier toilette, eponges...) appartiennent a la semaine en cours :
// ils partent avec elle dans l'archive a la fin de semaine.

import { SLOTS, iso, uid, normKey } from "./model.js";

const KEY = "semaine.v1";

let canStore = true;
let memory = null;
try {
  localStorage.setItem("__probe", "1");
  localStorage.removeItem("__probe");
} catch (e) {
  canStore = false;
}

export const canPersist = () => canStore;

// Aucun jour impose : la semaine demarre le jour choisi (courses du samedi soir,
// du dimanche midi, peu importe). Par defaut, aujourd'hui.
export const emptyWeek = startIso => ({ start: startIso || iso(new Date()), slots: {} });
export const blank = () => ({ meals: [], week: emptyWeek(), extras: [], checked: {}, categories: {}, history: [] });

// Nettoie une liste d'extras venue du stockage ou d'un fichier importe.
export const readExtras = raw => (Array.isArray(raw) ? raw : [])
  .filter(x => x && x.id && typeof x.name === "string")
  .map(x => ({ id: x.id, name: x.name }));

// Anciennes donnees : un creneau contenait un objet planned unique, pas une liste.
// On enveloppe au chargement pour ne rien perdre de ce qui etait deja planifie ou archive.
export function migrateSlots(raw) {
  const out = {};
  Object.keys(raw || {}).forEach(k => {
    const v = raw[k];
    const arr = Array.isArray(v) ? v : (v && v.mealId ? [v] : []);
    if (arr.length) out[k] = arr;
  });
  return out;
}

function read() {
  let raw = null;
  try {
    raw = canStore ? localStorage.getItem(KEY) : memory;
  } catch (e) {
    raw = memory;
  }
  if (!raw) return blank();
  try {
    const d = JSON.parse(raw);
    return {
      meals: Array.isArray(d.meals) ? d.meals : [],
      week: d.week && d.week.start ? { start: d.week.start, slots: migrateSlots(d.week.slots) } : emptyWeek(),
      extras: readExtras(d.extras),
      checked: d.checked || {},
      categories: d.categories || {},
      history: Array.isArray(d.history)
        ? d.history.map(w => Object.assign({}, w, { slots: migrateSlots(w.slots) }))
        : []
    };
  } catch (e) {
    return blank();
  }
}

// `export let` : les modules qui importent `state` voient la nouvelle valeur
// apres un import de fichier ou un effacement (liaison vivante des modules ES).
export let state = read();

export function save() {
  const raw = JSON.stringify(state);
  memory = raw;
  if (canStore) {
    try {
      localStorage.setItem(KEY, raw);
    } catch (e) {
      canStore = false; // quota atteint : on continue en memoire plutot que de planter
    }
  }
}

export function replaceState(next) {
  state = next;
  save();
}

/* ---------- lectures ---------- */

export const mealById = id => state.meals.find(m => m.id === id);
export const plannedCount = () => SLOTS.reduce((n, s) => n + (state.week.slots[s] ? state.week.slots[s].length : 0), 0);
export const slotsUsing = mealId => SLOTS.filter(s => (state.week.slots[s] || []).some(p => p.mealId === mealId));

/* ---------- bibliotheque ---------- */

export function addMeal(name, ingredients) {
  const meal = { id: uid(), name, ingredients, fav: false };
  state.meals.push(meal);
  save();
  return meal;
}

export function updateMeal(id, name, ingredients) {
  Object.assign(mealById(id), { name, ingredients });
  save();
}

// Supprimer un repas retire aussi ses occurrences des creneaux : un planning
// ne doit jamais pointer vers un repas inexistant. Les autres repas du meme
// creneau restent en place.
export function removeMeal(id) {
  slotsUsing(id).forEach(s => {
    const arr = state.week.slots[s].filter(p => p.mealId !== id);
    if (arr.length) state.week.slots[s] = arr;
    else delete state.week.slots[s];
  });
  state.meals = state.meals.filter(m => m.id !== id);
  save();
}

export function toggleFav(id) {
  const m = mealById(id);
  m.fav = !m.fav;
  save();
}

/* ---------- semaine ---------- */

// Ajoute un repas au creneau, sans toucher a ceux deja presents.
export function addToSlot(slot, mealId, people) {
  if (!state.week.slots[slot]) state.week.slots[slot] = [];
  const item = { mealId };
  const v = Math.max(0, Math.min(20, people || 0));
  if (v) item.people = v;
  state.week.slots[slot].push(item);
  save();
}

// Retire un seul repas du creneau (par sa position), pas les autres.
export function removeFromSlot(slot, index) {
  const arr = state.week.slots[slot];
  if (!arr) return;
  arr.splice(index, 1);
  if (!arr.length) delete state.week.slots[slot];
  save();
}

// Information de contexte uniquement : ne sert jamais a calculer des quantites.
export function bumpPeopleAt(slot, index, delta) {
  const arr = state.week.slots[slot];
  const p = arr && arr[index];
  if (!p) return;
  p.people = Math.max(0, Math.min(20, (p.people || 0) + delta));
  if (!p.people) delete p.people;
  save();
}

// Le premier jour peut etre n'importe quel jour de la semaine, choisi librement.
export function setWeekStart(dateIso) {
  state.week.start = dateIso;
  save();
}

/* ---------- articles ajoutes a la main ---------- */

// Un meme nom (au sens de normKey) n'est ajoute qu'une fois. Renvoie false si deja present.
export function addExtra(name) {
  const k = normKey(name);
  if (!k || state.extras.some(x => normKey(x.name) === k)) return false;
  state.extras.push({ id: uid(), name: name.trim() });
  save();
  return true;
}

export function removeExtra(id) {
  state.extras = state.extras.filter(x => x.id !== id);
  save();
}

/* ---------- courses ---------- */

export function toggleChecked(key) {
  if (state.checked[key]) delete state.checked[key];
  else state.checked[key] = 1;
  save();
}

export function resetChecked() {
  state.checked = {};
  save();
}

// Rayon d'un ingredient, choisi une fois pour toutes (voir normKey) : sert
// pour tous les repas, toutes les semaines, tant qu'on ne le change pas.
export function setCategory(key, category) {
  state.categories[key] = category;
  save();
}

/* ---------- fin de semaine et historique ---------- */

export function endWeek() {
  if (plannedCount() || state.extras.length) {
    const names = [...new Set(
      SLOTS.flatMap(s => (state.week.slots[s] || []).map(p => (mealById(p.mealId) || {}).name))
        .filter(Boolean)
    )];
    state.history.unshift({
      id: uid(),
      start: state.week.start,
      slots: JSON.parse(JSON.stringify(state.week.slots)),
      extras: state.extras.map(x => Object.assign({}, x)),
      names
    });
    state.history = state.history.slice(0, 20);
  }
  const next = new Date(state.week.start + "T12:00:00");
  next.setDate(next.getDate() + 7);
  state.week = emptyWeek(iso(next));
  state.extras = [];
  state.checked = {};
  save();
}

// Recopie une semaine archivee dans la semaine courante, sans toucher a l'archive.
// Les repas supprimes entre-temps sont ignores. Les extras archives s'ajoutent
// a ceux deja saisis cette semaine, sans doublon.
export function redoWeek(historyId) {
  const w = state.history.find(x => x.id === historyId);
  if (!w) return;
  const slots = {};
  Object.keys(w.slots).forEach(s => {
    const arr = w.slots[s].filter(p => mealById(p.mealId)).map(p => Object.assign({}, p));
    if (arr.length) slots[s] = arr;
  });
  state.week.slots = slots;
  readExtras(w.extras).forEach(x => {
    if (!state.extras.some(y => normKey(y.name) === normKey(x.name))) state.extras.push({ id: uid(), name: x.name });
  });
  state.checked = {};
  save();
}

export function removeHistory(id) {
  state.history = state.history.filter(x => x.id !== id);
  save();
}

/* ---------- exemples ---------- */

const EXAMPLES = [
  ["Carbonara", ["Pâtes", "Lardons", "Œufs", "Parmesan", "Crème"], true],
  ["Poulet curry", ["Poulet", "Riz", "Oignons", "Curry", "Lait de coco"], true],
  ["Chili", ["Viande hachée", "Haricots rouges", "Tomates concassées", "Oignons", "Poivron", "Épices chili"], false],
  ["Pâtes pesto", ["Pâtes", "Pesto", "Parmesan", "Pignons"], true],
  ["Saumon", ["Pavés de saumon", "Citron", "Riz", "Courgettes"], false],
  ["Salade de thon", ["Thon", "Salade", "Tomates", "Maïs", "Œufs", "Vinaigrette"], false]
];

export function seed() {
  EXAMPLES.forEach(([name, ingredients, fav]) => {
    if (!state.meals.some(m => normKey(m.name) === normKey(name))) {
      state.meals.push({ id: uid(), name, ingredients, fav });
    }
  });
  save();
}
