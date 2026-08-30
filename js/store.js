// store.js — les donnees et elles seules. Persistance dans localStorage,
// avec repli en memoire si le navigateur la refuse (Safari en navigation privee, iframes).
//
// Modele :
//   meal    = { id, name, ingredients: [string], fav: bool }   -> bibliotheque permanente
//   planned = { mealId, people? }                              -> une occurrence dans un creneau
// Ces deux notions restent separees : un meme repas peut occuper plusieurs creneaux
// sans etre duplique dans la bibliotheque.

import { SLOTS, iso, mondayOf, uid, normKey } from "./model.js";

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

export const emptyWeek = startIso => ({ start: startIso || iso(mondayOf(new Date())), slots: {} });
export const blank = () => ({ meals: [], week: emptyWeek(), checked: {}, history: [] });

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
      week: d.week && d.week.start ? { start: d.week.start, slots: d.week.slots || {} } : emptyWeek(),
      checked: d.checked || {},
      history: Array.isArray(d.history) ? d.history : []
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
export const plannedCount = () => Object.keys(state.week.slots).length;
export const slotsUsing = mealId => SLOTS.filter(s => state.week.slots[s] && state.week.slots[s].mealId === mealId);

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

// Supprimer un repas vide aussi les creneaux qui l'utilisaient : un planning
// ne doit jamais pointer vers un repas inexistant.
export function removeMeal(id) {
  slotsUsing(id).forEach(s => delete state.week.slots[s]);
  state.meals = state.meals.filter(m => m.id !== id);
  save();
}

export function toggleFav(id) {
  const m = mealById(id);
  m.fav = !m.fav;
  save();
}

/* ---------- semaine ---------- */

export function setSlot(slot, mealId) {
  state.week.slots[slot] = Object.assign({}, state.week.slots[slot], { mealId });
  save();
}

export function clearSlot(slot) {
  delete state.week.slots[slot];
  save();
}

// Information de contexte uniquement : ne sert jamais a calculer des quantites.
export function bumpPeople(slot, delta) {
  const p = state.week.slots[slot];
  if (!p) return;
  p.people = Math.max(0, Math.min(20, (p.people || 0) + delta));
  if (!p.people) delete p.people;
  save();
}

// Fixe le nombre de personnes a une valeur absolue (choix fait avant l'ajout au creneau).
export function setPeople(slot, people) {
  const p = state.week.slots[slot];
  if (!p) return;
  const v = Math.max(0, Math.min(20, people || 0));
  if (v) p.people = v;
  else delete p.people;
  save();
}

export function setWeekStart(dateIso) {
  state.week.start = iso(mondayOf(new Date(dateIso + "T12:00:00")));
  save();
}

export function toggleChecked(key) {
  if (state.checked[key]) delete state.checked[key];
  else state.checked[key] = 1;
  save();
}

export function resetChecked() {
  state.checked = {};
  save();
}

/* ---------- fin de semaine et historique ---------- */

export function endWeek() {
  if (plannedCount()) {
    const names = [...new Set(
      SLOTS.filter(s => state.week.slots[s])
        .map(s => (mealById(state.week.slots[s].mealId) || {}).name)
        .filter(Boolean)
    )];
    state.history.unshift({
      id: uid(),
      start: state.week.start,
      slots: JSON.parse(JSON.stringify(state.week.slots)),
      names
    });
    state.history = state.history.slice(0, 20);
  }
  const next = new Date(state.week.start + "T12:00:00");
  next.setDate(next.getDate() + 7);
  state.week = emptyWeek(iso(next));
  state.checked = {};
  save();
}

// Recopie une semaine archivee dans la semaine courante, sans toucher a l'archive.
// Les repas supprimes entre-temps sont ignores.
export function redoWeek(historyId) {
  const w = state.history.find(x => x.id === historyId);
  if (!w) return;
  const slots = {};
  Object.keys(w.slots).forEach(s => {
    if (mealById(w.slots[s].mealId)) slots[s] = Object.assign({}, w.slots[s]);
  });
  state.week.slots = slots;
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
