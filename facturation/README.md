# Facturation du cabinet

Outil de facturation et de suivi d’activité pour le cabinet de psychologie.
Il fonctionne **entièrement sur l’ordinateur qui l’ouvre** : aucune donnée de
patient n’est envoyée sur Internet, et il n’y a aucun serveur à administrer.

---

## Mode d’emploi

### Ouvrir l’outil

Ouvrir `…/facturation/` dans Chrome ou Edge, puis, via le menu du navigateur,
« Installer l’application » pour obtenir une icône comme un logiciel ordinaire.
Une fois ouvert une première fois, il fonctionne sans connexion Internet.

### La première fois — trois réglages à faire

Dans **Paramètres** :

1. **Identité du cabinet** — nom, adresse, téléphone, **SIRET** et **numéro
   ADELI**. Ces deux numéros sont obligatoires sur une note d’honoraires.
2. **Sauvegarde** — cliquer sur « Choisir un fichier de sauvegarde » et
   l’enregistrer dans un dossier synchronisé (iCloud, Drive, Dropbox…).
   À partir de là, chaque modification est recopiée automatiquement dans ce
   fichier. **C’est le réglage le plus important de tout l’outil.**
3. **Valeurs par défaut** — tarif et type de consultation les plus fréquents,
   pour que la saisie quotidienne ne demande qu’un nom.

### Au quotidien

L’écran **Aujourd’hui** est fait pour être utilisé entre deux patients :

- taper le nom du patient (un nom inconnu crée sa fiche tout seul) ;
- le tarif et le type se préremplissent selon ses habitudes ;
- `Entrée` enregistre, et le curseur revient sur le champ du nom.

Décocher « Payé » si le patient règle plus tard : la séance apparaît alors dans
« À encaisser », et un clic sur **Encaisser** la solde le jour venu.

La touche `N` ramène à cet écran depuis n’importe où.

### Éditer une note d’honoraires

Deux chemins, au choix :

- dans **Séances**, cocher une ou plusieurs séances d’un même patient, puis
  « Créer la note d’honoraires » ;
- dans **Notes d’honoraires**, « + Note d’honoraires » et choisir le patient.

Puis **Imprimer / PDF** → dans la fenêtre d’impression, choisir « Enregistrer
au format PDF » comme destination.

### Corriger une erreur

Une note émise ne se modifie pas et ne se supprime pas : la numérotation doit
rester continue et sans trou. On l’**annule par un avoir**, qui porte son propre
numéro, et les séances concernées redeviennent facturables.

### Pour le comptable

Dans **Paramètres → Export comptable** :

- **Recettes encaissées (CSV)** — une ligne par encaissement, à sa date de
  règlement (comptabilité de caisse, régime BNC) ;
- **Notes d’honoraires (CSV)** — la liste des pièces émises dans l’année ;
- **Récapitulatif mensuel** — séances et recettes mois par mois.

---

## Ce que l’outil garantit — et ce qu’il ne garantit pas

**Il garantit :**

- Les données restent sur cet ordinateur. Aucune requête réseau n’est faite,
  aucune bibliothèque externe n’est chargée.
- La numérotation est chronologique, continue et sans trou ; une pièce émise est
  figée, y compris l’identité du destinataire au moment de l’émission.
- Les mentions obligatoires figurent sur chaque pièce : identité, SIRET, ADELI,
  mention de TVA, date, détail des prestations, total.
- Aucune donnée clinique n’est stockée : uniquement ce qui sert à facturer.

**Il ne garantit pas :**

- Le **code d’ouverture** décourage un regard de passage ; il ne chiffre rien.
  La vraie protection reste la session de l’ordinateur et son chiffrement disque
  (FileVault, BitLocker).
- Les **sauvegardes** sont votre responsabilité. Sans fichier de sauvegarde
  configuré, vider les données du navigateur efface tout, définitivement.
- La **conformité fiscale** de vos mentions est à faire valider par votre
  comptable. L’exonération de TVA retenue par défaut (article 261-4-1° du CGI)
  vise les psychologues titulaires d’un diplôme reconnu ; le régime applicable
  et l’obligation de conservation (10 ans) dépendent de votre situation.
  N’étant pas assujettie à la TVA, vous n’entrez pas dans l’obligation de
  « logiciel de caisse certifié » — à reconfirmer si votre régime change.

---

## Notes techniques

Aucune dépendance, aucune étape de compilation, aucun CDN : du HTML, du CSS et
des modules JavaScript natifs. Ouvrir un fichier et recharger la page suffit.

```
facturation/
├── index.html              ossature de l’application
├── sw.js                   mise en cache pour l’usage hors connexion
├── css/app.css             styles, reprend la palette du site du cabinet
└── js/
    ├── modele.js           logique métier pure : montants, dates, calculs
    ├── db.js               stockage IndexedDB + copie miroir dans un fichier
    ├── donnees.js          les seules écritures : patients, séances, pièces
    ├── ui.js               briques d’interface (modale, champs, notifications)
    ├── graphiques.js       SVG écrit à la main, sans bibliothèque
    ├── app.js              démarrage, verrou, navigation
    └── vue-*.js            un fichier par écran
```

**Choix de conception.** Le document entier (quelques milliers de séances sur
dix ans, soit environ 2 Mo) est gardé en mémoire et réécrit à chaque
modification. Les requêtes deviennent du filtrage JavaScript ordinaire,
l’export et l’import sont gratuits, et toute une classe de bugs de migration de
schéma disparaît. `db.js` isole ce choix : passer à un stockage synchronisé un
jour ne toucherait que ce fichier.

**Montants.** Tout est stocké en centimes, en entiers. Jamais de flottant sur de
l’argent.

**Dates.** Des chaînes `AAAA-MM-JJ`, sans objet `Date` ni fuseau horaire pour les
dates de séance : une séance du 7 septembre reste le 7 septembre partout.

### Développer et tester

```bash
python3 -m http.server 8777      # depuis la racine du dépôt
# puis http://localhost:8777/facturation/
```

IndexedDB et la sauvegarde dans un fichier exigent une origine `http://` ou
`https://` : ouvrir `index.html` directement depuis le disque ne fonctionne pas.
