// vue-factures.js — notes d'honoraires : liste, apercu, impression PDF, avoir.
//
// Une piece emise n'est jamais modifiee ni supprimee : la numerotation doit
// rester chronologique, continue et sans trou. Une erreur se corrige par un
// avoir, qui porte son propre numero.

import { el, remplir, notifier, modale, confirmer, pastille } from './ui.js';
import * as D from './donnees.js';
import {
    dateFr, euro, nomComplet, montantDu,
} from './modele.js';

export function rendreFactures(conteneur, naviguer) {
    const rafraichir = () => rendreFactures(conteneur, naviguer);
    const pieces = D.factures().slice()
        .sort((a, b) => b.date.localeCompare(a.date) || b.numero.localeCompare(a.numero));

    const lignes = pieces.map(f => {
        const seancesLiees = f.lignes.map(l => D.seance(l.seanceId)).filter(Boolean);
        const soldee = f.type === 'avoir' || (seancesLiees.length > 0 && seancesLiees.every(s => s.paye));
        return el('tr', { class: f.annuleePar ? 'ligne--hors' : '' }, [
            el('td', {}, [el('strong', { texte: f.numero })]),
            el('td', { texte: dateFr(f.date) }),
            el('td', { texte: f.destinataire.nom }),
            el('td', {}, [f.type === 'avoir' ? pastille('Avoir', 'attention') : el('span', { class: 'texte-doux', texte: 'Note d’honoraires' })]),
            el('td', { class: 'colonne-montant', texte: euro(f.total) }),
            el('td', {}, [
                f.annuleePar ? pastille('Annulée', 'attention')
                    : f.type === 'avoir' ? el('span', { class: 'texte-doux', texte: '—' })
                        : soldee ? pastille('Réglée', 'bon') : pastille('En attente', 'critique'),
            ]),
            el('td', { class: 'colonne-actions' }, [
                el('button', {
                    class: 'bouton bouton--fantome bouton--petit', type: 'button',
                    on: { click: () => ouvrirApercuFacture(f.id, rafraichir) },
                }, ['Ouvrir']),
            ]),
        ]);
    });

    const parAnnee = {};
    for (const f of pieces) {
        const a = f.date.slice(0, 4);
        parAnnee[a] = (parAnnee[a] || 0) + f.total;
    }

    remplir(conteneur, [
        el('header', { class: 'vue__tete' }, [
            el('div', {}, [
                el('h1', { texte: 'Notes d’honoraires' }),
                el('p', { class: 'texte-doux', texte: `${pieces.length} pièce${pieces.length > 1 ? 's' : ''} émise${pieces.length > 1 ? 's' : ''}` }),
            ]),
            el('button', {
                class: 'bouton bouton--principal', type: 'button',
                on: { click: () => ouvrirCreationFacture(rafraichir) },
            }, ['+ Note d’honoraires']),
        ]),
        Object.keys(parAnnee).length ? el('div', { class: 'rappel' },
            Object.entries(parAnnee).sort((a, b) => b[0].localeCompare(a[0])).map(([a, t]) =>
                el('span', {}, [el('strong', { texte: a }), ` · ${euro(t)} facturés`]))) : null,
        pieces.length ? el('div', { class: 'tableau-enveloppe' }, [
            el('table', { class: 'tableau' }, [
                el('thead', {}, [el('tr', {}, ['Numéro', 'Date', 'Patient', 'Type', 'Montant', 'Règlement', '']
                    .map((t, i) => el('th', { class: i === 4 ? 'colonne-montant' : (i === 6 ? 'colonne-actions' : ''), texte: t })))]),
                el('tbody', {}, lignes),
            ]),
        ]) : el('p', {
            class: 'etat-vide',
            texte: 'Aucune note d’honoraires. Sélectionnez des séances dans le registre pour en créer une.',
        }),
    ]);
}

/** Creation depuis zero : on choisit un patient, puis ses seances non facturees. */
export function ouvrirCreationFacture(apres) {
    const candidats = D.patients().filter(p =>
        D.seancesDe(p.id).some(s => !s.factureId && montantDu(s) > 0));

    if (!candidats.length) {
        notifier('Aucune séance à facturer.', 'attention');
        return;
    }

    const conteneur = el('div', { class: 'formulaire' });
    const selectPatient = el('select', { class: 'saisie' },
        [el('option', { value: '' }, ['Choisir un patient…']),
        ...candidats.sort((a, b) => nomComplet(a).localeCompare(nomComplet(b), 'fr'))
            .map(p => el('option', { value: p.id }, [nomComplet(p)]))]);

    const zoneSeances = el('div', { class: 'choix-seances' });
    const selection = new Set();
    const pied = el('p', { class: 'choix-seances__total', texte: 'Aucune séance sélectionnée.' });

    const majTotal = () => {
        const somme = [...selection].reduce((t, id) => t + montantDu(D.seance(id)), 0);
        pied.textContent = selection.size
            ? `${selection.size} séance${selection.size > 1 ? 's' : ''} · ${euro(somme)}`
            : 'Aucune séance sélectionnée.';
    };

    selectPatient.addEventListener('change', () => {
        selection.clear();
        majTotal();
        const lot = D.seancesDe(selectPatient.value).filter(s => !s.factureId && montantDu(s) > 0);
        remplir(zoneSeances, lot.map(s => {
            const c = el('input', { type: 'checkbox', checked: true });
            selection.add(s.id);
            c.addEventListener('change', () => {
                if (c.checked) selection.add(s.id); else selection.delete(s.id);
                majTotal();
            });
            return el('label', { class: 'choix-seances__ligne' }, [
                c,
                el('span', { texte: dateFr(s.date) }),
                el('span', { class: 'texte-doux', texte: s.paye ? 'réglée' : 'en attente' }),
                el('span', { class: 'colonne-montant', texte: euro(montantDu(s)) }),
            ]);
        }));
        majTotal();
    });

    remplir(conteneur, [
        el('label', { class: 'champ' }, [el('span', { class: 'champ__label', texte: 'Patient' }), selectPatient]),
        zoneSeances, pied,
    ]);

    modale({
        titre: 'Nouvelle note d’honoraires',
        corps: conteneur,
        actions: [
            { label: 'Annuler', action: f => f(null) },
            {
                label: 'Créer', style: 'principal', action: (fermer) => {
                    if (!selectPatient.value || !selection.size) {
                        notifier('Choisissez un patient et au moins une séance.', 'attention');
                        return;
                    }
                    try {
                        const f = D.creerFacture(selectPatient.value, [...selection]);
                        notifier(`Note d’honoraires ${f.numero} créée.`);
                        fermer('ok');
                        ouvrirApercuFacture(f.id, apres);
                        if (apres) apres();
                    } catch (err) { notifier(err.message, 'critique'); }
                },
            },
        ],
    });
}

/** Apercu conforme, avec impression PDF. */
export function ouvrirApercuFacture(factureId, apres) {
    const f = D.facture(factureId);
    if (!f) return;

    const apercu = el('div', { class: 'apercu' }, [gabarit(f)]);

    modale({
        titre: `${f.type === 'avoir' ? 'Avoir' : 'Note d’honoraires'} ${f.numero}`,
        large: true,
        corps: apercu,
        actions: [
            f.type === 'facture' && !f.annuleePar ? {
                label: 'Annuler par un avoir', style: 'danger-discret', action: async (fermer) => {
                    const ok = await confirmer({
                        titre: 'Émettre un avoir ?',
                        message: `La note ${f.numero} sera annulée par un avoir portant son propre numéro. `
                            + 'Les séances redeviendront facturables. Cette opération est définitive.',
                        confirmation: 'Émettre l’avoir', danger: true,
                    });
                    if (!ok) return;
                    try {
                        const avoir = D.creerAvoir(f.id);
                        notifier(`Avoir ${avoir.numero} émis.`);
                        fermer('avoir');
                        if (apres) apres();
                        ouvrirApercuFacture(avoir.id, apres);
                    } catch (err) { notifier(err.message, 'critique'); }
                },
            } : null,
            { label: 'Fermer', action: f2 => f2(null) },
            { label: 'Imprimer / PDF', style: 'principal', action: () => imprimerFacture(f.id) },
        ].filter(Boolean),
    });
}

/**
 * Impression : on injecte le gabarit dans un conteneur dedie et on laisse le
 * navigateur produire le PDF (« Destination : Enregistrer au format PDF »).
 * Aucune librairie, donc aucune dependance reseau.
 */
export function imprimerFacture(factureId) {
    const f = D.facture(factureId);
    if (!f) return;
    const zone = document.getElementById('impression');
    remplir(zone, [gabarit(f)]);
    document.body.classList.add('impression-active');
    const nettoyer = () => {
        document.body.classList.remove('impression-active');
        remplir(zone, []);
        window.removeEventListener('afterprint', nettoyer);
    };
    window.addEventListener('afterprint', nettoyer);
    window.print();
}

/** Gabarit A4 de la piece. Porte toutes les mentions obligatoires. */
function gabarit(f) {
    const p = D.parametres();
    const pr = p.praticien;
    const avoir = f.type === 'avoir';
    const seancesLiees = f.lignes.map(l => D.seance(l.seanceId)).filter(Boolean);
    const reglee = seancesLiees.length > 0 && seancesLiees.every(s => s.paye);
    const dernierReglement = reglee
        ? seancesLiees.map(s => s.datePaiement).filter(Boolean).sort().pop()
        : null;

    const identite = [
        pr.adresse, [pr.codePostal, pr.ville].filter(Boolean).join(' '),
        pr.telephone, pr.email,
    ].filter(Boolean);

    const mentionsLegales = [
        pr.siret ? `SIRET ${pr.siret}` : null,
        pr.adeli ? `N° ADELI ${pr.adeli}` : null,
        p.mentionTva,
    ].filter(Boolean);

    return el('article', { class: 'piece' }, [
        el('header', { class: 'piece__tete' }, [
            el('div', { class: 'piece__emetteur' }, [
                el('h1', { texte: pr.nom || 'Nom du praticien' }),
                el('p', { class: 'piece__titre', texte: pr.titre || '' }),
                el('div', { class: 'piece__coordonnees' }, identite.map(l => el('div', { texte: l }))),
            ]),
            el('div', { class: 'piece__reference' }, [
                el('h2', { texte: avoir ? 'AVOIR' : 'NOTE D’HONORAIRES' }),
                el('p', {}, [el('strong', { texte: f.numero })]),
                el('p', { texte: `Émise le ${dateFr(f.date)}` }),
                avoir ? el('p', { class: 'piece__annulation', texte: `Annule la note ${f.numeroOrigine}` }) : null,
                f.annuleePar ? el('p', { class: 'piece__annulation', texte: 'Annulée par un avoir' }) : null,
            ]),
        ]),

        el('section', { class: 'piece__destinataire' }, [
            el('span', { class: 'piece__intitule', texte: 'Destinataire' }),
            el('div', {}, [
                el('strong', { texte: f.destinataire.nom }),
                f.destinataire.adresse ? el('div', { texte: f.destinataire.adresse }) : null,
                (f.destinataire.codePostal || f.destinataire.ville)
                    ? el('div', { texte: [f.destinataire.codePostal, f.destinataire.ville].filter(Boolean).join(' ') })
                    : null,
            ]),
        ]),

        el('table', { class: 'piece__lignes' }, [
            el('thead', {}, [el('tr', {}, [
                el('th', { texte: 'Date' }),
                el('th', { texte: 'Prestation' }),
                el('th', { class: 'colonne-montant', texte: 'Montant' }),
            ])]),
            el('tbody', {}, f.lignes.map(l => el('tr', {}, [
                el('td', { texte: dateFr(l.date) }),
                el('td', { texte: l.libelle }),
                el('td', { class: 'colonne-montant', texte: euro(l.montant) }),
            ]))),
            el('tfoot', {}, [el('tr', {}, [
                el('td', { colspan: '2', texte: avoir ? 'Total de l’avoir' : 'Total à régler' }),
                el('td', { class: 'colonne-montant piece__total', texte: euro(f.total) }),
            ])]),
        ]),

        el('section', { class: 'piece__reglement' }, [
            reglee
                ? el('p', { texte: `Réglé${dernierReglement ? ` le ${dateFr(dernierReglement)}` : ''}. Acquitté.` })
                : el('p', { texte: `À régler sous ${p.delaiPaiementJours} jours à compter de la date d’émission.` }),
            pr.iban && !reglee ? el('p', { class: 'texte-doux', texte: `IBAN : ${pr.iban}` }) : null,
        ]),

        el('footer', { class: 'piece__pied' }, [
            el('p', { class: 'piece__mentions', texte: mentionsLegales.join(' · ') }),
            p.mentionPied ? el('p', { class: 'piece__note', texte: p.mentionPied }) : null,
        ]),
    ]);
}
