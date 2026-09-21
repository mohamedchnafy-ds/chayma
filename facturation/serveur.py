#!/usr/bin/env python3
"""
serveur.py — fait tourner l'outil de facturation sur cet ordinateur.

Il rend deux services, et rien d'autre :

  1. il sert les fichiers de l'outil (le dossier `facturation/`) ;
  2. il lit et ecrit le dossier de donnees (`data/` par defaut), pour que les
     informations du cabinet vivent dans des fichiers ordinaires que l'on peut
     voir, copier et sauvegarder comme n'importe quel document.

Il n'ecoute que sur cet ordinateur (127.0.0.1) : rien n'est joignable depuis
l'exterieur, et aucune donnee ne part sur Internet.

Usage :
    python3 serveur.py [--port 8777] [--donnees CHEMIN] [--sans-navigateur]
"""

import argparse
import http.server
import json
import os
import shutil
import socket
import socketserver
import sys
import tempfile
import threading
import time
import webbrowser
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parent            # .../facturation
DONNEES_DEFAUT = RACINE.parent / 'data'             # .../data, a cote du code
FICHIER = 'cabinet.json'
ENTETE_REQUISE = 'X-Facturation'
SAUVEGARDES_CONSERVEES = 30


# --- Dossier de donnees -------------------------------------------------------

def preparer_dossier(dossier: Path) -> None:
    """Cree le dossier de donnees et le met hors de portee de git."""
    (dossier / 'sauvegardes').mkdir(parents=True, exist_ok=True)
    (dossier / 'factures').mkdir(exist_ok=True)

    # Ceinture et bretelles : meme si le .gitignore du depot disparaissait,
    # ce fichier-ci empeche les donnees de patients d'etre publiees par erreur.
    garde = dossier / '.gitignore'
    if not garde.exists():
        garde.write_text('*\n', encoding='utf-8')

    lisez_moi = dossier / 'LISEZ-MOI.txt'
    if not lisez_moi.exists():
        lisez_moi.write_text(
            "Dossier de données du cabinet.\n\n"
            "cabinet.json   toutes les données : patients, séances, notes d’honoraires.\n"
            "sauvegardes/   une copie datée par jour d’utilisation.\n"
            "factures/      où enregistrer les PDF des notes d’honoraires.\n\n"
            "Ce dossier ne doit jamais être publié ni envoyé par courriel.\n"
            "Le sauvegarder (Time Machine, disque externe) suffit à tout conserver.\n",
            encoding='utf-8')


def lire_document(dossier: Path):
    chemin = dossier / FICHIER
    if not chemin.exists():
        return None
    try:
        return json.loads(chemin.read_text(encoding='utf-8'))
    except (json.JSONDecodeError, OSError) as err:
        # Un fichier illisible ne doit jamais etre ecrase en silence.
        secours = dossier / f'{FICHIER}.illisible-{int(time.time())}'
        shutil.copy2(chemin, secours)
        raise RuntimeError(
            f'Le fichier de données est illisible ({err}). '
            f'Une copie a été gardée sous {secours.name}.')


def ecrire_document(dossier: Path, document: dict) -> None:
    """Ecriture atomique : on n'abime jamais le fichier existant."""
    # Le dossier peut avoir ete deplace ou renomme pendant la session : on le
    # recree plutot que de perdre la seance que l'on vient de saisir.
    dossier.mkdir(parents=True, exist_ok=True)

    chemin = dossier / FICHIER
    texte = json.dumps(document, ensure_ascii=False, indent=2)

    fd, provisoire = tempfile.mkstemp(dir=str(dossier), prefix='.cabinet-', suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as sortie:
            sortie.write(texte)
            sortie.flush()
            os.fsync(sortie.fileno())
        os.replace(provisoire, chemin)      # atomique sur macOS comme sur Linux
    except BaseException:
        Path(provisoire).unlink(missing_ok=True)
        raise

    sauvegarder_du_jour(dossier, texte)


def sauvegarder_du_jour(dossier: Path, texte: str) -> None:
    """Une copie datee par jour d'utilisation, les trente dernieres conservees."""
    copies = dossier / 'sauvegardes'
    copies.mkdir(exist_ok=True)
    (copies / f'cabinet-{date.today().isoformat()}.json').write_text(texte, encoding='utf-8')

    anciennes = sorted(copies.glob('cabinet-*.json'))
    for vieille in anciennes[:-SAUVEGARDES_CONSERVEES]:
        vieille.unlink(missing_ok=True)


# --- Serveur --------------------------------------------------------------------

class Gestionnaire(http.server.SimpleHTTPRequestHandler):
    dossier_donnees: Path = DONNEES_DEFAUT
    port: int = 8777

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(RACINE), **kwargs)

    # -- garde-fous ---------------------------------------------------------------

    def origine_acceptee(self) -> bool:
        """
        Une page web ouverte ailleurs ne doit pas pouvoir écrire ici.

        Deux verrous : l'en-tête maison (qui force une requête préalable que
        nous refusons, faute d'en-têtes CORS) et l'origine déclarée.
        """
        if self.headers.get(ENTETE_REQUISE) is None:
            return False
        origine = self.headers.get('Origin')
        if origine is None:
            return True                     # requete de meme origine, sans Origin
        return origine in (f'http://127.0.0.1:{self.port}', f'http://localhost:{self.port}')

    def repondre_json(self, code: int, charge: dict) -> None:
        corps = json.dumps(charge, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(corps)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(corps)

    # -- routes --------------------------------------------------------------------

    def do_GET(self):
        if self.path.startswith('/api/'):
            if self.path != '/api/document':
                return self.repondre_json(404, {'erreur': 'Route inconnue.'})
            if not self.origine_acceptee():
                return self.repondre_json(403, {'erreur': 'Origine refusée.'})
            try:
                return self.repondre_json(200, {
                    'chemin': str(self.dossier_donnees / FICHIER),
                    'dossier': str(self.dossier_donnees),
                    'document': lire_document(self.dossier_donnees),
                })
            except RuntimeError as err:
                return self.repondre_json(500, {'erreur': str(err)})
        return super().do_GET()

    def do_PUT(self):
        if self.path != '/api/document':
            return self.repondre_json(404, {'erreur': 'Route inconnue.'})
        if not self.origine_acceptee():
            return self.repondre_json(403, {'erreur': 'Origine refusée.'})
        try:
            taille = int(self.headers.get('Content-Length') or 0)
            document = json.loads(self.rfile.read(taille).decode('utf-8'))
            if not isinstance(document, dict):
                raise ValueError('Document inattendu.')
            ecrire_document(self.dossier_donnees, document)
            return self.repondre_json(200, {'enregistre': True})
        except (ValueError, json.JSONDecodeError) as err:
            return self.repondre_json(400, {'erreur': f'Document invalide : {err}'})
        except OSError as err:
            return self.repondre_json(500, {'erreur': f'Écriture impossible : {err}'})

    def end_headers(self):
        # L'outil evolue : on ne veut pas d'une vieille version en cache.
        if not self.path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, formatage, *args):
        pass        # la fenetre du terminal reste lisible


class Serveur(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def port_libre(depart: int, essais: int = 20) -> int:
    for port in range(depart, depart + essais):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as prise:
            if prise.connect_ex(('127.0.0.1', port)) != 0:
                return port
    raise SystemExit('Aucun port disponible entre '
                     f'{depart} et {depart + essais - 1}.')


def main() -> None:
    analyse = argparse.ArgumentParser(description='Outil de facturation du cabinet.')
    analyse.add_argument('--port', type=int, default=8777)
    analyse.add_argument('--donnees', type=Path, default=DONNEES_DEFAUT,
                         help='dossier où ranger les données (défaut : ../data)')
    analyse.add_argument('--sans-navigateur', action='store_true')
    options = analyse.parse_args()

    dossier = options.donnees.expanduser().resolve()
    preparer_dossier(dossier)

    port = port_libre(options.port)
    Gestionnaire.dossier_donnees = dossier
    Gestionnaire.port = port
    adresse = f'http://127.0.0.1:{port}/'

    existant = (dossier / FICHIER).exists()
    print('\n  Facturation du cabinet')
    print(f'  Adresse   {adresse}')
    print(f'  Données   {dossier / FICHIER}'
          f'{"" if existant else "   (sera créé à la première séance)"}')
    print('\n  Laissez cette fenêtre ouverte pendant que vous travaillez.')
    print('  Pour quitter : fermez la fenêtre, ou Ctrl+C.\n')

    with Serveur(('127.0.0.1', port), Gestionnaire) as serveur:
        if not options.sans_navigateur:
            threading.Timer(0.4, lambda: webbrowser.open(adresse)).start()
        try:
            serveur.serve_forever()
        except KeyboardInterrupt:
            print('\n  Au revoir.\n')


if __name__ == '__main__':
    if sys.version_info < (3, 8):
        raise SystemExit('Python 3.8 ou plus récent est nécessaire.')
    main()
