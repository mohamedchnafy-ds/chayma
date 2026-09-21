// modele.js — logique metier pure : types, formats, calculs.
// Aucune dependance, aucun acces au stockage : tout est testable a la main.

// --- Types de consultation -------------------------------------------------
export const TYPES_SEANCE = [
    { id: 'individuel', label: 'Individuel',  duree: 45 },
    { id: 'enfant',     label: 'Enfant',      duree: 45 },
    { id: 'ado',        label: 'Adolescent',  duree: 45 },
    { id: 'couple',     label: 'Couple',      duree: 60 },
    { id: 'famille',    label: 'Famille',     duree: 60 },
    { id: 'visio',      label: 'Visio',       duree: 45 },
];

export const STATUTS_SEANCE = [
    { id: 'honoree', label: 'Honorée',          ton: 'bon' },
    { id: 'annulee', label: 'Annulée à temps',  ton: 'attention' },
    { id: 'absente', label: 'Absence non excusée', ton: 'critique' },
];

export const MODES_PAIEMENT = [
    { id: 'cb',       label: 'Carte bancaire' },
    { id: 'especes',  label: 'Espèces' },
    { id: 'cheque',   label: 'Chèque' },
    { id: 'virement', label: 'Virement' },
];

export const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
    'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function libelleType(id) {
    return (TYPES_SEANCE.find(t => t.id === id) || {}).label || id;
}
export function libelleStatut(id) {
    return (STATUTS_SEANCE.find(s => s.id === id) || {}).label || id;
}
export function tonStatut(id) {
    return (STATUTS_SEANCE.find(s => s.id === id) || {}).ton || 'neutre';
}
export function libelleMode(id) {
    return (MODES_PAIEMENT.find(m => m.id === id) || {}).label || '—';
}

// --- Montants --------------------------------------------------------------
// Tout est stocke en CENTIMES (entiers) : jamais de flottant sur de l'argent.

export function eurosVersCentimes(saisie) {
    if (saisie === null || saisie === undefined || saisie === '') return 0;
    const n = Number(String(saisie).replace(',', '.').replace(/\s/g, ''));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function centimesVersEuros(c) {
    return (Number(c || 0) / 100).toFixed(2).replace('.', ',');
}

const FMT_EURO = new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
});
const FMT_EURO_COURT = new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
});

export function euro(centimes) { return FMT_EURO.format(Number(centimes || 0) / 100); }
export function euroCourt(centimes) { return FMT_EURO_COURT.format(Number(centimes || 0) / 100); }

// --- Dates -----------------------------------------------------------------
// Les dates sont des chaines 'AAAA-MM-JJ' : pas de fuseau horaire, pas de surprise.

export function aujourdhui() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function moisCourant() { return aujourdhui().slice(0, 7); }
export function anneeCourante() { return aujourdhui().slice(0, 4); }

export function dateFr(iso) {
    if (!iso) return '—';
    const [a, m, j] = iso.split('-');
    return `${j}/${m}/${a}`;
}

export function dateLongue(iso) {
    if (!iso) return '—';
    const [a, m, j] = iso.split('-').map(Number);
    return new Date(a, m - 1, j).toLocaleDateString('fr-FR',
        { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function libelleMois(cle) {
    const [a, m] = cle.split('-').map(Number);
    return `${MOIS_COURTS[m - 1]} ${a}`;
}

/** Les N derniers mois (cles 'AAAA-MM'), du plus ancien au plus recent, fin incluse. */
export function derniersMois(n, finCle = moisCourant()) {
    const [a, m] = finCle.split('-').map(Number);
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(a, m - 1 - i, 1);
        out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return out;
}

/** Nombre de jours entre deux dates ISO (b - a). */
export function joursEntre(a, b) {
    const ms = new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00');
    return Math.round(ms / 86400000);
}

// --- Regles metier ---------------------------------------------------------

/** Une seance est-elle due ? (honoree, ou absence non excusee facturee) */
export function estDue(seance) {
    return seance.statut === 'honoree' || (seance.statut === 'absente' && seance.montant > 0);
}

/** Montant reellement du pour une seance (0 si annulee a temps). */
export function montantDu(seance) {
    return estDue(seance) ? Number(seance.montant || 0) : 0;
}

/** Une seance due et non payee. */
export function estImpayee(seance) {
    return estDue(seance) && !seance.paye;
}

/** Numero de facture : prefixe + annee + compteur, chronologique et sans trou. */
export function formateNumero(prefixe, annee, sequence) {
    const seq = String(sequence).padStart(4, '0');
    return prefixe ? `${prefixe}-${annee}-${seq}` : `${annee}-${seq}`;
}

/** Recette encaissee sur une periode : c'est la date de PAIEMENT qui compte (BNC, comptabilite de caisse). */
export function encaisseSur(seances, debutIso, finIso) {
    return seances.reduce((total, s) => {
        if (!s.paye || !s.datePaiement) return total;
        if (s.datePaiement < debutIso || s.datePaiement > finIso) return total;
        return total + montantDu(s);
    }, 0);
}

/** Recette encaissee par mois : { 'AAAA-MM': centimes }. */
export function encaisseParMois(seances) {
    const out = {};
    for (const s of seances) {
        if (!s.paye || !s.datePaiement) continue;
        const cle = s.datePaiement.slice(0, 7);
        out[cle] = (out[cle] || 0) + montantDu(s);
    }
    return out;
}

/** Repartition du nombre de seances honorees par type de consultation. */
export function repartitionParType(seances) {
    const out = {};
    for (const s of seances) {
        if (s.statut !== 'honoree') continue;
        out[s.type] = (out[s.type] || 0) + 1;
    }
    return out;
}

/** Taux d'assiduite : honorees / total, sur un lot de seances. */
export function assiduite(seances) {
    const total = seances.length;
    if (!total) return { total: 0, honoree: 0, annulee: 0, absente: 0, taux: null };
    const c = { honoree: 0, annulee: 0, absente: 0 };
    for (const s of seances) if (c[s.statut] !== undefined) c[s.statut]++;
    return { total, ...c, taux: c.honoree / total };
}

/** Solde impaye d'un patient. */
export function soldePatient(seances, patientId) {
    return seances
        .filter(s => s.patientId === patientId && estImpayee(s))
        .reduce((t, s) => t + montantDu(s), 0);
}

export function nomComplet(patient) {
    if (!patient) return 'Patient supprimé';
    return `${patient.prenom || ''} ${patient.nom || ''}`.trim() || 'Sans nom';
}

/** Identifiant unique local, trie chronologiquement. */
export function nouvelId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
