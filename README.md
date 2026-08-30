# Semaine — repas et courses

Application web personnelle : on choisit les repas de la semaine dans une bibliothèque
permanente, on les place dans les créneaux midi/soir, et la liste de courses se génère
toute seule — chaque ingrédient indiquant pour quel jour et quel plat il est nécessaire.

PWA installable sur iPhone. Pas de framework, pas d'étape de build, pas de compte,
pas de serveur : les données restent sur l'appareil.

## Démarrer

Les modules ES ne se chargent pas depuis `file://`. Il faut un serveur local :

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

Ou, dans VS Code, l'extension **Live Server** (clic droit sur `index.html` →
*Open with Live Server*). Le service worker fonctionne aussi sur `localhost`.

Pendant le développement, ouvrir les DevTools → Application → Service Workers et
cocher **Update on reload**, sinon le cache sert l'ancienne version.

## Structure

```
index.html              squelette : en-tête, vue, barre d'onglets, feuille, dialogue
css/styles.css          tokens de couleur, mode sombre, tous les composants
js/
  model.js              jours, créneaux, dates, esc/normKey — pur, sans DOM
  store.js              données persistées (localStorage) et mutations
  shopping.js           génération de la liste de courses
  uistate.js            état d'affichage : onglet, recherche, sélection, feuille
  views.js              les quatre écrans
  sheets.js             les panneaux modaux
  render.js             tout le DOM : rendu, feuilles, dialogues, toasts
  actions.js            routeur d'événements (data-act)
  app.js                démarrage + service worker
sw.js                   cache hors ligne
manifest.webmanifest    nom, icônes, mode standalone
icons/                  180 (iOS), 192, 512, 512 maskable
```

Flux des données, à sens unique :

```
bibliothèque de repas → créneaux de la semaine → liste de courses
```

La liste de courses n'est jamais stockée : elle est recalculée depuis la semaine à
chaque rendu. Seules les cases cochées sont mémorisées.

## Installer sur iPhone

1. Héberger le dossier en HTTPS — GitHub Pages, Netlify Drop, Vercel, ou n'importe
   quel hébergement statique. Le service worker exige HTTPS.
2. Ouvrir l'adresse dans **Safari** (Chrome iOS ne sait pas installer).
3. Partager → **Sur l'écran d'accueil**.

L'application s'ouvre alors en plein écran, sans barre Safari, et fonctionne hors ligne.

Publier sur GitHub Pages :

```bash
git init && git add . && git commit -m "Semaine"
git remote add origin git@github.com:<compte>/semaine.git
git push -u origin main
# Settings → Pages → Deploy from a branch → main / (root)
```

## Sauvegarde

Onglet **Plus** → *Exporter en fichier* produit un JSON contenant repas, semaine,
courses et historique. *Importer* le restaure — sur un autre appareil, par exemple.
Il n'y a pas de synchronisation automatique, c'est volontaire.

## Ce qui est délibérément absent

Pas de quantités, pas de calories, pas de prix, pas de recettes, pas de comptes,
pas de notifications. L'application répond à une seule question : *quels repas cette
semaine, et qu'est-ce qu'il faut acheter pour les faire ?* Toute fonctionnalité qui
n'y répond pas alourdit l'usage quotidien.
