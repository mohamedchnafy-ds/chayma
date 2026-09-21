// vue-jour.js — l'ecran d'accueil : enregistrer une seance en quelques secondes.
//
// Priorite affichee par le cabinet : la rapidite de saisie. Le formulaire est
// donc toujours ouvert, prerempli, et le focus revient sur le champ patient
// apres chaque enregistrement pour enchainer les consultations de la journee.

import { el, remplir, champ, saisie, liste, notifier, pastille } from './ui.js';
import * as D from './donnees.js';
import {
    TYPES_SEANCE, MODES_PAIEMENT, aujourdhui, dateLongue, euro, eurosVersCentimes, centimesVersEuros, nomComplet, libelleType, libelleMode, tonStatut, libelleStatut, montantDu, estImpayee,
} from './modele.js';
import { ouvrirFormulaireSeance } from './vue-seances.js';

// La date consultee survit aux re-rendus : on peut saisir plusieurs seances
// d'une meme journee passee sans la ressaisir a chaque fois.
let dateAffichee = null;

export function rendreJour(conteneur, naviguer) {
    const params = D.parametres();
    const jour = dateAffichee || aujourdhui();
    const rafraichir = () => rendreJour(conteneur, naviguer);

    // --- Formulaire de saisie rapide ---------------------------------------
    const listePatients = el('datalist', { id: 'liste-patients' },
        D.patients().filter(p => !p.archive)
            .sort((a, b) => nomComplet(a).localeCompare(nomComplet(b), 'fr'))
            .map(p => el('option', { value: nomComplet(p) })));

    const champPatient = saisie({
        name: 'patient', list: 'liste-patients', autocomplete: 'off',
        placeholder: 'Nom du patient', required: true, 'aria-label': 'Patient',
    });
    const champType = liste(TYPES_SEANCE, params.typeDefaut, { name: 'type', 'aria-label': 'Type de consultation' });
    const champMontant = saisie({
        name: 'montant', type: 'text', inputmode: 'decimal', class: 'saisie saisie--montant',
        value: centimesVersEuros(params.tarifDefaut), 'aria-label': 'Montant en euros',
    });
    const champPaye = el('input', { type: 'checkbox', name: 'paye', checked: true, id: 'jour-paye' });
    const champMode = liste(MODES_PAIEMENT, params.modePaiementDefaut, { name: 'modePaiement', 'aria-label': 'Moyen de paiement' });
    const champDate = saisie({ name: 'date', type: 'date', value: jour, 'aria-label': 'Date de la séance' });
    champDate.addEventListener('change', () => {
        dateAffichee = champDate.value || aujourdhui();
        rafraichir();
    });

    // Choisir un patient connu prerenseigne son tarif et son type habituels.
    champPatient.addEventListener('change', () => {
        const p = D.patients().find(x => nomComplet(x).toLocaleLowerCase('fr') === champPatient.value.trim().toLocaleLowerCase('fr'));
        if (!p) return;
        champMontant.value = centimesVersEuros(p.tarif ?? params.tarifDefaut);
        champType.value = p.type || params.typeDefaut;
    });

    const majEtatMode = () => { champMode.disabled = !champPaye.checked; };
    champPaye.addEventListener('change', majEtatMode);
    majEtatMode();

    const formulaire = el('form', { class: 'saisie-rapide', autocomplete: 'off' }, [
        listePatients,
        el('div', { class: 'saisie-rapide__ligne' }, [
            el('div', { class: 'saisie-rapide__patient' }, [champPatient]),
            champType,
            el('div', { class: 'saisie-rapide__euro' }, [champMontant, el('span', { class: 'suffixe', texte: '€' })]),
            el('label', { class: 'case', for: 'jour-paye' }, [champPaye, el('span', { texte: 'Payé' })]),
            champMode,
            el('button', { class: 'bouton bouton--principal', type: 'submit' }, ['Enregistrer']),
        ]),
        el('div', { class: 'saisie-rapide__pied' }, [
            el('label', { class: 'saisie-rapide__date' }, [el('span', { texte: 'Date' }), champDate]),
            el('span', { class: 'astuce', html: 'Un nom inconnu crée la fiche patient automatiquement · <kbd>N</kbd> pour revenir ici' }),
        ]),
    ]);

    formulaire.addEventListener('submit', e => {
        e.preventDefault();
        const p = D.patientDepuisSaisie(champPatient.value);
        if (!p) { champPatient.focus(); return; }
        const estNouveau = D.seancesDe(p.id).length === 0;
        const montant = eurosVersCentimes(champMontant.value);
        D.creerSeance({
            patientId: p.id,
            date: champDate.value || jour,
            type: champType.value,
            duree: (TYPES_SEANCE.find(t => t.id === champType.value) || {}).duree || 45,
            montant,
            statut: 'honoree',
            paye: champPaye.checked,
            modePaiement: champMode.value,
        });
        notifier(`${nomComplet(p)} · ${euro(montant)}${estNouveau ? ' · fiche créée' : ''}`);
        // On reconstruit l'ecran : la liste du jour, les totaux et les impayes
        // doivent refleter la seance a l'instant ou elle est enregistree.
        // Le rendu redonne le focus au champ patient pour enchainer.
        rafraichir();
    });

    // --- Seances de la journee ----------------------------------------------
    const duJour = D.seances().filter(s => s.date === jour)
        .sort((a, b) => (a.heure || '').localeCompare(b.heure || '') || a.creeLe.localeCompare(b.creeLe));

    const total = duJour.reduce((t, s) => t + montantDu(s), 0);
    const encaisse = duJour.filter(s => s.paye).reduce((t, s) => t + montantDu(s), 0);

    const listeJour = duJour.length
        ? el('ul', { class: 'liste-seances' }, duJour.map(s => ligneSeance(s, rafraichir)))
        : el('p', { class: 'etat-vide', texte: 'Aucune séance enregistrée pour cette date.' });

    // --- Rappel des impayes ---------------------------------------------------
    const impayes = D.seances().filter(estImpayee);
    const totalImpaye = impayes.reduce((t, s) => t + montantDu(s), 0);

    remplir(conteneur, [
        el('header', { class: 'vue__tete' }, [
            el('div', {}, [
                el('h1', { texte: 'Aujourd’hui' }),
                el('p', { class: 'texte-doux', texte: dateLongue(jour) }),
            ]),
            el('div', { class: 'vue__tete-chiffres' }, [
                el('span', {}, [el('strong', { texte: euro(encaisse) }), ' encaissé']),
                total !== encaisse ? el('span', { class: 'texte-doux' }, [`sur ${euro(total)} dû`]) : null,
            ]),
        ]),
        formulaire,
        el('section', { class: 'bloc' }, [
            el('h2', { class: 'bloc__titre', texte: `Séances du jour (${duJour.length})` }),
            listeJour,
        ]),
        impayes.length ? el('section', { class: 'bloc' }, [
            el('h2', { class: 'bloc__titre' }, [
                'À encaisser',
                el('button', {
                    class: 'lien', type: 'button',
                    on: { click: () => naviguer('seances', { impayes: '1' }) },
                }, ['Tout voir']),
            ]),
            el('p', { class: 'resume-impayes' }, [
                el('strong', { texte: euro(totalImpaye) }),
                ` en attente sur ${impayes.length} séance${impayes.length > 1 ? 's' : ''}`,
            ]),
        ]) : null,
    ]);

    champPatient.focus();
}

/** Ligne de seance reutilisee par l'ecran du jour. */
export function ligneSeance(s, rafraichir) {
    const p = D.patient(s.patientId);
    const boutonPaiement = s.paye
        ? el('button', {
            class: 'bouton bouton--fantome bouton--petit', type: 'button',
            title: `Payé par ${libelleMode(s.modePaiement)} — cliquer pour annuler`,
            on: { click: () => { D.basculerPaiement(s.id); rafraichir(); } },
        }, ['✓ ' + libelleMode(s.modePaiement)])
        : el('button', {
            class: 'bouton bouton--principal bouton--petit', type: 'button',
            on: { click: () => { D.basculerPaiement(s.id); rafraichir(); } },
        }, ['Encaisser']);

    return el('li', { class: 'seance' + (s.statut !== 'honoree' ? ' seance--hors' : '') }, [
        el('div', { class: 'seance__id' }, [
            el('span', { class: 'seance__nom', texte: nomComplet(p) }),
            el('span', { class: 'seance__meta', texte: `${libelleType(s.type)} · ${s.duree} min` }),
        ]),
        s.statut !== 'honoree' ? pastille(libelleStatut(s.statut), tonStatut(s.statut)) : null,
        el('span', { class: 'seance__montant', texte: euro(montantDu(s)) }),
        montantDu(s) > 0 ? boutonPaiement : el('span', { class: 'texte-doux', texte: 'Non facturée' }),
        el('button', {
            class: 'bouton-icone', type: 'button', 'aria-label': 'Modifier la séance',
            on: { click: () => ouvrirFormulaireSeance(s, rafraichir) },
        }, ['⋯']),
    ]);
}
