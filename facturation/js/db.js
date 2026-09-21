// db.js — stockage 100 % local.
//
// Choix d'architecture : le cabinet genere au plus quelques milliers de seances
// sur dix ans (~2 Mo de JSON). On garde donc tout en memoire et on persiste le
// document entier a chaque modification. Cela rend les requetes triviales
// (du filtrage JS ordinaire), l'export/import gratuit, et supprime toute une
// classe de bugs de migration de schema.
//
// Deux supports, l'un obligatoire, l'autre optionnel :
//   1. IndexedDB  — la source de verite, dans le navigateur de Chayma.
//   2. Un fichier — copie miroir ecrite dans un dossier qu'elle choisit
//      (File System Access API), pour que la sauvegarde ne depende pas du cache
//      du navigateur. C'est la vraie securite contre la perte de donnees.
//
// Rien ne part sur un serveur. Il n'y a pas de serveur.

const BASE = 'chayma-facturation';
const CLE = 'document';
const VERSION_SCHEMA = 1;

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

// --- IndexedDB (promesses) -------------------------------------------------

function ouvrir() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(BASE, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('doc')) db.createObjectStore('doc');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function transaction(mode, action) {
    return ouvrir().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction('doc', mode);
        const store = tx.objectStore('doc');
        const req = action(store);
        tx.oncomplete = () => { db.close(); resolve(req && req.result); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    }));
}

// --- Etat --------------------------------------------------------------------

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
    try {
        const stocke = await transaction('readonly', s => s.get(CLE));
        if (stocke) etat.doc = normaliser(stocke);
    } catch (err) {
        console.error('Lecture IndexedDB impossible', err);
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
 * d'une note d'honoraires, par exemple). L'ecriture sur disque part en arriere-plan.
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
        .then(() => transaction('readwrite', s => s.put(instantane, CLE)))
        .then(() => ecrireMiroir(instantane))
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

// --- Copie miroir dans un fichier choisi par l'utilisatrice -----------------

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

// --- Export / import manuels -------------------------------------------------

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

// --- Verrou par code (courtoisie, pas chiffrement) ---------------------------

export async function empreinte(code) {
    const octets = new TextEncoder().encode('chayma:' + code);
    const digest = await crypto.subtle.digest('SHA-256', octets);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
