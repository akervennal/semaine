// shopping.js — la liste de courses est toujours derivee de la semaine,
// jamais stockee. Modifier un creneau suffit donc a la mettre a jour.

import { SLOTS, slotLabel, normKey, cap } from "./model.js";
import { state, mealById, save } from "./store.js";

/**
 * Fusionne les ingredients de tous les repas planifies.
 * Chaque ligne garde son contexte : pour quel jour, pour quel repas.
 * @returns {Array<{key:string, name:string, ctx:string[]}>} trie alphabetiquement
 */
export function shoppingList() {
  const map = new Map();

  // On parcourt les creneaux dans l'ordre de la semaine : les contextes
  // apparaissent donc de lundi a dimanche sous chaque ingredient.
  SLOTS.forEach(sid => {
    const planned = state.week.slots[sid];
    if (!planned) return;
    const meal = mealById(planned.mealId);
    if (!meal) return;

    (meal.ingredients || []).forEach(raw => {
      const name = String(raw).trim();
      const key = normKey(name);
      if (!key) return;
      if (!map.has(key)) map.set(key, { key, name: cap(name), ctx: [] });

      const line = slotLabel(sid) + " · " + meal.name + (planned.people ? " (" + planned.people + " pers.)" : "");
      const entry = map.get(key);
      // Deux fois le meme plat le meme soir ne doit pas doubler la ligne de contexte.
      if (!entry.ctx.includes(line)) entry.ctx.push(line);
    });
  });

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export const remaining = list => list.filter(i => !state.checked[i.key]).length;
export const doneCount = list => list.filter(i => state.checked[i.key]).length;

// Oublie les cases cochees dont l'ingredient a disparu de la semaine.
export function pruneChecked(list) {
  const keys = new Set(list.map(i => i.key));
  let changed = false;
  Object.keys(state.checked).forEach(k => {
    if (!keys.has(k)) {
      delete state.checked[k];
      changed = true;
    }
  });
  if (changed) save();
}
