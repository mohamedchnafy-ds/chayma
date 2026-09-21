// db.js — stockage 100 % local, sous deux formes.
//
// Choix d'architecture : le cabinet genere au plus quelques milliers de seances
// sur dix ans (~2 Mo de JSON). On garde donc tout en memoire et on reecrit le
// document entier a chaque modification. Les requetes deviennent du filtrage
// JavaScript ordinaire, l'export et l'import sont gratuits, et toute une classe
// de bugs de migration de schema disparait.
//
// Deux modes, choisis tout seuls au demarrage :
//
//   « fichier »    — le petit serveur local tourne (Facturation.command) : les
//                    donnees vivent dans data/cabinet.json, un fichier
//                    ordinaire que l'on voit, copie et sauvegarde comme
//                    n'importe quel document. Rien a configurer.
//
//   « navigateur » — pas de serveur (page ouverte depuis un hebergement) :
//                    IndexedDB, avec copie miroir optionnelle dans un fichier
//                    choisi par l'utilisatrice.
//
// Dans les deux cas rien ne part sur Internet : le serveur local n'ecoute que
// sur cet ordinateur.

const BASE = 'chayma-facturation';
const CLE = 'document';
const VERSION_SCHEMA = 1;
const ENTETES_API = { 'X-Facturation': '1' };

export const PARAMETRES_DEFAUT = {
    praticien: {
        nom: 'Chayma Dahmani',
        titre: 'Psychologue clinicienne',
        adresse: '',
        codePostal: '',
        ville: 'Bagnols-sur-Cèze',
        telephone: '',
        email: '',
        siret: '',
        adeli: '',
        iban: '',
    },
    // Exoneration de TVA des psychologues : article 261-4-1 du CGI.
    mentionTva: 'TVA non applicable, article 261-4-1° du Code général des impôts',
    mentionPied: 'Document à conserver. Honoraires non remboursés par l’Assurance Maladie.',
    prefixeNumero: '',
    tarifDefaut: 6000,          // centimes
    typeDefaut: 'individuel',
    modePaiementDefaut: 'cb',
    delaiPaiementJours: 30,
    codePin: null,              // empreinte SHA-256, null = pas de verrou
};

function documentVide() {
    return {
        schema: VERSION_SCHEMA,
        parametres: structuredClone(PARAMETRES_DEFAUT),
        patients: [],
        seances: [],
        factures: [],
        compteurs: {},          // { '2026': 12 } — ne redescend jamais
        modifieLe: null,
    };
}

// --- IndexedDB (promesses) ----------------------------------------------------

function ouvrirBase() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(BASE, 1);
        req.onupgradeneeded = () => {
            const base = req.result;
            if (!base.objectStoreNames.contains('doc')) base.createObjectStore('doc');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function transaction(mode, action) {
    return ouvrirBase().then(base => new Promise((resolve, reject) => {
        const tx = base.transaction('doc', mode);
        const req = action(tx.objectStore('doc'));
        tx.oncomplete = () => { base.close(); resolve(req && req.result); };
        tx.onerror = () => { base.close(); reject(tx.error); };
    }));
}

// --- Adaptateur « fichier » : le serveur local ----------------------------------

const adaptateurFichier = {
    nom: 'fichier',
    emplacement: null,
    dossier: null,
    _premiere: undefined,

    /** Sonde le serveur. Renvoie false s'il n'y en a pas ; leve si les donnees sont abimees. */
    async detecter() {
        // Le serveur local n'ecoute jamais ailleurs que sur cette machine :
        // inutile d'aller frapper a la porte depuis une page hebergee.
        if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return false;

        let reponse;
        try {
            reponse = await fetch('api/document', { headers: ENTETES_API, cache: 'no-store' });
        } catch {
            return false;           // pas de serveur : on passera par le navigateur
        }
        if (reponse.status === 404 || reponse.status === 403) return false;
        if (!reponse.ok) {
            // Le serveur est bien la, mais il n'arrive pas a lire le fichier.
            // Basculer en silence sur IndexedDB ferait diverger deux jeux de
            // donnees : mieux vaut s'arreter et le dire.
            const charge = await reponse.json().catch(() => ({}));
            throw new Error(charge.erreur || 'Le fichier de données est inaccessible.');
        }
        const charge = await reponse.json();
        this.emplacement = charge.chemin;
        this.dossier = charge.dossier;
        this._premiere = charge.document;
        return true;
    },

    async lire() {
        if (this._premiere !== undefined) {
            const doc = this._premiere;
            this._premiere = undefined;     // la sonde a deja rapporte le document
            return doc;
        }
        const reponse = await fetch('api/document', { headers: ENTETES_API, cache: 'no-store' });
        if (!reponse.ok) throw new Error('Lecture impossible.');
        return (await reponse.json()).document;
    },

    async ecrire(doc) {
        const reponse = await fetch('api/document', {
            method: 'PUT',
            headers: { ...ENTETES_API, 'Content-Type': 'application/json' },
            body: JSON.stringify(doc),
        });
        if (!reponse.ok) {
            const charge = await reponse.json().catch(() => ({}));
            throw new Error(charge.erreur || 'Enregistrement refusé.');
        }
    },
};

// --- Adaptateur « navigateur » : IndexedDB + copie miroir -------------------------

const adaptateurNavigateur = {
    nom: 'navigateur',
    emplacement: 'Base interne du navigateur',
    async detecter() { return true; },
    async lire() { return transaction('readonly', s => s.get(CLE)); },
    async ecrire(doc) {
        await transaction('readwrite', s => s.put(doc, CLE));
        await ecrireMiroir(doc);
    },
};

let adaptateur = adaptateurNavigateur;

export function modeStockage() { return adaptateur.nom; }
export function emplacementDonnees() { return adaptateur.emplacement; }
export function dossierDonnees() { return adaptateur.dossier || null; }

// --- Etat ------------------------------------------------------------------------

export const etat = { doc: documentVide(), pret: false };

/** Complete un document charge avec les valeurs par defaut ajoutees depuis. */
function normaliser(doc) {
    const base = documentVide();
    const out = { ...base, ...doc };
    out.parametres = {
        ...base.parametres,
        ...(doc.parametres || {}),
        praticien: { ...base.parametres.praticien, ...((doc.parametres || {}).praticien || {}) },
    };
    out.patients = doc.patients || [];
    out.seances = doc.seances || [];
    out.factures = doc.factures || [];
    out.compteurs = doc.compteurs || {};
    return out;
}

export async function charger() {
    if (await adaptateurFichier.detecter()) adaptateur = adaptateurFichier;

    try {
        const stocke = await adaptateur.lire();
        if (stocke) etat.doc = normaliser(stocke);
    } catch (err) {
        console.error('Lecture impossible', err);
        throw err;
    }
    etat.pret = true;
    return etat.doc;
}

let sauvegardeEnCours = Promise.resolve();

/**
 * Applique une modification au document.
 *
 * Volontairement synchrone : l'etat en memoire est la source de verite pour
 * l'affichage, et les vues ont besoin de l'objet cree tout de suite (le numero
 * d'une note d'honoraires, par exemple). L'ecriture part en arriere-plan.
 */
export function modifier(muter) {
    const resultat = muter(etat.doc);
    etat.doc.modifieLe = new Date().toISOString();
    persister();
    return resultat;
}

function persister() {
    const instantane = structuredClone(etat.doc);
    sauvegardeEnCours = sauvegardeEnCours
        .catch(() => {})
        .then(() => adaptateur.ecrire(instantane))
        .catch(err => {
            console.error('Sauvegarde impossible', err);
            signalerEchec(err);
        });
    return sauvegardeEnCours;
}

// Une sauvegarde qui echoue en silence serait le pire defaut de cet outil :
// on previent l'application, qui previent l'utilisatrice.
let surEchec = null;
export function surEchecSauvegarde(fn) { surEchec = fn; }
function signalerEchec(err) { if (surEchec) surEchec(err); }

// --- Copie miroir (mode navigateur seulement) ---------------------------------------

let poigneeFichier = null;

export function miroirActif() { return poigneeFichier !== null; }
export function nomMiroir() { return poigneeFichier ? poigneeFichier.name : null; }
export function miroirDisponible() { return typeof window.showSaveFilePicker === 'function'; }

/** Demande a l'utilisatrice ou ecrire la copie de sauvegarde. */
export async function choisirMiroir() {
    if (!miroirDisponible()) throw new Error('Navigateur sans accès aux fichiers');
    poigneeFichier = await window.showSaveFilePicker({
        suggestedName: 'cabinet-facturation.json',
        types: [{ description: 'Sauvegarde du cabinet', accept: { 'application/json': ['.json'] } }],
    });
    await conserverPoignee(poigneeFichier);
    await ecrireMiroir(etat.doc);
    return poigneeFichier.name;
}

async function ecrireMiroir(doc) {
    if (!poigneeFichier) return;
    try {
        const perm = await poigneeFichier.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') return;   // l'autorisation sera redemandee au prochain lancement
        const flux = await poigneeFichier.createWritable();
        await flux.write(JSON.stringify(doc, null, 2));
        await flux.close();
    } catch (err) {
        console.warn('Copie miroir non écrite', err);
    }
}

// La poignee de fichier survit a la fermeture de l'onglet si on la range dans IndexedDB.
async function conserverPoignee(poignee) {
    try { await transaction('readwrite', s => s.put(poignee, 'miroir')); } catch { /* ignore */ }
}

export async function reprendreMiroir() {
    if (adaptateur.nom === 'fichier') return null;      // sans objet : le serveur ecrit deja un fichier
    try {
        const poignee = await transaction('readonly', s => s.get('miroir'));
        if (!poignee) return null;
        const perm = await poignee.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') { poigneeFichier = poignee; return poignee.name; }
        return { nom: poignee.name, aReautoriser: true, poignee };
    } catch { return null; }
}

/** Redemande l'autorisation d'ecrire dans le fichier miroir (geste utilisateur requis). */
export async function reautoriserMiroir(poignee) {
    const perm = await poignee.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') return false;
    poigneeFichier = poignee;
    await ecrireMiroir(etat.doc);
    return true;
}

// --- Export / import manuels -----------------------------------------------------------

export function exporterJson() {
    return JSON.stringify(etat.doc, null, 2);
}

/** Remplace integralement le document. Utilise par la restauration de sauvegarde. */
export async function importerJson(texte) {
    const doc = JSON.parse(texte);
    if (!doc || typeof doc !== 'object' || !Array.isArray(doc.seances)) {
        throw new Error('Ce fichier n’est pas une sauvegarde du cabinet.');
    }
    etat.doc = normaliser(doc);
    await persister();
    return etat.doc;
}

export async function toutEffacer() {
    etat.doc = documentVide();
    await persister();
}

// --- Verrou par code (courtoisie, pas chiffrement) ----------------------------------------

export async function empreinte(code) {
    const octets = new TextEncoder().encode('chayma:' + code);
    const digest = await crypto.subtle.digest('SHA-256', octets);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
