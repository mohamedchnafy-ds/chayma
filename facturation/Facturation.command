#!/bin/bash
#
# Facturation.command — double-cliquer sur ce fichier ouvre l'outil.
#
# Il demarre le petit serveur local, qui sert l'outil et range les donnees
# dans le dossier `data/`. Tant que cette fenetre reste ouverte, l'outil
# fonctionne. La fermer arrete tout.

cd "$(dirname "$0")" || exit 1

alerte() {
    # Une vraie fenetre d'alerte : plus lisible qu'un message dans le terminal.
    /usr/bin/osascript -e "display dialog \"$1\" buttons {\"Fermer\"} default button 1 with title \"Facturation du cabinet\" with icon caution" >/dev/null 2>&1
    echo ""
    echo "  $1"
    echo ""
    exit 1
}

trouver_python() {
    for candidat in /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3 python3; do
        if "$candidat" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 8) else 1)' >/dev/null 2>&1; then
            printf '%s' "$candidat"
            return 0
        fi
    done
    return 1
}

PYTHON="$(trouver_python)" || alerte "Python 3 est nécessaire pour ouvrir l’outil, et ne semble pas installé sur cet ordinateur.\n\nTapez « python3 » dans le Terminal : macOS proposera de l’installer en un clic. Relancez ensuite ce fichier."

exec "$PYTHON" serveur.py "$@"
