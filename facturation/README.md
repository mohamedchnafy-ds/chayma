# Facturation du cabinet

Outil de facturation et de suivi d’activité pour le cabinet de psychologie.
Il fonctionne **entièrement sur l’ordinateur qui l’ouvre** : aucune donnée de
patient n’est envoyée sur Internet, et il n’y a aucun compte à créer.

```
chayma/
├── facturation/        le programme  ← double-cliquer sur Facturation.command
└── data/               vos données   ← jamais publié, jamais versionné
    ├── cabinet.json        patients, séances, notes d’honoraires
    ├── sauvegardes/        une copie datée par jour d’utilisation
    └── factures/           où enregistrer les PDF
```

---

## Mode d’emploi

### Ouvrir l’outil

Double-cliquer sur **`facturation/Facturation.command`**. Une fenêtre de
terminal s’ouvre et le navigateur affiche l’outil. Laisser cette fenêtre
ouverte pendant le travail ; la fermer arrête tout.

Pratique : glisser `Facturation.command` dans le Dock pour l’avoir sous la main.

> **À la première ouverture**, macOS refuse tout fichier venant d’Internet :
> « Impossible d’ouvrir … développeur non identifié ». C’est attendu — le
> fichier n’est pas signé par un compte développeur Apple. Deux façons de le
> débloquer, une seule fois :
>
> *Par le Terminal (toutes versions de macOS).* Ouvrir Terminal, taper
> `xattr -cr ` **avec l’espace final**, glisser le dossier `Cabinet` dans la
> fenêtre, Entrée. Rien ne s’affiche : c’est fait.
>
> *Par les Réglages Système.* Après la tentative refusée : menu  → Réglages
> Système → Confidentialité et sécurité → section « Sécurité » →
> **Ouvrir quand même**. Le raccourci clic droit → Ouvrir ne suffit plus sur
> les versions récentes de macOS.
>
> Si un message signale que Python 3 manque : taper `python3` dans le Terminal,
> macOS propose alors de l’installer en un clic.

### La première fois — un seul réglage

Dans **Paramètres → Identité du cabinet**, renseigner nom, adresse, téléphone,
**SIRET** et **numéro ADELI** : ces deux numéros sont obligatoires sur une note
d’honoraires. Éventuellement le tarif habituel, dans « Valeurs par défaut ».

Il n’y a rien d’autre à configurer. Les données sont déjà enregistrées dans
`data/cabinet.json` à chaque modification, et une copie datée est conservée pour
chacun des trente derniers jours d’utilisation.

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

Puis **Imprimer / PDF** → dans la fenêtre d’impression, choisir « Enregistrer au
format PDF » comme destination, et ranger le fichier dans `data/factures/`.

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

### Sauvegarder

Le dossier `data/` est un dossier ordinaire : Time Machine, une copie sur clé
USB ou un dossier synchronisé suffisent. Le sauvegarder, c’est tout sauvegarder.

Pour ranger les données ailleurs qu’à côté du code — par exemple dans un dossier
déjà synchronisé :

```bash
python3 facturation/serveur.py --donnees ~/Documents/Cabinet
```

---

## Ce que l’outil garantit — et ce qu’il ne garantit pas

**Il garantit :**

- Les données restent sur cet ordinateur, dans un dossier que vous pouvez voir
  et copier. Le serveur local n’écoute que sur cette machine (`127.0.0.1`), et
  refuse toute requête venant d’une autre origine.
- Aucune bibliothèque externe, aucun CDN, aucune requête vers Internet.
- La numérotation est chronologique, continue et sans trou ; une pièce émise est
  figée, y compris l’identité du destinataire au moment de l’émission.
- Les mentions obligatoires figurent sur chaque pièce : identité, SIRET, ADELI,
  mention de TVA, date, détail des prestations, total.
- Les écritures sont atomiques : une coupure de courant pendant un enregistrement
  n’abîme pas le fichier existant.
- Aucune donnée clinique n’est stockée : uniquement ce qui sert à facturer.

**Il ne garantit pas :**

- Le **code d’ouverture** décourage un regard de passage ; il ne chiffre rien.
  La vraie protection reste la session de l’ordinateur et son chiffrement disque
  (FileVault).
- Les **sauvegardes** restent votre responsabilité. Les copies datées vivent dans
  le même dossier : elles protègent d’une fausse manœuvre, pas d’un disque perdu.
- La **conformité fiscale** de vos mentions est à faire valider par votre
  comptable. L’exonération de TVA retenue par défaut (article 261-4-1° du CGI)
  vise les psychologues titulaires d’un diplôme reconnu ; le régime applicable et
  l’obligation de conservation (10 ans) dépendent de votre situation. N’étant pas
  assujettie à la TVA, vous n’entrez pas dans l’obligation de « logiciel de caisse
  certifié » — à reconfirmer si votre régime change.

---

## Notes techniques

Aucune dépendance, aucune étape de compilation, aucun paquet à installer : du
HTML, du CSS, des modules JavaScript natifs, et un serveur de 200 lignes écrit
avec la seule bibliothèque standard de Python.

```
facturation/
├── Facturation.command     lanceur macOS (double-clic)
├── serveur.py              sert l’outil et lit/écrit le dossier de données
├── index.html              ossature de l’application
├── sw.js                   mise en cache pour l’usage hors connexion
├── css/app.css             styles, reprend la palette du site du cabinet
└── js/
    ├── modele.js           logique métier pure : montants, dates, calculs
    ├── db.js               stockage, et le choix entre ses deux modes
    ├── donnees.js          les seules écritures : patients, séances, pièces
    ├── ui.js               briques d’interface (modale, champs, notifications)
    ├── graphiques.js       SVG écrit à la main, sans bibliothèque
    ├── app.js              démarrage, verrou, navigation
    └── vue-*.js            un fichier par écran
```

### Les deux modes de stockage

`db.js` choisit tout seul au démarrage, en sondant `api/document` :

| Mode | Quand | Où vivent les données |
|---|---|---|
| **fichier** | `serveur.py` tourne | `data/cabinet.json`, plus les copies datées |
| **navigateur** | page servie sans lui (hébergement) | IndexedDB, copie miroir facultative |

La sonde n’est tentée que depuis `localhost` : une page hébergée n’ira jamais
frapper à la porte d’un serveur local.

### Autres choix de conception

**Le document entier en mémoire.** Quelques milliers de séances sur dix ans, soit
environ 2 Mo : on garde tout en mémoire et on réécrit le fichier complet à chaque
modification. Les requêtes deviennent du filtrage JavaScript ordinaire, l’export
et l’import sont gratuits, et toute une classe de bugs de migration de schéma
disparaît.

**Montants en centimes**, en entiers. Jamais de flottant sur de l’argent.

**Dates en chaînes `AAAA-MM-JJ`**, sans objet `Date` ni fuseau horaire : une
séance du 7 septembre reste le 7 septembre partout.

**Écriture atomique** : fichier temporaire puis `os.replace`, qui est atomique
sur macOS comme sur Linux. Un fichier illisible est mis de côté plutôt
qu’écrasé.

### Développer

```bash
python3 facturation/serveur.py --sans-navigateur   # mode « fichier »
python3 -m http.server 8888                        # mode « navigateur »
```

Les deux modes exigent une origine `http://` : ouvrir `index.html` directement
depuis le disque ne fonctionne pas (IndexedDB et les modules ES y sont bloqués).
