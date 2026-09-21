// vue-dashboard.js — le tableau de bord : ou en est le cabinet, en un coup d'oeil.
//
// Comptabilite de caisse (BNC) : la recette est rattachee a la DATE DE
// PAIEMENT, pas a la date de seance. C'est ce que demandera le comptable.

import { el, remplir } from './ui.js';
import * as D from './donnees.js';
import { histogrammeMensuel, barresHorizontales, jaugeAssiduite } from './graphiques.js';
import {
    euro, dateFr, nomComplet, libelleMois, moisCourant, anneeCourante, derniersMois, encaisseSur, encaisseParMois, repartitionParType, assiduite, montantDu, estImpayee, joursEntre, aujourdhui, TYPES_SEANCE,
} from './modele.js';

export function rendreDashboard(conteneur, naviguer) {
    const seances = D.seances();
    const mois = moisCourant();
    const annee = anneeCourante();
    const jour = aujourdhui();

    // --- Chiffres cles ------------------------------------------------------
    const encaisseMois = encaisseSur(seances, `${mois}-01`, `${mois}-31`);
    const encaisseAnnee = encaisseSur(seances, `${annee}-01-01`, `${annee}-12-31`);

    const moisPrecedent = derniersMois(2)[0];
    const encaissePrecedent = encaisseSur(seances, `${moisPrecedent}-01`, `${moisPrecedent}-31`);
    const variation = encaissePrecedent > 0
        ? Math.round(((encaisseMois - encaissePrecedent) / encaissePrecedent) * 100)
        : null;

    const duMois = seances.filter(s => s.date.startsWith(mois));
    const honoreesMois = duMois.filter(s => s.statut === 'honoree').length;

    const impayees = seances.filter(estImpayee);
    const totalImpaye = impayees.reduce((t, s) => t + montantDu(s), 0);
    const plusAncienImpaye = impayees.map(s => s.date).sort()[0];

    const tuiles = el('div', { class: 'tuiles' }, [
        tuile('Encaissé ce mois-ci', euro(encaisseMois), libelleMois(mois),
            variation === null ? null : {
                texte: `${variation >= 0 ? '+' : ''}${variation} % vs ${libelleMois(moisPrecedent)}`,
                ton: variation >= 0 ? 'bon' : 'attention',
            }),
        tuile('Encaissé en ' + annee, euro(encaisseAnnee), 'Depuis le 1er janvier'),
        tuile('Séances honorées', String(honoreesMois), `Sur ${duMois.length} programmée${duMois.length > 1 ? 's' : ''} ce mois-ci`),
        tuile('En attente de règlement', euro(totalImpaye),
            impayees.length
                ? `${impayees.length} séance${impayees.length > 1 ? 's' : ''} · la plus ancienne il y a ${joursEntre(plusAncienImpaye, jour)} j`
                : 'Tout est à jour',
            totalImpaye > 0 ? { texte: 'À relancer', ton: 'critique' } : null,
            () => naviguer('seances', { impayes: '1' })),
    ]);

    // --- Recettes sur douze mois ---------------------------------------------
    const parMois = encaisseParMois(seances);
    const serie = derniersMois(12).map(cle => ({ cle, valeur: parMois[cle] || 0 }));
    const totalAnnuelGlissant = serie.reduce((t, p) => t + p.valeur, 0);
    const moyenne = Math.round(totalAnnuelGlissant / 12);

    // --- Repartition et assiduite ---------------------------------------------
    const douzeMois = derniersMois(12);
    const surPeriode = seances.filter(s => douzeMois.includes(s.date.slice(0, 7)));
    const repartition = repartitionParType(surPeriode);
    const lignesType = TYPES_SEANCE
        .map(t => ({ label: t.label, valeur: repartition[t.id] || 0 }))
        .filter(l => l.valeur > 0)
        .sort((a, b) => b.valeur - a.valeur);
    const stats = assiduite(surPeriode);

    // --- Impayes les plus anciens ---------------------------------------------
    const relances = impayees
        .slice().sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6)
        .map(s => el('tr', {}, [
            el('td', {}, [el('button', {
                class: 'lien', type: 'button',
                on: { click: () => naviguer('patients', { fiche: s.patientId }) },
            }, [nomComplet(D.patient(s.patientId))])]),
            el('td', { texte: dateFr(s.date) }),
            el('td', { class: 'texte-doux', texte: `${joursEntre(s.date, jour)} j` }),
            el('td', { class: 'colonne-montant', texte: euro(montantDu(s)) }),
        ]));

    remplir(conteneur, [
        el('header', { class: 'vue__tete' }, [
            el('div', {}, [
                el('h1', { texte: 'Tableau de bord' }),
                el('p', { class: 'texte-doux', texte: 'Recettes rattachées à la date d’encaissement, comme en comptabilité de caisse.' }),
            ]),
        ]),
        tuiles,
        el('section', { class: 'bloc' }, [
            el('h2', { class: 'bloc__titre' }, [
                'Recettes encaissées sur douze mois',
                el('span', { class: 'bloc__note', texte: `${euro(totalAnnuelGlissant)} au total · ${euro(moyenne)} par mois en moyenne` }),
            ]),
            histogrammeMensuel(serie),
        ]),
        el('div', { class: 'grille-deux' }, [
            el('section', { class: 'bloc' }, [
                el('h2', { class: 'bloc__titre', texte: 'Types de consultation' }),
                lignesType.length
                    ? barresHorizontales(lignesType)
                    : el('p', { class: 'texte-doux', texte: 'Pas encore de séance honorée.' }),
            ]),
            el('section', { class: 'bloc' }, [
                el('h2', { class: 'bloc__titre' }, [
                    'Assiduité',
                    el('span', { class: 'bloc__note', texte: stats.taux === null ? '' : `${Math.round(stats.taux * 100)} % de séances honorées` }),
                ]),
                jaugeAssiduite(stats) || el('p', { class: 'texte-doux', texte: 'Pas encore de données.' }),
            ]),
        ]),
        relances.length ? el('section', { class: 'bloc' }, [
            el('h2', { class: 'bloc__titre' }, [
                'À relancer en priorité',
                el('button', { class: 'lien', type: 'button', on: { click: () => naviguer('seances', { impayes: '1' }) } }, ['Tout voir']),
            ]),
            el('div', { class: 'tableau-enveloppe' }, [
                el('table', { class: 'tableau tableau--compact' }, [
                    el('thead', {}, [el('tr', {}, ['Patient', 'Séance', 'Ancienneté', 'Montant']
                        .map((t, i) => el('th', { class: i === 3 ? 'colonne-montant' : '', texte: t })))]),
                    el('tbody', {}, relances),
                ]),
            ]),
        ]) : null,
    ]);
}

function tuile(label, valeur, detail, marque, action) {
    const contenu = [
        el('span', { class: 'tuile__label', texte: label }),
        el('strong', { class: 'tuile__valeur', texte: valeur }),
        detail ? el('span', { class: 'tuile__detail', texte: detail }) : null,
        marque ? el('span', { class: `marque marque--${marque.ton}`, texte: marque.texte }) : null,
    ];
    return action
        ? el('button', { class: 'tuile tuile--cliquable', type: 'button', on: { click: action } }, contenu)
        : el('div', { class: 'tuile' }, contenu);
}
