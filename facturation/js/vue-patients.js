// vue-patients.js — fiches patients : coordonnees de facturation, historique, solde.
// Volontairement limite a l'administratif : aucune note clinique n'est stockee ici.

import { el, remplir, champ, saisie, liste, notifier, modale, confirmer, valeurs, pastille } from './ui.js';
import * as D from './donnees.js';
import {
    TYPES_SEANCE, dateFr, euro, eurosVersCentimes, centimesVersEuros, nomComplet, libelleType, montantDu, estImpayee, soldePatient, assiduite,
} from './modele.js';
import { ouvrirApercuFacture } from './vue-factures.js';
import { ouvrirFormulaireSeance } from './vue-seances.js';

let recherche = '';
let voirArchives = false;

export function rendrePatients(conteneur, naviguer, options = {}) {
    const rafraichir = () => rendrePatients(conteneur, naviguer);
    const seances = D.seances();

    let visibles = D.patients().filter(p => voirArchives || !p.archive);
    if (recherche.trim()) {
        const q = recherche.trim().toLocaleLowerCase('fr');
        visibles = visibles.filter(p => nomComplet(p).toLocaleLowerCase('fr').includes(q));
    }
    visibles.sort((a, b) => nomComplet(a).localeCompare(nomComplet(b), 'fr'));

    const champRecherche = saisie({
        type: 'search', value: recherche, placeholder: 'Rechercher un patient…',
        'aria-label': 'Rechercher un patient',
    });
    champRecherche.addEventListener('input', () => {
        recherche = champRecherche.value;
        const pos = champRecherche.selectionStart;
        rafraichir();
        const nouveau = conteneur.querySelector('input[type=search]');
        if (nouveau) { nouveau.focus(); nouveau.setSelectionRange(pos, pos); }
    });

    const lignes = visibles.map(p => {
        const siennes = seances.filter(s => s.patientId === p.id);
        const derniere = siennes.map(s => s.date).sort().pop();
        const solde = soldePatient(seances, p.id);
        return el('tr', { class: p.archive ? 'ligne--hors' : '' }, [
            el('td', {}, [el('button', {
                class: 'lien lien--fort', type: 'button',
                on: { click: () => ouvrirFiche(p.id, rafraichir, naviguer) },
            }, [nomComplet(p)])]),
            el('td', { texte: p.telephone || '—' }),
            el('td', { class: 'colonne-montant', texte: String(siennes.length) }),
            el('td', { texte: derniere ? dateFr(derniere) : '—' }),
            el('td', { class: 'colonne-montant' }, [
                solde > 0 ? pastille(euro(solde), 'critique') : el('span', { class: 'texte-doux', texte: '—' }),
            ]),
            el('td', { class: 'colonne-actions' }, [el('button', {
                class: 'bouton-icone', type: 'button', 'aria-label': 'Modifier la fiche',
                on: { click: () => ouvrirFormulairePatient(p, rafraichir) },
            }, ['⋯'])]),
        ]);
    });

    remplir(conteneur, [
        el('header', { class: 'vue__tete' }, [
            el('div', {}, [
                el('h1', { texte: 'Patients' }),
                el('p', { class: 'texte-doux', texte: `${visibles.length} fiche${visibles.length > 1 ? 's' : ''}` }),
            ]),
            el('button', {
                class: 'bouton bouton--principal', type: 'button',
                on: { click: () => ouvrirFormulairePatient(null, rafraichir) },
            }, ['+ Patient']),
        ]),
        el('div', { class: 'filtres' }, [
            champRecherche,
            el('button', {
                class: 'bascule' + (voirArchives ? ' bascule--active' : ''), type: 'button',
                'aria-pressed': voirArchives ? 'true' : 'false',
                on: { click: () => { voirArchives = !voirArchives; rafraichir(); } },
            }, ['Afficher les fiches archivées']),
        ]),
        visibles.length ? el('div', { class: 'tableau-enveloppe' }, [
            el('table', { class: 'tableau' }, [
                el('thead', {}, [el('tr', {}, [
                    el('th', { texte: 'Patient' }), el('th', { texte: 'Téléphone' }),
                    el('th', { class: 'colonne-montant', texte: 'Séances' }),
                    el('th', { texte: 'Dernière' }),
                    el('th', { class: 'colonne-montant', texte: 'Impayé' }),
                    el('th', { class: 'colonne-actions', 'aria-label': 'Actions' }),
                ])]),
                el('tbody', {}, lignes),
            ]),
        ]) : el('p', { class: 'etat-vide', texte: 'Aucune fiche patient. Une fiche se crée aussi toute seule depuis la saisie rapide.' }),
    ]);

    if (options.fiche) ouvrirFiche(options.fiche, rafraichir, naviguer);
}

export function ouvrirFormulairePatient(patientExistant, apres) {
    const p = patientExistant || {};
    const nouveau = !patientExistant;
    const params = D.parametres();

    const formulaire = el('form', { class: 'formulaire' }, [
        el('div', { class: 'formulaire__paire' }, [
            champ('Prénom', saisie({ name: 'prenom', value: p.prenom || '', required: true })),
            champ('Nom', saisie({ name: 'nom', value: p.nom || '' })),
        ]),
        el('div', { class: 'formulaire__paire' }, [
            champ('Téléphone', saisie({ name: 'telephone', type: 'tel', value: p.telephone || '' })),
            champ('Courriel', saisie({ name: 'email', type: 'email', value: p.email || '' })),
        ]),
        champ('Adresse', saisie({ name: 'adresse', value: p.adresse || '' }),
            'Figure sur la note d’honoraires si elle est renseignée.'),
        el('div', { class: 'formulaire__paire' }, [
            champ('Code postal', saisie({ name: 'codePostal', value: p.codePostal || '' })),
            champ('Ville', saisie({ name: 'ville', value: p.ville || '' })),
        ]),
        el('div', { class: 'formulaire__paire' }, [
            champ('Tarif habituel (€)', saisie({ name: 'tarif', inputmode: 'decimal', value: centimesVersEuros(p.tarif ?? params.tarifDefaut) })),
            champ('Type habituel', liste(TYPES_SEANCE, p.type || params.typeDefaut, { name: 'type' })),
        ]),
        champ('Note administrative', el('textarea', { class: 'saisie', name: 'note', rows: '2' }, [p.note || '']),
            'Facturation uniquement : pas de contenu clinique.'),
    ]);

    return modale({
        titre: nouveau ? 'Nouvelle fiche patient' : 'Modifier la fiche',
        corps: formulaire,
        actions: [
            // Droit a l'effacement : possible tant qu'aucune piece comptable
            // n'a ete emise, celles-ci devant etre conservees dix ans.
            !nouveau && D.facturesDe(p.id).length === 0 ? {
                label: 'Supprimer', style: 'danger-discret', action: async (fermer) => {
                    const ok = await confirmer({
                        titre: 'Supprimer définitivement cette fiche ?',
                        message: 'La fiche et toutes ses séances seront effacées. Préférez l’archivage si vous souhaitez conserver l’historique.',
                        confirmation: 'Supprimer', danger: true,
                    });
                    if (!ok) return;
                    D.supprimerPatient(p.id);
                    notifier('Fiche supprimée.', 'attention');
                    fermer('supprime'); if (apres) apres();
                },
            } : null,
            !nouveau ? {
                label: p.archive ? 'Réactiver' : 'Archiver', action: (fermer) => {
                    D.archiverPatient(p.id, !p.archive);
                    notifier(p.archive ? 'Fiche réactivée.' : 'Fiche archivée.');
                    fermer('archive'); if (apres) apres();
                },
            } : null,
            { label: 'Annuler', action: f => f(null) },
            {
                label: 'Enregistrer', style: 'principal', action: (fermer) => {
                    if (!formulaire.reportValidity()) return;
                    const v = valeurs(formulaire);
                    const donnees = { ...v, tarif: eurosVersCentimes(v.tarif) };
                    if (nouveau) D.creerPatient(donnees); else D.majPatient(p.id, donnees);
                    notifier(nouveau ? 'Fiche créée.' : 'Fiche mise à jour.');
                    fermer('ok'); if (apres) apres();
                },
            },
        ].filter(Boolean),
    });
}

/** Fiche detaillee : coordonnees, chiffres, historique, pieces emises. */
export function ouvrirFiche(patientId, apres, naviguer) {
    const p = D.patient(patientId);
    if (!p) return;
    const siennes = D.seancesDe(p.id);
    const stats = assiduite(siennes);
    const solde = soldePatient(D.seances(), p.id);
    const totalFacture = siennes.reduce((t, s) => t + montantDu(s), 0);

    const corps = el('div', { class: 'fiche' }, [
        el('div', { class: 'fiche__chiffres' }, [
            tuileMini('Séances', String(stats.total)),
            tuileMini('Total dû', euro(totalFacture)),
            tuileMini('Impayé', euro(solde), solde > 0 ? 'critique' : null),
            tuileMini('Assiduité', stats.taux === null ? '—' : `${Math.round(stats.taux * 100)} %`),
        ]),
        p.telephone || p.email || p.adresse ? el('p', { class: 'fiche__coordonnees texte-doux' }, [
            [p.telephone, p.email, [p.adresse, p.codePostal, p.ville].filter(Boolean).join(' ')]
                .filter(Boolean).join(' · '),
        ]) : null,

        el('h3', { class: 'fiche__soustitre', texte: 'Séances' }),
        siennes.length ? el('div', { class: 'tableau-enveloppe tableau-enveloppe--court' }, [
            el('table', { class: 'tableau tableau--compact' }, [
                el('tbody', {}, siennes.slice(0, 40).map(s => el('tr', {}, [
                    el('td', { texte: dateFr(s.date) }),
                    el('td', { texte: libelleType(s.type) }),
                    el('td', { class: 'colonne-montant', texte: euro(montantDu(s)) }),
                    el('td', {}, [estImpayee(s) ? pastille('En attente', 'critique')
                        : montantDu(s) === 0 ? el('span', { class: 'texte-doux', texte: 'Non facturée' })
                            : pastille('Réglée', 'bon')]),
                ]))),
            ]),
        ]) : el('p', { class: 'texte-doux', texte: 'Aucune séance enregistrée.' }),

        el('h3', { class: 'fiche__soustitre', texte: 'Notes d’honoraires' }),
        (() => {
            const pieces = D.facturesDe(p.id);
            return pieces.length
                ? el('ul', { class: 'fiche__pieces' }, pieces.map(f => el('li', {}, [
                    el('button', { class: 'lien', type: 'button', on: { click: () => ouvrirApercuFacture(f.id) } }, [f.numero]),
                    el('span', { class: 'texte-doux', texte: ` ${dateFr(f.date)} · ${euro(f.total)}` }),
                ])))
                : el('p', { class: 'texte-doux', texte: 'Aucune pièce émise.' });
        })(),
    ]);

    return modale({
        titre: nomComplet(p),
        large: true,
        corps,
        actions: [
            { label: 'Modifier la fiche', action: (fermer) => { fermer(null); ouvrirFormulairePatient(p, apres); } },
            { label: 'Fermer', action: f => f(null) },
            {
                label: '+ Séance', style: 'principal', action: (fermer) => {
                    fermer(null);
                    ouvrirFormulaireSeance({ patientId: p.id, type: p.type, montant: p.tarif }, apres);
                },
            },
        ],
    });
}

function tuileMini(label, valeur, ton) {
    return el('div', { class: 'tuile-mini' + (ton ? ` tuile-mini--${ton}` : '') }, [
        el('span', { class: 'tuile-mini__label', texte: label }),
        el('strong', { class: 'tuile-mini__valeur', texte: valeur }),
    ]);
}
