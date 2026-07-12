# Stratégie de validation

Ce document décrit la stratégie de validation envisagée pour les futures phases de développement de Theme Factory Companion.

**Les commandes exactes (scripts npm, options de ligne de commande, etc.) seront définies après l'initialisation technique du projet et ne sont pas fixées à ce stade.**

## Typecheck

Vérification de la cohérence des types TypeScript sur l'ensemble du code, sans exception ni suppression d'erreur (voir la règle correspondante dans [CONTRIBUTING.md](../CONTRIBUTING.md)).

## Tests unitaires

Tests ciblant des fonctions et modules isolés, notamment la logique métier indépendante de SQLite et d'Electron.

## Tests d'intégration

Tests vérifiant le bon fonctionnement de plusieurs modules combinés, par exemple l'enchaînement d'un handler IPC avec un repository.

## Tests des repositories

Tests vérifiant le comportement des repositories d'accès à SQLite : lecture, écriture, mise à jour, suppression, et respect des contraintes du modèle de données.

## Tests des handlers IPC

Tests vérifiant que les canaux IPC autorisés (voir [docs/ARCHITECTURE.md](ARCHITECTURE.md)) se comportent correctement, y compris face à des entrées invalides.

## Tests de validation Zod

Tests vérifiant que les schémas Zod rejettent correctement les données invalides et acceptent les données valides, aux frontières de l'application.

## Build

Vérification que l'application se construit correctement, pour le renderer comme pour le processus principal.

## Validation manuelle

Vérification humaine du comportement de l'application, en complément des tests automatisés, notamment pour les aspects visuels et l'expérience utilisateur.

## Tests de persistance

Tests vérifiant que les données écrites en base sont correctement relues après redémarrage de l'application, garantissant la fiabilité de la persistance locale.

## Tests d'idempotence des migrations

Tests vérifiant que les migrations SQLite peuvent être rejouées plusieurs fois sans erreur ni duplication de données ou de structure.

## Statut

Cette stratégie est une intention de cadrage. Les outils, scripts et commandes précis seront définis et documentés lors de l'initialisation technique du projet, en phase 1 de la [roadmap](ROADMAP.md).
