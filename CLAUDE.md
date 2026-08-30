# CLAUDE.md

Contexte pour Claude Code sur ce dépôt. Lire avant de modifier quoi que ce soit.

## Ce qu'est le projet

PWA personnelle de planification des repas, en français, pensée pour iPhone.
Trois objets, dans cet ordre : **bibliothèque de repas → semaine → liste de courses**.

Cible : un iPhone, une main, parfois dans un rayon de supermarché. La rapidité
d'usage prime sur la richesse fonctionnelle.

## Contraintes techniques

- **Zéro dépendance, zéro build.** HTML, CSS et modules ES natifs. Ne pas introduire
  React, Vite, Tailwind, TypeScript ni npm install. Si une bibliothèque semble
  nécessaire, c'est probablement que la fonctionnalité est de trop.
- Servir en local avec `python3 -m http.server 8000` (les modules ES échouent en `file://`).
- Safari/WebKit est la cible principale : vérifier la prise en charge avant d'utiliser
  une API récente, et prévoir un repli.
- Toucher au DOM uniquement dans `render.js` et `actions.js`. `views.js` et `sheets.js`
  produisent des chaînes HTML ; `model.js`, `store.js` et `shopping.js` ignorent le DOM.

## Invariants métier — ne pas les casser

1. **Les ingrédients n'ont pas de quantités.** Ce sont des noms. Ne jamais ajouter de
   champ quantité, d'unité ni de calcul de portions.
2. **Un repas et un repas planifié sont deux choses différentes.** La bibliothèque
   contient des repas ; la semaine contient des occurrences `{ mealId, people? }`.
   Placer Carbonara lundi soir et jeudi soir ne duplique pas la recette.
3. **La liste de courses est dérivée, jamais stockée.** Elle est recalculée depuis la
   semaine (`shopping.js`). Seul l'état des cases cochées est persisté.
4. **Chaque ingrédient garde son contexte.** Une ligne par ingrédient, avec la liste
   des `Jour moment · Nom du repas` qui le réclament. C'est la fonctionnalité centrale.
5. **`people` est informatif.** Il ne sert jamais à calculer des quantités.
6. **La semaine ne se termine que sur action de l'utilisateur**, avec confirmation.
   Aucune purge automatique le dimanche. La bibliothèque survit à la fin de semaine.
7. **Tout reste local.** Aucun appel réseau, aucun compte, aucune télémétrie.

## Conventions de code

- Français pour l'interface, les commentaires et les commits. Identifiants en anglais
  quand c'est plus clair (`slot`, `meal`, `checked`).
- Toute valeur saisie par l'utilisateur passe par `esc()` avant insertion en HTML.
- Comparaison d'ingrédients avec `normKey()` — casse, accents et espaces neutralisés.
  C'est ce qui fusionne « Crème » et « creme ».
- Nouvelle interaction : ajouter un `data-act="..."` dans la vue, puis un `case` dans
  le `switch` de `actions.js`. Pas de `onclick` en ligne, pas d'écouteur dispersé.
- Le rendu est intégral (`innerHTML`) et préserve le défilement. Exception : cocher un
  article de courses met à jour la seule ligne concernée (`refreshCheck`), pour ne pas
  faire sauter la page pendant les courses.
- Zone tactile minimale 44 px, `env(safe-area-inset-*)` respecté, `prefers-reduced-motion`
  respecté, mode sombre pris en charge via les tokens CSS.

## Après modification d'un fichier statique

Incrémenter `CACHE` dans `sw.js` (`semaine-v1` → `semaine-v2`) et ajouter tout nouveau
fichier à `ASSETS`. Sans ça, les appareils déjà installés gardent l'ancienne version.

## Vérifications avant de conclure

Aucun test automatisé. Parcours manuel minimal :

1. Charger les exemples, créer un repas, le modifier, le supprimer.
2. Placer le même repas sur deux créneaux → une seule ligne par ingrédient dans
   Courses, avec les deux contextes.
3. Cocher un article → la page ne saute pas, le compteur et la pastille de l'onglet suivent.
4. Terminer la semaine → planning vide, bibliothèque intacte, semaine archivée.
5. Refaire une semaine archivée → créneaux repris, archive inchangée.
6. Recharger la page → tout est retrouvé.

## Feuille de route

Envisageable : catégories de repas, tri de la liste par rayon, glisser-déposer entre
créneaux, partage d'une liste en texte brut.

Refusé pour l'instant : quantités, nutrition, prix, comparaison de magasins, recettes
importées, suggestions automatiques, comptes utilisateurs, notifications, synchronisation.
