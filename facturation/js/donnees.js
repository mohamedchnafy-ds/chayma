// donnees.js — les operations qui modifient le document.
// Tout passe par ici : c'est le seul endroit ou l'on ecrit.

import { etat, modifier } from './db.js';
import { nouvelId, aujourdhui, formateNumero, montantDu, nomComplet, libelleType } from './modele.js';

// --- Patients ----------------------------------------------------------------

export function patients() { return etat.doc.patients; }
export function patient(id) { return etat.doc.patients.find(p => p.id === id) || null; }

export function creerPatient(donnees) {
    const p = {
        id: nouvelId(),
        nom: (donnees.nom || '').trim(),
        prenom: (donnees.prenom || '').trim(),
        telephone: (donnees.telephone || '').trim(),
        email: (donnees.email || '').trim(),
        adresse: (donnees.adresse || '').trim(),
        codePostal: (donnees.codePostal || '').trim(),
        ville: (donnees.ville || '').trim(),
        tarif: donnees.tarif ?? etat.doc.parametres.tarifDefaut,
        type: donnees.type || etat.doc.parametres.typeDefaut,
        note: (donnees.note || '').trim(),
        archive: false,
        creeLe: new Date().toISOString(),
    };
    modifier(d => d.patients.push(p));
    return p;
}

export function majPatient(id, donnees) {
    return modifier(d => {
        const p = d.patients.find(x => x.id === id);
        if (p) Object.assign(p, donnees);
        return p;
    });
}

export function archiverPatient(id, archive = true) {
    return majPatient(id, { archive });
}

export function supprimerPatient(id) {
    return modifier(d => {
        d.patients = d.patients.filter(p => p.id !== id);
        d.seances = d.seances.filter(s => s.patientId !== id);
    });
}

/**
 * Retrouve un patient a partir du texte saisi, ou le cree a la volee.
 * C'est ce qui permet d'enregistrer une seance sans quitter le clavier.
 */
export function patientDepuisSaisie(texte) {
    const propre = (texte || '').trim().replace(/\s+/g, ' ');
    if (!propre) return null;
    const cible = propre.toLocaleLowerCase('fr');
    const existant = etat.doc.patients.find(p => nomComplet(p).toLocaleLowerCase('fr') === cible);
    if (existant) return existant;
    // « Marie Dupont » -> prenom « Marie », nom « Dupont ».
    const morceaux = propre.split(' ');
    const prenom = morceaux.shift();
    return creerPatient({ prenom, nom: morceaux.join(' ') });
}

// --- Seances -----------------------------------------------------------------

export function seances() { return etat.doc.seances; }
export function seance(id) { return etat.doc.seances.find(s => s.id === id) || null; }

export function seancesDe(patientId) {
    return etat.doc.seances.filter(s => s.patientId === patientId)
        .sort((a, b) => b.date.localeCompare(a.date));
}

export function creerSeance(donnees) {
    const s = {
        id: nouvelId(),
        patientId: donnees.patientId,
        date: donnees.date || aujourdhui(),
        heure: donnees.heure || '',
        duree: Number(donnees.duree) || 45,
        type: donnees.type || etat.doc.parametres.typeDefaut,
        montant: Number(donnees.montant) || 0,
        statut: donnees.statut || 'honoree',
        paye: !!donnees.paye,
        modePaiement: donnees.paye ? (donnees.modePaiement || etat.doc.parametres.modePaiementDefaut) : null,
        datePaiement: donnees.paye ? (donnees.datePaiement || donnees.date || aujourdhui()) : null,
        factureId: null,
        note: (donnees.note || '').trim(),
        creeLe: new Date().toISOString(),
    };
    modifier(d => d.seances.push(s));
    return s;
}

export function majSeance(id, donnees) {
    return modifier(d => {
        const s = d.seances.find(x => x.id === id);
        if (!s) return null;
        Object.assign(s, donnees);
        if (!s.paye) { s.modePaiement = null; s.datePaiement = null; }
        else if (!s.datePaiement) { s.datePaiement = aujourdhui(); }
        return s;
    });
}

export function basculerPaiement(id, mode) {
    const s = seance(id);
    if (!s) return null;
    return s.paye
        ? majSeance(id, { paye: false })
        : majSeance(id, { paye: true, modePaiement: mode || etat.doc.parametres.modePaiementDefaut, datePaiement: aujourdhui() });
}

export function supprimerSeance(id) {
    return modifier(d => { d.seances = d.seances.filter(s => s.id !== id); });
}

// --- Notes d'honoraires ------------------------------------------------------

export function factures() { return etat.doc.factures; }
export function facture(id) { return etat.doc.factures.find(f => f.id === id) || null; }

/**
 * Attribue le prochain numero de l'annee. Le compteur ne redescend jamais :
 * la numerotation doit rester chronologique, continue et sans trou.
 */
function prochainNumero(annee) {
    const prefixe = etat.doc.parametres.prefixeNumero;
    const suivant = (etat.doc.compteurs[annee] || 0) + 1;
    etat.doc.compteurs[annee] = suivant;
    return formateNumero(prefixe, annee, suivant);
}

/** Cree une note d'honoraires a partir d'un lot de seances d'un meme patient. */
export function creerFacture(patientId, idsSeances, dateEmission = aujourdhui()) {
    const p = patient(patientId);
    const lot = idsSeances.map(id => seance(id)).filter(Boolean);
    if (!p || !lot.length) throw new Error('Sélection vide.');
    if (lot.some(s => s.factureId)) throw new Error('Une séance est déjà facturée.');

    return modifier(d => {
        const f = {
            id: nouvelId(),
            numero: prochainNumero(dateEmission.slice(0, 4)),
            type: 'facture',
            date: dateEmission,
            patientId,
            // On fige l'identite du patient : une facture emise ne doit plus bouger,
            // meme si la fiche patient est corrigee plus tard.
            destinataire: {
                nom: nomComplet(p),
                adresse: p.adresse, codePostal: p.codePostal, ville: p.ville,
            },
            lignes: lot.map(s => ({
                seanceId: s.id,
                date: s.date,
                libelle: libelleLigne(s),
                montant: montantDu(s),
            })),
            total: lot.reduce((t, s) => t + montantDu(s), 0),
            mentionTva: d.parametres.mentionTva,
            annuleePar: null,
            creeLe: new Date().toISOString(),
        };
        d.factures.push(f);
        for (const s of lot) {
            const ref = d.seances.find(x => x.id === s.id);
            if (ref) ref.factureId = f.id;
        }
        return f;
    });
}

function libelleLigne(s) {
    const base = `Consultation de psychologie — ${libelleType(s.type)}`;
    return s.statut === 'absente' ? `${base} (absence non excusée)` : base;
}

/**
 * Annule une facture par un avoir. On ne supprime jamais une piece emise :
 * on emet une piece inverse, qui porte son propre numero.
 */
export function creerAvoir(factureId, dateEmission = aujourdhui()) {
    const f = facture(factureId);
    if (!f) throw new Error('Note d’honoraires introuvable.');
    if (f.type === 'avoir') throw new Error('Un avoir ne s’annule pas.');
    if (f.annuleePar) throw new Error('Cette note est déjà annulée.');

    return modifier(d => {
        const origine = d.factures.find(x => x.id === factureId);
        const avoir = {
            id: nouvelId(),
            numero: prochainNumero(dateEmission.slice(0, 4)),
            type: 'avoir',
            date: dateEmission,
            patientId: origine.patientId,
            destinataire: { ...origine.destinataire },
            lignes: origine.lignes.map(l => ({ ...l, montant: -l.montant })),
            total: -origine.total,
            mentionTva: origine.mentionTva,
            avoirDe: origine.id,
            numeroOrigine: origine.numero,
            creeLe: new Date().toISOString(),
        };
        d.factures.push(avoir);
        origine.annuleePar = avoir.id;
        // Les seances redeviennent facturables.
        for (const l of origine.lignes) {
            const s = d.seances.find(x => x.id === l.seanceId);
            if (s) s.factureId = null;
        }
        return avoir;
    });
}

export function facturesDe(patientId) {
    return etat.doc.factures.filter(f => f.patientId === patientId)
        .sort((a, b) => b.date.localeCompare(a.date) || b.numero.localeCompare(a.numero));
}

// --- Parametres ---------------------------------------------------------------

export function parametres() { return etat.doc.parametres; }

export function majParametres(donnees) {
    return modifier(d => {
        Object.assign(d.parametres, donnees);
        if (donnees.praticien) d.parametres.praticien = { ...d.parametres.praticien, ...donnees.praticien };
        return d.parametres;
    });
}
