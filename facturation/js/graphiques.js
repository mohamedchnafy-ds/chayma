// graphiques.js — SVG a la main : pas de librairie, pas de CDN, donc pas de reseau.
//
// Palette : une seule teinte (le taupe du site) pour les series de magnitude,
// et le trio de statut reserve (bon / attention / critique) pour l'assiduite.
// Chaque valeur est etiquetee en clair : la couleur n'est jamais le seul
// vecteur d'information, et un tableau equivalent accompagne chaque figure.

import { el } from './ui.js';
import { euroCourt, euro, libelleMois } from './modele.js';

const SVG = 'http://www.w3.org/2000/svg';

function svgEl(balise, attrs = {}, enfants = []) {
    const noeud = document.createElementNS(SVG, balise);
    for (const [cle, valeur] of Object.entries(attrs)) {
        if (valeur === null || valeur === undefined || valeur === false) continue;
        noeud.setAttribute(cle, valeur);
    }
    for (const enfant of [].concat(enfants)) {
        if (enfant === null || enfant === undefined || enfant === false) continue;
        noeud.append(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
    }
    return noeud;
}

/**
 * Histogramme des recettes mensuelles.
 * `series` : [{ cle: 'AAAA-MM', valeur: centimes }] — une seule serie, donc pas de legende.
 */
export function histogrammeMensuel(series) {
    const L = 720, H = 240;
    const margeG = 56, margeD = 12, margeH = 24, margeB = 34;
    const largeurTracee = L - margeG - margeD;
    const hauteurTracee = H - margeH - margeB;

    const max = Math.max(1, ...series.map(p => p.valeur));
    const echelle = v => (v / max) * hauteurTracee;
    const pas = largeurTracee / series.length;
    const largeurBarre = Math.min(38, pas - 10);

    const graduations = [0, 0.5, 1].map(f => Math.round(max * f));
    const grille = graduations.map(v => {
        const y = margeH + hauteurTracee - echelle(v);
        return svgEl('g', {}, [
            svgEl('line', { x1: margeG, x2: L - margeD, y1: y, y2: y, class: 'grille' }),
            svgEl('text', { x: margeG - 8, y: y + 4, class: 'axe', 'text-anchor': 'end' }, [euroCourt(v)]),
        ]);
    });

    const indexMax = series.reduce((m, p, i) => (p.valeur > series[m].valeur ? i : m), 0);

    const barres = series.map((p, i) => {
        const h = echelle(p.valeur);
        const x = margeG + i * pas + (pas - largeurBarre) / 2;
        const y = margeH + hauteurTracee - h;
        const dernier = i === series.length - 1;
        // Extremite arrondie a 4px, ancree sur la ligne de base.
        const groupe = svgEl('g', { class: 'barre' + (p.valeur > 0 ? '' : ' barre--vide') }, [
            svgEl('rect', {
                x, y: p.valeur > 0 ? y : margeH + hauteurTracee - 2,
                width: largeurBarre, height: p.valeur > 0 ? Math.max(h, 2) : 2,
                rx: 4, class: 'barre__forme',
            }),
            // Seule la valeur la plus haute et le mois courant sont etiquetes.
            (i === indexMax || dernier) && p.valeur > 0
                ? svgEl('text', { x: x + largeurBarre / 2, y: y - 7, class: 'barre__valeur', 'text-anchor': 'middle' }, [euroCourt(p.valeur)])
                : null,
            svgEl('title', {}, [`${libelleMois(p.cle)} — ${euro(p.valeur)}`]),
        ]);
        return groupe;
    });

    const etiquettes = series.map((p, i) => svgEl('text', {
        x: margeG + i * pas + pas / 2, y: H - 12,
        class: 'axe' + (i === series.length - 1 ? ' axe--fort' : ''),
        'text-anchor': 'middle',
    }, [libelleMois(p.cle).split(' ')[0]]));

    const svg = svgEl('svg', {
        viewBox: `0 0 ${L} ${H}`, class: 'graphe', role: 'img',
        'aria-label': `Recettes encaissées sur ${series.length} mois. ` +
            series.map(p => `${libelleMois(p.cle)} : ${euro(p.valeur)}`).join('. '),
    }, [...grille, ...barres, ...etiquettes]);

    return figure(svg, tableau(
        ['Mois', 'Encaissé'],
        series.map(p => [libelleMois(p.cle), euro(p.valeur)]),
    ));
}

/**
 * Barres horizontales triees : repartition par type de consultation.
 * Magnitude par categorie -> une seule teinte, chaque barre etiquetee en clair.
 */
export function barresHorizontales(lignes) {
    const total = lignes.reduce((t, l) => t + l.valeur, 0);
    if (!total) return null;
    const max = Math.max(...lignes.map(l => l.valeur));

    const corps = lignes.map(l => el('div', { class: 'barre-h' }, [
        el('span', { class: 'barre-h__label', texte: l.label }),
        el('span', { class: 'barre-h__piste' }, [
            el('span', { class: 'barre-h__forme', style: `width:${Math.max((l.valeur / max) * 100, 2)}%` }),
        ]),
        el('span', { class: 'barre-h__valeur', texte: `${l.valeur}` }),
    ]));

    return el('div', { class: 'barres-h' }, corps);
}

/** Jauge d'assiduite : trois segments de statut, separes de 2px, tous etiquetes. */
export function jaugeAssiduite(stats) {
    if (!stats.total) return null;
    const segments = [
        { cle: 'honoree', label: 'Honorées', valeur: stats.honoree, ton: 'bon' },
        { cle: 'annulee', label: 'Annulées', valeur: stats.annulee, ton: 'attention' },
        { cle: 'absente', label: 'Absences', valeur: stats.absente, ton: 'critique' },
    ].filter(s => s.valeur > 0);

    return el('div', { class: 'jauge' }, [
        el('div', { class: 'jauge__piste' }, segments.map(s => el('span', {
            class: `jauge__segment jauge__segment--${s.ton}`,
            style: `flex:${s.valeur}`,
            title: `${s.label} : ${s.valeur}`,
        }))),
        el('ul', { class: 'jauge__legende' }, segments.map(s => el('li', {}, [
            el('span', { class: `puce puce--${s.ton}` }),
            el('span', { texte: `${s.label} · ${s.valeur}` }),
        ]))),
    ]);
}

/** Enveloppe figure + tableau equivalent repliable. */
function figure(svg, tableauNoeud) {
    return el('figure', { class: 'figure' }, [
        svg,
        el('details', { class: 'figure__tableau' }, [
            el('summary', { texte: 'Voir les chiffres' }),
            tableauNoeud,
        ]),
    ]);
}

function tableau(entetes, lignes) {
    return el('table', { class: 'tableau tableau--compact' }, [
        el('thead', {}, [el('tr', {}, entetes.map(t => el('th', { texte: t })))]),
        el('tbody', {}, lignes.map(l => el('tr', {}, l.map(c => el('td', { texte: c }))))),
    ]);
}
