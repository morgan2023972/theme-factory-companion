# Architecture envisagée

**Important : ce document décrit une architecture envisagée pour les phases de développement futures. Rien de ce qui est décrit ici n'est implémenté à ce stade — voir [README.md](../README.md) pour le statut actuel du dépôt.**

## Stack technique envisagée

- **Electron** — socle desktop multiplateforme.
- **React** — interface utilisateur du processus renderer.
- **TypeScript** — typage statique sur l'ensemble du code.
- **Vite** — outillage de build pour le renderer.
- **SQLite** — moteur de persistance locale.
- **better-sqlite3** — accès synchrone à SQLite depuis le processus main.
- **Zod** — validation des données aux frontières (IPC, entrées utilisateur).
- **Vitest** — exécution des tests.

## Séparation des responsabilités

L'architecture envisagée repose sur une séparation stricte en quatre zones :

- **`main`** — processus principal Electron. Contient la logique métier, l'accès à SQLite et l'enregistrement des handlers IPC.
- **`preload`** — script de pont exposant une API limitée et contrôlée au renderer, sans exposer directement Node.js ou Electron.
- **`renderer`** — interface React. Ne communique avec le reste de l'application qu'à travers l'API exposée par le preload.
- **`shared`** — types, schémas et constantes partagés entre les zones ci-dessus, sans logique d'accès à Node, Electron ou SQLite.

## Règles d'architecture envisagées

- SQLite n'est utilisé **que** dans le processus principal (`main`).
- Aucune utilisation directe de Node.js, d'Electron ou de SQLite n'est autorisée dans le renderer.
- Le preload expose une **API limitée**, correspondant strictement aux besoins du renderer.
- Les canaux IPC utilisés sont **explicitement listés et autorisés** ; aucun canal implicite ou générique n'est envisagé.
- Toute donnée entrant dans un handler IPC est **validée avec Zod** avant traitement.
- L'accès aux données passe par des **repositories** utilisant des requêtes préparées (prepared statements).
- Les **migrations** de la base SQLite doivent être **idempotentes**, c'est-à-dire rejouables sans erreur ni duplication.

## Schéma des échanges

```text
Renderer React
    ↓ API contrôlée
Preload
    ↓ IPC autorisé
Main Electron
    ↓ Repositories
SQLite
```

Ce schéma illustre le sens de circulation de l'information : le renderer ne dialogue jamais directement avec SQLite ni avec le système, mais uniquement à travers l'API contrôlée exposée par le preload, elle-même relayée par des canaux IPC explicitement autorisés vers le processus principal.

## Statut

Cette architecture est une **proposition de cadrage**, destinée à guider les décisions techniques des phases ultérieures de la [roadmap](ROADMAP.md). Elle pourra être ajustée et précisée au fil des décisions consignées dans [docs/decisions/](decisions/).
