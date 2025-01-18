# Guide d'utilisation des articles de blog

Ce dossier contient les articles de blog au format Markdown, qui sont plus faciles à éditer que le HTML.

## Structure d'un article

Chaque article est composé de deux parties :

1. **En-tête (entre les `---`)** :
   ```yaml
   ---
   title: "Titre de l'article"
   date: "Date de publication"
   category: "Catégorie"
   image: "../images/blog/image.jpg"
   description: "Brève description de l'article"
   ---
   ```

2. **Contenu** (en Markdown) :
   - Utilisez `#` pour les titres principaux
   - Utilisez `##` pour les sous-titres
   - Utilisez `-` ou `*` pour les listes à puces
   - Utilisez `1.`, `2.`, etc. pour les listes numérotées

## Comment créer un nouvel article

1. Créez un nouveau fichier `.md` dans ce dossier
2. Copiez la structure d'en-tête ci-dessus
3. Écrivez votre contenu en Markdown
4. Ajoutez l'image correspondante dans le dossier `images/blog/`

## Comment convertir les articles en HTML

1. Installez les dépendances :
   ```bash
   pip install -r requirements.txt
   ```

2. Exécutez le script de conversion :
   ```bash
   python convert.py
   ```

Le script convertira automatiquement tous les fichiers `.md` en `.html` en utilisant le template.
