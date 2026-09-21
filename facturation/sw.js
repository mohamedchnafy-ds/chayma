// sw.js — met l'outil en cache pour qu'il s'ouvre sans connexion.
// Aucune donnee du cabinet ne passe ici : seuls les fichiers du programme
// sont mis en cache. Les donnees vivent dans IndexedDB, hors de portee du cache.

const CACHE = 'facturation-v1';
const FICHIERS = [
    './',
    './index.html',
    './manifest.webmanifest',
    './css/app.css',
    './js/app.js',
    './js/db.js',
    './js/donnees.js',
    './js/modele.js',
    './js/ui.js',
    './js/graphiques.js',
    './js/vue-jour.js',
    './js/vue-dashboard.js',
    './js/vue-seances.js',
    './js/vue-patients.js',
    './js/vue-factures.js',
    './js/vue-parametres.js',
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(cles => Promise.all(cles.filter(c => c !== CACHE).map(c => caches.delete(c))))
            .then(() => self.clients.claim())
    );
});

// Reseau d'abord pour recuperer les mises a jour, cache en secours hors ligne.
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    e.respondWith(
        fetch(e.request)
            .then(reponse => {
                const copie = reponse.clone();
                caches.open(CACHE).then(c => c.put(e.request, copie)).catch(() => {});
                return reponse;
            })
            .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
});
