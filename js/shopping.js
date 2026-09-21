// shopping.js — la liste de courses est toujours derivee de la semaine,
// jamais stockee. Modifier un creneau suffit donc a la mettre a jour.

import { SLOTS, slotLabel, normKey, cap, CATEGORIES } from "./model.js";
import { state, mealById, save } from "./store.js";

/**
 * Fusionne les ingredients de tous les repas planifies.
 * Chaque ligne garde son contexte : pour quel jour, pour quel repas.
 * @returns {Array<{key:string, name:string, ctx:string[]}>} trie alphabetiquement
 */
export function shoppingList() {
  const map = new Map();

  // On parcourt les creneaux dans l'ordre de la semaine : les contextes
  // apparaissent donc de lundi a dimanche sous chaque ingredient. Un creneau
  // peut contenir plusieurs repas (plat + dessert, par exemple).
  SLOTS.forEach(sid => {
    (state.week.slots[sid] || []).forEach(planned => {
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
  });

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export const remaining = list => list.filter(i => !state.checked[i.key]).length;
export const doneCount = list => list.filter(i => state.checked[i.key]).length;

// Ordre d'affichage : a prendre en tete, pris en fin. Tri stable, donc
// l'ordre alphabetique de shoppingList() est conserve dans chaque groupe.
const sortForDisplay = list =>
  list.slice().sort((a, b) => (state.checked[a.key] ? 1 : 0) - (state.checked[b.key] ? 1 : 0));

// Rayon d'un ingredient, choisi une fois par l'utilisateur (voir store.setCategory).
// "" = jamais choisi.
export const categoryOf = key => state.categories[key] || "";

// Groupe la liste par rayon pour l'affichage : "Non classe" en tete (pour
// qu'on pense a le ranger), puis les rayons dans l'ordre du magasin. Les
// groupes vides sont omis. Coche glisse en fin, mais a l'interieur de son
// propre rayon seulement (voir refreshCheck dans render.js).
export function groupForDisplay(list) {
  const groups = new Map(["", ...CATEGORIES].map(c => [c, []]));
  list.forEach(i => {
    const cat = categoryOf(i.key);
    if (!groups.has(cat)) groups.set(cat, []); // rayon inconnu (fichier importe d'une version future)
    groups.get(cat).push(i);
  });
  return [...groups.entries()]
    .filter(([, items]) => items.length)
    .map(([cat, items]) => ({ cat, label: cat || "Non classé", items: sortForDisplay(items) }));
}

// Sous-liste d'un seul rayon, triee comme a l'affichage. Sert a ne reordonner
// que le rayon concerne quand un article est coche, sans toucher aux autres.
export const groupOf = (list, cat) => sortForDisplay(list.filter(i => categoryOf(i.key) === cat));

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
