// vue-parametres.js — identite du cabinet, mentions legales, sauvegardes, export comptable.

import { el, remplir, champ, saisie, liste, notifier, confirmer, valeurs, modale } from './ui.js';
import * as db from './db.js';
import * as D from './donnees.js';
import {
    TYPES_SEANCE, MODES_PAIEMENT, MOIS_COURTS, euro, centimesVersEuros, eurosVersCentimes, nomComplet, libelleType, libelleMode, montantDu, anneeCourante,
} from './modele.js';

export function rendreParametres(conteneur, naviguer) {
    const rafraichir = () => rendreParametres(conteneur, naviguer);
    const p = D.parametres();
    const pr = p.praticien;

    // --- Identite et mentions ------------------------------------------------
    const formIdentite = el('form', { class: 'formulaire' }, [
        el('div', { class: 'formulaire__paire' }, [
            champ('Nom affiché', saisie({ name: 'nom', value: pr.nom || '' })),
            champ('Titre', saisie({ name: 'titre', value: pr.titre || '' })),
        ]),
        champ('Adresse du cabinet', saisie({ name: 'adresse', value: pr.adresse || '' })),
        el('div', { class: 'formulaire__paire' }, [
            champ('Code postal', saisie({ name: 'codePostal', value: pr.codePostal || '' })),
            champ('Ville', saisie({ name: 'ville', value: pr.ville || '' })),
        ]),
        el('div', { class: 'formulaire__paire' }, [
            champ('Téléphone', saisie({ name: 'telephone', type: 'tel', value: pr.telephone || '' })),
            champ('Courriel', saisie({ name: 'email', type: 'email', value: pr.email || '' })),
        ]),
        el('div', { class: 'formulaire__paire' }, [
            champ('SIRET', saisie({ name: 'siret', value: pr.siret || '' }), 'Mention obligatoire sur la note d’honoraires.'),
            champ('N° ADELI', saisie({ name: 'adeli', value: pr.adeli || '' }), 'Numéro d’enregistrement du psychologue.'),
        ]),
        champ('IBAN', saisie({ name: 'iban', value: pr.iban || '' }), 'Affiché uniquement sur les notes non réglées.'),
        el('button', { class: 'bouton bouton--principal', type: 'submit' }, ['Enregistrer l’identité']),
    ]);
    formIdentite.addEventListener('submit', e => {
        e.preventDefault();
        D.majParametres({ praticien: valeurs(formIdentite) });
        notifier('Identité enregistrée.');
    });

    const formMentions = el('form', { class: 'formulaire' }, [
        champ('Mention de TVA', saisie({ name: 'mentionTva', value: p.mentionTva || '' }),
            'Psychologue diplômée : exonération au titre de l’article 261-4-1° du CGI. À confirmer avec votre comptable.'),
        champ('Mention de bas de page', saisie({ name: 'mentionPied', value: p.mentionPied || '' })),
        el('div', { class: 'formulaire__paire' }, [
            champ('Préfixe de numérotation', saisie({ name: 'prefixeNumero', value: p.prefixeNumero || '' }),
                `Aperçu : ${p.prefixeNumero ? p.prefixeNumero + '-' : ''}${anneeCourante()}-0001`),
            champ('Délai de règlement (jours)', saisie({ name: 'delaiPaiementJours', type: 'number', min: '0', value: p.delaiPaiementJours })),
        ]),
        el('button', { class: 'bouton bouton--principal', type: 'submit' }, ['Enregistrer les mentions']),
    ]);
    formMentions.addEventListener('submit', e => {
        e.preventDefault();
        const v = valeurs(formMentions);
        D.majParametres({ ...v, delaiPaiementJours: Number(v.delaiPaiementJours) || 30 });
        notifier('Mentions enregistrées.');
        rafraichir();
    });

    const formDefauts = el('form', { class: 'formulaire' }, [
        el('div', { class: 'formulaire__triple' }, [
            champ('Tarif par défaut (€)', saisie({ name: 'tarifDefaut', inputmode: 'decimal', value: centimesVersEuros(p.tarifDefaut) })),
            champ('Type par défaut', liste(TYPES_SEANCE, p.typeDefaut, { name: 'typeDefaut' })),
            champ('Moyen de paiement', liste(MODES_PAIEMENT, p.modePaiementDefaut, { name: 'modePaiementDefaut' })),
        ]),
        el('button', { class: 'bouton bouton--principal', type: 'submit' }, ['Enregistrer les valeurs par défaut']),
    ]);
    formDefauts.addEventListener('submit', e => {
        e.preventDefault();
        const v = valeurs(formDefauts);
        D.majParametres({ ...v, tarifDefaut: eurosVersCentimes(v.tarifDefaut) });
        notifier('Valeurs par défaut enregistrées.');
    });

    remplir(conteneur, [
        el('header', { class: 'vue__tete' }, [
            el('div', {}, [
                el('h1', { texte: 'Paramètres' }),
                el('p', { class: 'texte-doux', texte: 'Ces informations alimentent les mentions obligatoires des notes d’honoraires.' }),
            ]),
        ]),
        bloc('Identité du cabinet', formIdentite),
        bloc('Mentions légales et numérotation', formMentions),
        bloc('Valeurs par défaut de la saisie rapide', formDefauts),
        blocSauvegarde(rafraichir),
        blocExport(),
        blocVerrou(rafraichir),
        blocDanger(rafraichir),
    ]);
}

function bloc(titre, contenu, note) {
    return el('section', { class: 'bloc' }, [
        el('h2', { class: 'bloc__titre', texte: titre }),
        note ? el('p', { class: 'texte-doux', texte: note }) : null,
        contenu,
    ]);
}

// --- Sauvegardes ---------------------------------------------------------------

function blocSauvegarde(rafraichir) {
    const doc = db.etat.doc;
    const etatMiroir = db.miroirActif()
        ? el('p', { class: 'etat-ok' }, ['Copie automatique active vers ', el('strong', { texte: db.nomMiroir() })])
        : el('p', { class: 'etat-attention', texte: 'Aucune copie automatique. Les données ne vivent que dans ce navigateur.' });

    const actions = el('div', { class: 'actions-ligne' }, [
        db.miroirDisponible() ? el('button', {
            class: 'bouton bouton--principal', type: 'button',
            on: {
                click: async () => {
                    try {
                        const nom = await db.choisirMiroir();
                        notifier(`Copie automatique vers ${nom}.`);
                        rafraichir();
                    } catch (err) {
                        if (err && err.name !== 'AbortError') notifier('Impossible de configurer la copie.', 'critique');
                    }
                },
            },
        }, [db.miroirActif() ? 'Changer le fichier de sauvegarde' : 'Choisir un fichier de sauvegarde']) : null,
        el('button', {
            class: 'bouton bouton--fantome', type: 'button',
            on: {
                click: () => {
                    const date = new Date().toISOString().slice(0, 10);
                    telecharger(`sauvegarde-cabinet-${date}.json`, db.exporterJson(), 'application/json');
                    notifier('Sauvegarde téléchargée.');
                },
            },
        }, ['Télécharger une sauvegarde']),
        el('button', {
            class: 'bouton bouton--fantome', type: 'button',
            on: { click: () => importer(rafraichir) },
        }, ['Restaurer une sauvegarde']),
    ]);

    return bloc('Sauvegarde',
        el('div', {}, [
            etatMiroir,
            !db.miroirDisponible()
                ? el('p', { class: 'texte-doux', texte: 'Ce navigateur ne permet pas la copie automatique dans un fichier. Utilisez Chrome ou Edge, ou téléchargez une sauvegarde régulièrement.' })
                : null,
            actions,
            el('p', { class: 'texte-doux', texte: doc.modifieLe ? `Dernière modification : ${new Date(doc.modifieLe).toLocaleString('fr-FR')}` : 'Aucune donnée enregistrée pour l’instant.' }),
        ]),
        'Les données ne quittent jamais cet ordinateur. C’est vous qui en détenez la seule copie : gardez une sauvegarde à jour.');
}

function importer(rafraichir) {
    const entree = el('input', { type: 'file', accept: 'application/json,.json' });
    entree.addEventListener('change', async () => {
        const fichier = entree.files[0];
        if (!fichier) return;
        const ok = await confirmer({
            titre: 'Restaurer cette sauvegarde ?',
            message: 'Toutes les données actuellement présentes dans cet outil seront remplacées.',
            confirmation: 'Restaurer', danger: true,
        });
        if (!ok) return;
        try {
            await db.importerJson(await fichier.text());
            notifier('Sauvegarde restaurée.');
            rafraichir();
        } catch (err) {
            notifier(err.message || 'Fichier illisible.', 'critique');
        }
    });
    entree.click();
}

// --- Export comptable ------------------------------------------------------------

function blocExport() {
    const annees = [...new Set(D.seances().map(s => s.date.slice(0, 4)))].sort().reverse();
    if (!annees.length) return bloc('Export comptable', el('p', { class: 'texte-doux', texte: 'Rien à exporter pour l’instant.' }));

    const choixAnnee = liste(annees.map(a => ({ id: a, label: a })), annees[0], { 'aria-label': 'Année à exporter' });

    return bloc('Export comptable',
        el('div', {}, [
            el('div', { class: 'actions-ligne' }, [
                choixAnnee,
                el('button', {
                    class: 'bouton bouton--principal', type: 'button',
                    on: {
                        click: () => {
                            const annee = choixAnnee.value;
                            telecharger(`recettes-${annee}.csv`, csvRecettes(annee), 'text/csv;charset=utf-8');
                            notifier(`Recettes ${annee} exportées.`);
                        },
                    },
                }, ['Recettes encaissées (CSV)']),
                el('button', {
                    class: 'bouton bouton--fantome', type: 'button',
                    on: {
                        click: () => {
                            const annee = choixAnnee.value;
                            telecharger(`notes-honoraires-${annee}.csv`, csvFactures(annee), 'text/csv;charset=utf-8');
                            notifier(`Notes d’honoraires ${annee} exportées.`);
                        },
                    },
                }, ['Notes d’honoraires (CSV)']),
                el('button', {
                    class: 'bouton bouton--fantome', type: 'button',
                    on: { click: () => ouvrirRecapAnnuel(choixAnnee.value) },
                }, ['Récapitulatif mensuel']),
            ]),
        ]),
        'Le fichier des recettes suit la comptabilité de caisse : une ligne par encaissement, à sa date de règlement.');
}

function csvRecettes(annee) {
    const lignes = D.seances()
        .filter(s => s.paye && s.datePaiement && s.datePaiement.startsWith(annee))
        .sort((a, b) => a.datePaiement.localeCompare(b.datePaiement))
        .map(s => {
            const f = s.factureId ? D.facture(s.factureId) : null;
            return [
                s.datePaiement, s.date, nomComplet(D.patient(s.patientId)),
                libelleType(s.type), centimesVersEuros(montantDu(s)),
                libelleMode(s.modePaiement), f ? f.numero : '',
            ];
        });
    const total = lignes.reduce((t, l) => t + eurosVersCentimes(l[4]), 0);
    lignes.push(['', '', '', 'TOTAL', centimesVersEuros(total), '', '']);
    return versCsv(['Date de règlement', 'Date de séance', 'Patient', 'Type', 'Montant (EUR)', 'Moyen', 'Note d’honoraires'], lignes);
}

function csvFactures(annee) {
    const lignes = D.factures()
        .filter(f => f.date.startsWith(annee))
        .sort((a, b) => a.numero.localeCompare(b.numero))
        .map(f => [
            f.numero, f.date, f.destinataire.nom,
            f.type === 'avoir' ? 'Avoir' : 'Note d’honoraires',
            String(f.lignes.length), centimesVersEuros(f.total),
            f.annuleePar ? 'Annulée' : '',
        ]);
    return versCsv(['Numéro', 'Date', 'Destinataire', 'Type', 'Nb séances', 'Montant (EUR)', 'Statut'], lignes);
}

function versCsv(entetes, lignes) {
    const echapper = v => {
        const t = String(v ?? '');
        return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const corps = [entetes, ...lignes].map(l => l.map(echapper).join(';')).join('\r\n');
    return '﻿' + corps;   // BOM : Excel ouvre l'UTF-8 correctement
}

function ouvrirRecapAnnuel(annee) {
    const parMois = Array.from({ length: 12 }, () => ({ encaisse: 0, seances: 0 }));
    for (const s of D.seances()) {
        if (s.paye && s.datePaiement && s.datePaiement.startsWith(annee)) {
            parMois[Number(s.datePaiement.slice(5, 7)) - 1].encaisse += montantDu(s);
        }
        if (s.date.startsWith(annee) && s.statut === 'honoree') {
            parMois[Number(s.date.slice(5, 7)) - 1].seances += 1;
        }
    }
    const total = parMois.reduce((t, m) => t + m.encaisse, 0);
    const totalSeances = parMois.reduce((t, m) => t + m.seances, 0);

    modale({
        titre: `Récapitulatif ${annee}`,
        corps: el('div', {}, [
            el('table', { class: 'tableau tableau--compact' }, [
                el('thead', {}, [el('tr', {}, ['Mois', 'Séances honorées', 'Encaissé']
                    .map((t, i) => el('th', { class: i === 2 ? 'colonne-montant' : '', texte: t })))]),
                el('tbody', {}, parMois.map((m, i) => el('tr', {}, [
                    el('td', { texte: MOIS_COURTS[i] }),
                    el('td', { texte: String(m.seances) }),
                    el('td', { class: 'colonne-montant', texte: euro(m.encaisse) }),
                ]))),
                el('tfoot', {}, [el('tr', {}, [
                    el('td', { texte: 'Total' }),
                    el('td', { texte: String(totalSeances) }),
                    el('td', { class: 'colonne-montant', texte: euro(total) }),
                ])]),
            ]),
            el('p', { class: 'texte-doux', texte: 'Montant à rapprocher de la recette déclarée. Ce document n’a pas valeur de pièce comptable.' }),
        ]),
        actions: [{ label: 'Fermer', style: 'principal', action: f => f(null) }],
    });
}

function telecharger(nom, contenu, type) {
    const lien = el('a', {
        href: URL.createObjectURL(new Blob([contenu], { type })),
        download: nom,
    });
    document.body.append(lien);
    lien.click();
    setTimeout(() => { URL.revokeObjectURL(lien.href); lien.remove(); }, 0);
}

// --- Verrou ---------------------------------------------------------------------

function blocVerrou(rafraichir) {
    const p = D.parametres();
    const actif = !!p.codePin;

    const contenu = el('div', {}, [
        el('p', { class: actif ? 'etat-ok' : 'texte-doux', texte: actif ? 'Un code est demandé à l’ouverture.' : 'Aucun code demandé à l’ouverture.' }),
        el('div', { class: 'actions-ligne' }, [
            el('button', {
                class: 'bouton bouton--fantome', type: 'button',
                on: { click: () => definirCode(rafraichir) },
            }, [actif ? 'Changer le code' : 'Activer un code']),
            actif ? el('button', {
                class: 'bouton bouton--fantome', type: 'button',
                on: {
                    click: async () => {
                        const ok = await confirmer({ titre: 'Retirer le code ?', message: 'L’outil s’ouvrira sans rien demander.', confirmation: 'Retirer' });
                        if (ok) { D.majParametres({ codePin: null }); notifier('Code retiré.'); rafraichir(); }
                    },
                },
            }, ['Retirer le code']) : null,
        ]),
    ]);

    return bloc('Verrou à l’ouverture', contenu,
        'Ce code décourage un regard de passage ; il ne chiffre pas les données. La vraie protection reste la session de votre ordinateur.');
}

function definirCode(rafraichir) {
    const champCode = saisie({ type: 'password', inputmode: 'numeric', autocomplete: 'new-password', placeholder: '4 chiffres ou plus' });
    modale({
        titre: 'Code d’ouverture',
        corps: el('div', { class: 'formulaire' }, [champ('Nouveau code', champCode)]),
        actions: [
            { label: 'Annuler', action: f => f(null) },
            {
                label: 'Enregistrer', style: 'principal', action: async (fermer) => {
                    const code = champCode.value.trim();
                    if (code.length < 4) { notifier('Au moins 4 caractères.', 'attention'); return; }
                    D.majParametres({ codePin: await db.empreinte(code) });
                    notifier('Code enregistré.');
                    fermer('ok'); rafraichir();
                },
            },
        ],
    });
}

// --- Effacement -----------------------------------------------------------------

function blocDanger(rafraichir) {
    return bloc('Effacer toutes les données',
        el('button', {
            class: 'bouton bouton--danger', type: 'button',
            on: {
                click: async () => {
                    const ok = await confirmer({
                        titre: 'Tout effacer ?',
                        message: 'Patients, séances et notes d’honoraires seront supprimés de ce navigateur. Téléchargez d’abord une sauvegarde.',
                        confirmation: 'Tout effacer', danger: true,
                    });
                    if (!ok) return;
                    await db.toutEffacer();
                    notifier('Données effacées.', 'attention');
                    rafraichir();
                },
            },
        }, ['Tout effacer']),
        'Action définitive. Une sauvegarde téléchargée reste le seul moyen de revenir en arrière.');
}
