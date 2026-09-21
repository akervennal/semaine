// uistate.js — etat d'affichage, non persiste. Volontairement isole du store
// pour eviter les imports circulaires entre les vues et le moteur de rendu.

export const ui = {
  tab: "semaine",     // semaine | repas | courses | plus
  query: "",          // recherche dans la bibliotheque
  sheet: null,        // { type, ...params } de la feuille ouverte
  draft: null,        // repas en cours d'edition { id|null, name, ingredients[] }
  pick: null,         // ligne depliee dans le choix d'un repas { slot, mealId, people, opened, bump }
  pickQuery: "",      // recherche dans le choix d'un repas (feuille de creneau)
  justAdded: null,    // { slot, index } du repas tout juste ajoute, pour l'animer a l'affichage
  menuBump: null      // { slot, index } du repas d'"Au menu" dont le nombre de personnes vient de changer
};
