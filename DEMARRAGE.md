# FaidaKomori — Guide de démarrage

## Prérequis

- **Node.js 18+** : https://nodejs.org

## Démarrage en 1 clic

Double-cliquer sur **`DEMARRER.bat`**

Le script installe automatiquement les dépendances (1ère fois) puis lance le serveur.

---

## Démarrage manuel

```bash
cd backend
npm install      # première fois uniquement
node server.js
```

Le site sera accessible sur **http://localhost:3001**

---

## Comptes par défaut

| Rôle  | Email                    | Mot de passe    |
|-------|--------------------------|-----------------|
| Admin | admin@faidakomori.km     | Admin@FK2024!   |

> Changez le mot de passe admin après la première connexion.

---

## Pages du site

| Page              | URL                                  |
|-------------------|--------------------------------------|
| Accueil           | http://localhost:3001/               |
| Projets           | http://localhost:3001/projets.html   |
| Déposer un projet | http://localhost:3001/deposer.html   |
| Connexion         | http://localhost:3001/login.html     |
| Mon espace        | http://localhost:3001/mon-espace.html|
| Administration    | http://localhost:3001/admin.html     |

---

## Architecture

```
faidakomori/
├── index.html          ← Accueil
├── projets.html        ← Liste des projets
├── projet-detail.html  ← Détail projet
├── deposer.html        ← Formulaire candidature
├── login.html          ← Connexion / Inscription
├── mon-espace.html     ← Dashboard utilisateur
├── admin.html          ← Administration
├── css/style.css       ← Design complet
├── js/
│   ├── main.js         ← Interactions front (FAQ, filtres…)
│   └── api.js          ← Client API réutilisable
└── backend/
    ├── server.js       ← Serveur Express
    ├── database.js     ← SQLite (better-sqlite3)
    ├── routes/
    │   ├── auth.js     ← /api/auth/*
    │   ├── projects.js ← /api/projects/*
    │   ├── admin.js    ← /api/admin/* (protégé)
    │   └── user.js     ← /api/user/* (protégé)
    ├── middleware/
    │   └── auth.js     ← Vérification JWT
    └── db/
        └── faidakomori.sqlite  ← Base de données (auto-créée)
```

---

## Sécurité

- **Mots de passe** chiffrés avec bcrypt (coût 12)
- **JWT** avec expiration 7 jours
- **Rate limiting** : 200 req/15min global, 20 req/15min sur /auth
- **Helmet** : headers de sécurité HTTP
- **CORS** configuré pour localhost

> En production : changer `JWT_SECRET` via variable d'environnement et activer HTTPS.
