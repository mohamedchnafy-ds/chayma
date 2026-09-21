// app.js — assemblage : chargement, verrou, navigation.

import * as db from './db.js';
import { el, remplir, notifier, saisie } from './ui.js';
import { rendreJour } from './vue-jour.js';
import { rendreDashboard } from './vue-dashboard.js';
import { rendreSeances } from './vue-seances.js';
import { rendrePatients } from './vue-patients.js';
import { rendreFactures } from './vue-factures.js';
import { rendreParametres } from './vue-parametres.js';

const VUES = [
    { id: 'jour', label: 'Aujourd’hui', rendre: rendreJour },
    { id: 'dashboard', label: 'Tableau de bord', rendre: rendreDashboard },
    { id: 'seances', label: 'Séances', rendre: rendreSeances },
    { id: 'patients', label: 'Patients', rendre: rendrePatients },
    { id: 'factures', label: 'Notes d’honoraires', rendre: rendreFactures },
    { id: 'parametres', label: 'Paramètres', rendre: rendreParametres },
];

const contenu = document.getElementById('contenu');
const navigation = document.getElementById('navigation');
let vueCourante = 'jour';

function naviguer(id, options = {}) {
    const vue = VUES.find(v => v.id === id) || VUES[0];
    vueCourante = vue.id;
    const params = new URLSearchParams(options);
    const suffixe = params.toString();
    const cible = `#/${vue.id}${suffixe ? '?' + suffixe : ''}`;
    if (location.hash !== cible) {
        history.replaceState(null, '', cible);
    }
    for (const bouton of navigation.querySelectorAll('[data-vue]')) {
        const actif = bouton.dataset.vue === vue.id;
        bouton.classList.toggle('nav__lien--actif', actif);
        bouton.setAttribute('aria-current', actif ? 'page' : 'false');
    }
    contenu.scrollTop = 0;
    vue.rendre(contenu, naviguer, options);
}

function routeDepuisUrl() {
    const brut = location.hash.replace(/^#\/?/, '');
    const [id, requete] = brut.split('?');
    const options = Object.fromEntries(new URLSearchParams(requete || ''));
    return { id: VUES.some(v => v.id === id) ? id : 'jour', options };
}

function construireNavigation() {
    remplir(navigation, VUES.map(v => el('button', {
        class: 'nav__lien', type: 'button', donnees: { vue: v.id },
        on: { click: () => naviguer(v.id) },
    }, [v.label])));
}

// --- Verrou a l'ouverture --------------------------------------------------

function demanderCode(empreinteAttendue) {
    return new Promise(resolve => {
        const champCode = saisie({ type: 'password', inputmode: 'numeric', autocomplete: 'current-password', 'aria-label': 'Code d’ouverture' });
        const erreur = el('p', { class: 'verrou__erreur', hidden: true, texte: 'Code incorrect.' });
        const formulaire = el('form', { class: 'verrou__boite' }, [
            el('h1', { texte: 'Facturation du cabinet' }),
            el('p', { class: 'texte-doux', texte: 'Saisissez votre code pour ouvrir l’outil.' }),
            champCode,
            erreur,
            el('button', { class: 'bouton bouton--principal', type: 'submit' }, ['Ouvrir']),
        ]);
        formulaire.addEventListener('submit', async e => {
            e.preventDefault();
            const saisi = await db.empreinte(champCode.value.trim());
            if (saisi === empreinteAttendue) { ecran.remove(); resolve(true); }
            else { erreur.hidden = false; champCode.value = ''; champCode.focus(); }
        });
        const ecran = el('div', { class: 'verrou' }, [formulaire]);
        document.body.append(ecran);
        champCode.focus();
    });
}

// --- Demarrage ---------------------------------------------------------------

async function demarrer() {
    db.surEchecSauvegarde(() => notifier(
        'Enregistrement impossible. Téléchargez une sauvegarde depuis les Paramètres.', 'critique'));

    await db.charger();

    const miroir = await db.reprendreMiroir();
    if (miroir && miroir.aReautoriser) {
        proposerReautorisation(miroir);
    }

    const code = db.etat.doc.parametres.codePin;
    if (code) await demanderCode(code);

    document.getElementById('app').hidden = false;
    construireNavigation();

    const route = routeDepuisUrl();
    naviguer(route.id, route.options);

    window.addEventListener('hashchange', () => {
        const r = routeDepuisUrl();
        if (r.id !== vueCourante || Object.keys(r.options).length) naviguer(r.id, r.options);
    });

    // Raccourci : « n » ramene a la saisie rapide, sauf en cours de frappe.
    document.addEventListener('keydown', e => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const cible = e.target;
        if (cible && (cible.matches('input, select, textarea') || cible.isContentEditable)) return;
        if (document.body.classList.contains('modale-ouverte')) return;
        if (e.key === 'n' || e.key === 'N') { e.preventDefault(); naviguer('jour'); }
    });

    // Rappel de sauvegarde si aucune copie automatique n'est configuree.
    if (!db.miroirActif() && db.etat.doc.seances.length > 0) {
        setTimeout(() => notifier('Pensez à configurer une sauvegarde dans les Paramètres.', 'attention'), 1500);
    }
}

function proposerReautorisation(miroir) {
    const barre = el('div', { class: 'banniere' }, [
        el('span', { texte: `La sauvegarde automatique vers ${miroir.nom} attend votre autorisation.` }),
        el('button', {
            class: 'bouton bouton--petit bouton--principal', type: 'button',
            on: {
                click: async () => {
                    const ok = await db.reautoriserMiroir(miroir.poignee);
                    if (ok) { notifier('Sauvegarde automatique réactivée.'); barre.remove(); }
                    else notifier('Autorisation refusée.', 'attention');
                },
            },
        }, ['Autoriser']),
        el('button', { class: 'bouton-icone', type: 'button', 'aria-label': 'Ignorer', on: { click: () => barre.remove() } }, ['×']),
    ]);
    document.body.prepend(barre);
}

demarrer().catch(err => {
    console.error(err);
    remplir(document.getElementById('contenu'), [
        el('p', { class: 'etat-vide', texte: 'L’outil n’a pas pu démarrer : ' + err.message }),
    ]);
    document.getElementById('app').hidden = false;
});

// Mise en cache hors ligne.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* hors ligne non critique */ });
}
