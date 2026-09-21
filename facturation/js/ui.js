// ui.js — briques d'interface partagees : creation de noeuds, modale, notifications.

/** Cree un element. `attrs.class`, `attrs.html`, `attrs.on` (ecouteurs) sont traites a part. */
export function el(balise, attrs = {}, enfants = []) {
    const noeud = document.createElement(balise);
    for (const [cle, valeur] of Object.entries(attrs)) {
        if (valeur === null || valeur === undefined || valeur === false) continue;
        if (cle === 'class') noeud.className = valeur;
        else if (cle === 'html') noeud.innerHTML = valeur;
        else if (cle === 'texte') noeud.textContent = valeur;
        else if (cle === 'on') for (const [evt, fn] of Object.entries(valeur)) noeud.addEventListener(evt, fn);
        else if (cle === 'donnees') for (const [d, v] of Object.entries(valeur)) noeud.dataset[d] = v;
        else if (valeur === true) noeud.setAttribute(cle, '');
        else noeud.setAttribute(cle, valeur);
    }
    for (const enfant of [].concat(enfants)) {
        if (enfant === null || enfant === undefined || enfant === false) continue;
        noeud.append(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
    }
    return noeud;
}

export function vider(noeud) { while (noeud.firstChild) noeud.removeChild(noeud.firstChild); }

export function remplir(noeud, contenu) {
    vider(noeud);
    for (const c of [].concat(contenu)) if (c) noeud.append(c);
    return noeud;
}

/** Echappe le texte destine a innerHTML. */
export function ech(texte) {
    return String(texte ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// --- Notifications ----------------------------------------------------------

let zoneNotifs = null;
export function notifier(message, ton = 'bon') {
    if (!zoneNotifs) {
        zoneNotifs = el('div', { class: 'notifs', role: 'status', 'aria-live': 'polite' });
        document.body.append(zoneNotifs);
    }
    const noeud = el('div', { class: `notif notif--${ton}`, texte: message });
    zoneNotifs.append(noeud);
    setTimeout(() => {
        noeud.classList.add('notif--sortie');
        setTimeout(() => noeud.remove(), 300);
    }, 3200);
}

// --- Modale -----------------------------------------------------------------

let modaleOuverte = null;

/**
 * Ouvre une modale. `corps` est un noeud, `actions` une liste de boutons.
 * Retourne une promesse resolue avec la valeur passee a `fermer()`.
 */
export function modale({ titre, corps, actions = [], large = false }) {
    fermerModale();
    let resoudre;
    const promesse = new Promise(r => { resoudre = r; });

    const fermer = (valeur) => {
        if (!modaleOuverte) return;
        modaleOuverte.remove();
        modaleOuverte = null;
        document.body.classList.remove('modale-ouverte');
        resoudre(valeur);
    };

    const panneau = el('div', { class: `modale__panneau${large ? ' modale__panneau--large' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': titre }, [
        el('header', { class: 'modale__tete' }, [
            el('h2', { texte: titre }),
            el('button', { class: 'bouton-icone', type: 'button', 'aria-label': 'Fermer', on: { click: () => fermer(null) } }, ['×']),
        ]),
        el('div', { class: 'modale__corps' }, [corps]),
        actions.length ? el('footer', { class: 'modale__pied' }, actions.map(a =>
            el('button', {
                type: a.type || 'button',
                class: `bouton bouton--${a.style || 'discret'}`,
                form: a.form,
                on: a.action ? { click: () => a.action(fermer) } : undefined,
            }, [a.label]))) : null,
    ]);

    const fond = el('div', { class: 'modale', on: { click: e => { if (e.target === fond) fermer(null); } } }, [panneau]);
    modaleOuverte = fond;
    modaleOuverte.fermer = fermer;
    document.body.append(fond);
    document.body.classList.add('modale-ouverte');

    const premier = panneau.querySelector('input:not([type=hidden]), select, textarea, button');
    if (premier) premier.focus();

    return promesse;
}

export function fermerModale(valeur) {
    if (modaleOuverte) modaleOuverte.fermer(valeur);
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modaleOuverte) fermerModale(null);
});

/** Confirmation simple. Resout a true / false. */
export function confirmer({ titre, message, confirmation = 'Confirmer', danger = false }) {
    return modale({
        titre,
        corps: el('p', { class: 'texte-doux', texte: message }),
        actions: [
            { label: 'Annuler', action: f => f(false) },
            { label: confirmation, style: danger ? 'danger' : 'principal', action: f => f(true) },
        ],
    }).then(v => v === true);
}

// --- Formulaires ------------------------------------------------------------

/** Champ etiquette. `champ` est le noeud de saisie. */
export function champ(label, noeud, indice) {
    const id = noeud.id || `c-${Math.random().toString(36).slice(2, 8)}`;
    noeud.id = id;
    return el('label', { class: 'champ', for: id }, [
        el('span', { class: 'champ__label', texte: label }),
        noeud,
        indice ? el('span', { class: 'champ__indice', texte: indice }) : null,
    ]);
}

export function saisie(attrs = {}) { return el('input', { class: 'saisie', ...attrs }); }

export function liste(options, valeur, attrs = {}) {
    return el('select', { class: 'saisie', ...attrs },
        options.map(o => el('option', { value: o.id, selected: o.id === valeur }, [o.label])));
}

export function pastille(texte, ton = 'neutre') {
    return el('span', { class: `pastille pastille--${ton}`, texte });
}

/** Etat vide d'une liste. */
export function vide(message, action) {
    return el('div', { class: 'etat-vide' }, [el('p', { texte: message }), action]);
}

/** Lit un formulaire en objet { name: value }. */
export function valeurs(formulaire) {
    const out = {};
    for (const champ of formulaire.elements) {
        if (!champ.name) continue;
        out[champ.name] = champ.type === 'checkbox' ? champ.checked : champ.value;
    }
    return out;
}
