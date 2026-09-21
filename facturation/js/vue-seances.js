// vue-seances.js — le registre des seances : filtres, encaissement, facturation.

import {
    el, remplir, champ, saisie, liste, notifier, modale, confirmer, pastille, valeurs,
} from './ui.js';
import * as D from './donnees.js';
import {
    TYPES_SEANCE, MODES_PAIEMENT, STATUTS_SEANCE, aujourdhui, dateFr, euro, eurosVersCentimes, centimesVersEuros, nomComplet, libelleType, libelleMode, libelleStatut, tonStatut, montantDu, estImpayee, libelleMois,
} from './modele.js';
import { ouvrirApercuFacture } from './vue-factures.js';

/** Formulaire complet d'une seance (creation ou modification). */
export function ouvrirFormulaireSeance(seanceExistante, apres) {
    const params = D.parametres();
    const s = seanceExistante || {};
    // Un objet sans identifiant sert de valeurs de depart pour une creation.
    const estNouvelle = !seanceExistante || !seanceExistante.id;

    const options = D.patients().filter(p => !p.archive || p.id === s.patientId)
        .sort((a, b) => nomComplet(a).localeCompare(nomComplet(b), 'fr'))
        .map(p => ({ id: p.id, label: nomComplet(p) }));

    if (!options.length) {
        notifier('Créez d’abord une fiche patient.', 'attention');
        return Promise.resolve(null);
    }

    const champPaye = el('input', { type: 'checkbox', name: 'paye', checked: !!s.paye, id: 'f-paye' });
    const champMode = liste(MODES_PAIEMENT, s.modePaiement || params.modePaiementDefaut, { name: 'modePaiement' });
    const champDatePaiement = saisie({ name: 'datePaiement', type: 'date', value: s.datePaiement || '' });
    const bascule = () => {
        champMode.disabled = !champPaye.checked;
        champDatePaiement.disabled = !champPaye.checked;
    };
    champPaye.addEventListener('change', () => {
        if (champPaye.checked && !champDatePaiement.value) champDatePaiement.value = aujourdhui();
        bascule();
    });
    bascule();

    const formulaire = el('form', { id: 'form-seance', class: 'formulaire' }, [
        champ('Patient', liste(options, s.patientId, { name: 'patientId', required: true })),
        el('div', { class: 'formulaire__paire' }, [
            champ('Date', saisie({ name: 'date', type: 'date', value: s.date || aujourdhui(), required: true })),
            champ('Heure', saisie({ name: 'heure', type: 'time', value: s.heure || '' })),
        ]),
        el('div', { class: 'formulaire__paire' }, [
            champ('Type', liste(TYPES_SEANCE, s.type || params.typeDefaut, { name: 'type' })),
            champ('Durée (min)', saisie({ name: 'duree', type: 'number', min: '0', step: '5', value: s.duree || 45 })),
        ]),
        el('div', { class: 'formulaire__paire' }, [
            champ('Montant (€)', saisie({ name: 'montant', inputmode: 'decimal', value: centimesVersEuros(s.montant ?? params.tarifDefaut) })),
            champ('Statut', liste(STATUTS_SEANCE, s.statut || 'honoree', { name: 'statut' }),
                'Une annulation à temps n’est pas facturée : laissez le montant à 0.'),
        ]),
        el('fieldset', { class: 'formulaire__bloc' }, [
            el('legend', { texte: 'Règlement' }),
            el('label', { class: 'case', for: 'f-paye' }, [champPaye, el('span', { texte: 'Séance réglée' })]),
            el('div', { class: 'formulaire__paire' }, [
                champ('Moyen', champMode),
                champ('Date du règlement', champDatePaiement),
            ]),
        ]),
        champ('Note administrative', el('textarea', { class: 'saisie', name: 'note', rows: '2' }, [s.note || '']),
            'Aucune donnée clinique ici : cet outil ne gère que la facturation.'),
    ]);

    return modale({
        titre: estNouvelle ? 'Nouvelle séance' : 'Modifier la séance',
        corps: formulaire,
        actions: [
            !estNouvelle && !s.factureId ? {
                label: 'Supprimer', style: 'danger-discret', action: async (fermer) => {
                    const ok = await confirmer({
                        titre: 'Supprimer cette séance ?',
                        message: 'Elle disparaîtra définitivement du registre.',
                        confirmation: 'Supprimer', danger: true,
                    });
                    if (ok) { D.supprimerSeance(s.id); fermer('supprime'); if (apres) apres(); }
                },
            } : null,
            { label: 'Annuler', action: f => f(null) },
            {
                label: 'Enregistrer', style: 'principal', action: (fermer) => {
                    if (!formulaire.reportValidity()) return;
                    const v = valeurs(formulaire);
                    const donnees = {
                        patientId: v.patientId,
                        date: v.date,
                        heure: v.heure,
                        duree: Number(v.duree) || 45,
                        type: v.type,
                        montant: eurosVersCentimes(v.montant),
                        statut: v.statut,
                        paye: v.paye,
                        modePaiement: v.paye ? v.modePaiement : null,
                        datePaiement: v.paye ? (v.datePaiement || v.date) : null,
                        note: v.note,
                    };
                    if (estNouvelle) D.creerSeance(donnees); else D.majSeance(s.id, donnees);
                    notifier(estNouvelle ? 'Séance enregistrée.' : 'Séance mise à jour.');
                    fermer('ok');
                    if (apres) apres();
                },
            },
        ].filter(Boolean),
    });
}

// --- Ecran registre -----------------------------------------------------------

const filtres = { mois: '', patient: '', statut: '', impayes: false, aFacturer: false };

export function rendreSeances(conteneur, naviguer, options = {}) {
    if (options.impayes) { filtres.impayes = true; filtres.mois = ''; }
    if (options.patient) filtres.patient = options.patient;

    const toutes = D.seances();
    const moisDisponibles = [...new Set(toutes.map(s => s.date.slice(0, 7)))].sort().reverse();

    let visibles = toutes.slice();
    if (filtres.mois) visibles = visibles.filter(s => s.date.startsWith(filtres.mois));
    if (filtres.patient) visibles = visibles.filter(s => s.patientId === filtres.patient);
    if (filtres.statut) visibles = visibles.filter(s => s.statut === filtres.statut);
    if (filtres.impayes) visibles = visibles.filter(estImpayee);
    if (filtres.aFacturer) visibles = visibles.filter(s => !s.factureId && montantDu(s) > 0);
    visibles.sort((a, b) => b.date.localeCompare(a.date) || (b.heure || '').localeCompare(a.heure || ''));

    const rafraichir = () => rendreSeances(conteneur, naviguer);
    const selection = new Set();

    const total = visibles.reduce((t, s) => t + montantDu(s), 0);
    const restant = visibles.filter(estImpayee).reduce((t, s) => t + montantDu(s), 0);

    // --- Barre de filtres ------------------------------------------------------
    const filtreMois = liste(
        [{ id: '', label: 'Tous les mois' }, ...moisDisponibles.map(m => ({ id: m, label: libelleMois(m) }))],
        filtres.mois, { 'aria-label': 'Filtrer par mois' });
    filtreMois.addEventListener('change', () => { filtres.mois = filtreMois.value; rafraichir(); });

    const filtrePatient = liste(
        [{ id: '', label: 'Tous les patients' }, ...D.patients()
            .sort((a, b) => nomComplet(a).localeCompare(nomComplet(b), 'fr'))
            .map(p => ({ id: p.id, label: nomComplet(p) }))],
        filtres.patient, { 'aria-label': 'Filtrer par patient' });
    filtrePatient.addEventListener('change', () => { filtres.patient = filtrePatient.value; rafraichir(); });

    const filtreStatut = liste(
        [{ id: '', label: 'Tous les statuts' }, ...STATUTS_SEANCE],
        filtres.statut, { 'aria-label': 'Filtrer par statut' });
    filtreStatut.addEventListener('change', () => { filtres.statut = filtreStatut.value; rafraichir(); });

    const bascules = el('div', { class: 'filtres__bascules' }, [
        bouton_bascule('Impayées', filtres.impayes, () => { filtres.impayes = !filtres.impayes; rafraichir(); }),
        bouton_bascule('À facturer', filtres.aFacturer, () => { filtres.aFacturer = !filtres.aFacturer; rafraichir(); }),
        (filtres.mois || filtres.patient || filtres.statut || filtres.impayes || filtres.aFacturer)
            ? el('button', {
                class: 'lien', type: 'button',
                on: { click: () => { Object.assign(filtres, { mois: '', patient: '', statut: '', impayes: false, aFacturer: false }); rafraichir(); } },
            }, ['Réinitialiser']) : null,
    ]);

    // --- Tableau ---------------------------------------------------------------
    const barreSelection = el('div', { class: 'barre-selection', hidden: true });
    const majBarre = () => {
        const ids = [...selection];
        barreSelection.hidden = ids.length === 0;
        if (!ids.length) return;
        const lot = ids.map(id => D.seance(id));
        const patientsDistincts = new Set(lot.map(s => s.patientId));
        const somme = lot.reduce((t, s) => t + montantDu(s), 0);
        remplir(barreSelection, [
            el('span', {}, [el('strong', { texte: String(ids.length) }), ` séance${ids.length > 1 ? 's' : ''} · ${euro(somme)}`]),
            patientsDistincts.size > 1
                ? el('span', { class: 'texte-doux', texte: 'Une note d’honoraires ne peut couvrir qu’un seul patient.' })
                : el('button', {
                    class: 'bouton bouton--principal bouton--petit', type: 'button',
                    on: {
                        click: () => {
                            try {
                                const f = D.creerFacture([...patientsDistincts][0], ids);
                                notifier(`Note d’honoraires ${f.numero} créée.`);
                                ouvrirApercuFacture(f.id);
                                rafraichir();
                            } catch (err) { notifier(err.message, 'critique'); }
                        },
                    },
                }, ['Créer la note d’honoraires']),
            el('button', { class: 'lien', type: 'button', on: { click: () => { selection.clear(); rafraichir(); } } }, ['Désélectionner']),
        ]);
    };

    const corps = visibles.map(s => {
        const p = D.patient(s.patientId);
        const f = s.factureId ? D.facture(s.factureId) : null;
        const facturable = !s.factureId && montantDu(s) > 0;

        const caseSel = el('input', {
            type: 'checkbox', 'aria-label': 'Sélectionner pour facturation', disabled: !facturable,
        });
        caseSel.addEventListener('change', () => {
            if (caseSel.checked) selection.add(s.id); else selection.delete(s.id);
            majBarre();
        });

        return el('tr', { class: s.statut !== 'honoree' ? 'ligne--hors' : '' }, [
            el('td', { class: 'colonne-case' }, [caseSel]),
            el('td', {}, [
                el('span', { texte: dateFr(s.date) }),
                s.heure ? el('span', { class: 'texte-doux', texte: ' ' + s.heure }) : null,
            ]),
            el('td', {}, [el('button', {
                class: 'lien', type: 'button',
                on: { click: () => naviguer('patients', { fiche: s.patientId }) },
            }, [nomComplet(p)])]),
            el('td', { texte: libelleType(s.type) }),
            el('td', {}, [s.statut === 'honoree' ? el('span', { class: 'texte-doux', texte: '—' }) : pastille(libelleStatut(s.statut), tonStatut(s.statut))]),
            el('td', { class: 'colonne-montant', texte: euro(montantDu(s)) }),
            el('td', {}, [
                montantDu(s) === 0 ? el('span', { class: 'texte-doux', texte: '—' })
                    : s.paye ? pastille('Réglé · ' + libelleMode(s.modePaiement), 'bon')
                        : el('button', {
                            class: 'bouton bouton--principal bouton--petit', type: 'button',
                            on: { click: () => { D.basculerPaiement(s.id); rafraichir(); } },
                        }, ['Encaisser']),
            ]),
            el('td', {}, [f
                ? el('button', { class: 'lien', type: 'button', on: { click: () => ouvrirApercuFacture(f.id) } }, [f.numero])
                : el('span', { class: 'texte-doux', texte: '—' })]),
            el('td', { class: 'colonne-actions' }, [el('button', {
                class: 'bouton-icone', type: 'button', 'aria-label': 'Modifier',
                on: { click: () => ouvrirFormulaireSeance(s, rafraichir) },
            }, ['⋯'])]),
        ]);
    });

    remplir(conteneur, [
        el('header', { class: 'vue__tete' }, [
            el('div', {}, [
                el('h1', { texte: 'Séances' }),
                el('p', { class: 'texte-doux', texte: `${visibles.length} séance${visibles.length > 1 ? 's' : ''} · ${euro(total)} dû · ${euro(restant)} en attente` }),
            ]),
            el('button', {
                class: 'bouton bouton--principal', type: 'button',
                on: { click: () => ouvrirFormulaireSeance(null, rafraichir) },
            }, ['+ Séance']),
        ]),
        el('div', { class: 'filtres' }, [filtreMois, filtrePatient, filtreStatut, bascules]),
        barreSelection,
        visibles.length ? el('div', { class: 'tableau-enveloppe' }, [
            el('table', { class: 'tableau' }, [
                el('thead', {}, [el('tr', {}, [
                    el('th', { class: 'colonne-case', 'aria-label': 'Sélection' }),
                    el('th', { texte: 'Date' }), el('th', { texte: 'Patient' }),
                    el('th', { texte: 'Type' }), el('th', { texte: 'Statut' }),
                    el('th', { class: 'colonne-montant', texte: 'Montant' }),
                    el('th', { texte: 'Règlement' }), el('th', { texte: 'Note d’hon.' }),
                    el('th', { class: 'colonne-actions', 'aria-label': 'Actions' }),
                ])]),
                el('tbody', {}, corps),
            ]),
        ]) : el('p', { class: 'etat-vide', texte: 'Aucune séance ne correspond à ces filtres.' }),
    ]);
}

function bouton_bascule(label, actif, action) {
    return el('button', {
        class: 'bascule' + (actif ? ' bascule--active' : ''), type: 'button',
        'aria-pressed': actif ? 'true' : 'false', on: { click: action },
    }, [label]);
}
