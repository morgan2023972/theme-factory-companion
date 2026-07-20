# Orchestrateur local V1 — Roadmap

Statut : documentaire uniquement (ORCH-0.1).

Ce document retranscrit la roadmap complète de l'orchestrateur local V1, sous-phase par sous-phase, dans l'ordre logique de réalisation :

1. documentation ;
2. règles de sécurité ;
3. schémas partagés ;
4. machine à états ;
5. persistance ;
6. profils et gestion des fichiers ;
7. exécution des commandes ;
8. intégration Claude Code ;
9. validations et approbations ;
10. IPC et interface Electron ;
11. commit et push contrôlés ;
12. test intégré ;
13. durcissement.

## ORCH-0.1 — Spécification fonctionnelle

- Objectif : fixer le périmètre fonctionnel, les rôles, le workflow complet et les critères de fin de la V1 de l'orchestrateur.
- Principaux livrables : `ORCHESTRATOR_V1_SCOPE.md`, `ORCHESTRATOR_V1_WORKFLOW.md`, `ORCHESTRATOR_V1_ROADMAP.md`, rapport de phase.
- Validations principales : cohérence entre les trois documents, absence de toute modification applicative.
- Dépendance logique : aucune, phase initiale.

## ORCH-0.2 — Règles de sécurité

- Objectif : documenter précisément les règles de sécurité applicables à l'orchestrateur (limites de chemins, interdictions d'actions Git implicites, gestion des secrets, timeouts, exécutions concurrentes).
- Principaux livrables : document de règles de sécurité dédié.
- Validations principales : cohérence avec les contraintes techniques déjà énoncées dans ORCH-0.1.
- Dépendance logique : s'appuie sur le périmètre défini en ORCH-0.1.

## ORCH-1.1 — Schémas partagés

- Objectif : définir les schémas Zod et types partagés (`src/shared/orchestration`) représentant les entités propres au moteur d'orchestration : `WorkflowRun`, `WorkflowStep`, `WorkflowArtifact`, `WorkflowApproval`, `CommandExecution` et `WorkflowProfile`.
- Principaux livrables : schémas Zod des entités d'orchestration, types TypeScript dérivés et tests unitaires de validation.
- Validations principales : `npm run typecheck`, `npm run test`, `npm run build`.
- Dépendance logique : s'appuie sur les entités identifiées en ORCH-0.1 et sur les règles de sécurité d'ORCH-0.2.

## ORCH-1.2 — Machine à états

- Objectif : implémenter la machine à états représentant les transitions du workflow décrites dans `ORCHESTRATOR_V1_WORKFLOW.md`.
- Principaux livrables : module de machine à états, tests de transitions valides et invalides.
- Validations principales : `npm run typecheck`, `npm run test`, `npm run build`.
- Dépendance logique : s'appuie sur les schémas partagés d'ORCH-1.1 et sur les états fonctionnels indicatifs d'ORCH-0.1.

## ORCH-2.1 — Migration SQLite

- Objectif : créer la migration SQLite persistant les entités du workflow (workflows, étapes, commandes, approbations, artefacts).
- Principaux livrables : fichier de migration, tests de migration.
- Validations principales : `npm run test`, vérification de l'application propre de la migration.
- Dépendance logique : s'appuie sur les schémas partagés d'ORCH-1.1.

## ORCH-2.2 — Repositories

- Objectif : implémenter les repositories d'accès aux données du workflow dans le main process.
- Principaux livrables : repositories SQLite, tests d'intégration.
- Validations principales : `npm run typecheck`, `npm run test`, `npm run build`.
- Dépendance logique : s'appuie sur la migration d'ORCH-2.1.

## ORCH-3.1 — Profil de workflow Electron/TypeScript

- Objectif : définir le premier profil de workflow (commandes de validation, conventions de nommage, chemins d'artefacts) pour un projet Electron/TypeScript.
- Principaux livrables : configuration de profil, documentation associée.
- Validations principales : cohérence avec les commandes listées dans `ORCHESTRATOR_V1_WORKFLOW.md` (Étape 9).
- Dépendance logique : s'appuie sur les schémas partagés d'ORCH-1.1.

## ORCH-3.2 — Services de fichiers

- Objectif : implémenter les services de création et de lecture des fichiers d'artefacts (prompts, rapports) avec les garanties définies en ORCH-0.1 (encodage UTF-8, refus d'écrasement silencieux, chemins limités au dépôt).
- Principaux livrables : services de fichiers, tests unitaires.
- Validations principales : `npm run typecheck`, `npm run test`, `npm run build`.
- Dépendance logique : s'appuie sur le profil défini en ORCH-3.1 et sur les règles de sécurité d'ORCH-0.2.

## ORCH-4.1 — Command runner

- Objectif : implémenter l'exécuteur de commandes générique (capture stdout/stderr/code de sortie, timeout, annulation, interdiction d'exécutions concurrentes).
- Principaux livrables : module command runner, tests unitaires et d'intégration.
- Validations principales : `npm run typecheck`, `npm run test`, `npm run build`.
- Dépendance logique : s'appuie sur les règles de sécurité d'ORCH-0.2 et sur les repositories d'ORCH-2.2 pour l'historisation.

## ORCH-4.2 — Adaptateur Claude Code

- Objectif : implémenter l'adaptateur dédié au lancement de Claude Code via le command runner, dans le répertoire de travail du projet actif.
- Principaux livrables : adaptateur Claude Code, tests d'intégration.
- Validations principales : `npm run typecheck`, `npm run test`, `npm run build`.
- Dépendance logique : s'appuie sur le command runner d'ORCH-4.1.

## ORCH-5.1 — Validation runner

- Objectif : implémenter l'exécuteur des commandes de validation automatique définies par le profil actif (typecheck, tests, build, vérifications Git).
- Principaux livrables : module de validation runner, tests unitaires.
- Validations principales : `npm run typecheck`, `npm run test`, `npm run build`.
- Dépendance logique : s'appuie sur le command runner d'ORCH-4.1 et sur le profil d'ORCH-3.1.

## ORCH-5.2 — Approbations humaines

- Objectif : implémenter le mécanisme de gestion des approbations humaines obligatoires (prompt, correction, commit, push) et leur historisation.
- Principaux livrables : module d'approbations, tests unitaires.
- Validations principales : `npm run typecheck`, `npm run test`, `npm run build`.
- Dépendance logique : s'appuie sur la machine à états d'ORCH-1.2 et sur les repositories d'ORCH-2.2.

## ORCH-6.1 — IPC et preload

- Objectif : exposer les fonctionnalités de l'orchestrateur via des canaux IPC explicitement autorisés et une API preload validée par Zod.
- Principaux livrables : canaux IPC, API preload, tests d'intégration.
- Validations principales : `npm run typecheck`, `npm run test`, `npm run build`.
- Dépendance logique : s'appuie sur l'ensemble des modules main process précédents (ORCH-1.x à ORCH-5.x).

## ORCH-6.2 — Interface minimale

- Objectif : implémenter une interface Electron minimale permettant de piloter le workflow (sélection projet/phase, approbations, visualisation des rapports).
- Principaux livrables : composants React, tests d'intégration front.
- Validations principales : `npm run typecheck`, `npm run test`, `npm run build`.
- Dépendance logique : s'appuie sur l'IPC et le preload d'ORCH-6.1.

## ORCH-7.1 — Commit Git contrôlé

- Objectif : implémenter la préparation et l'exécution du commit contrôlé (inspection du dépôt, ajout explicite de fichiers, message approuvé, enregistrement du hash).
- Principaux livrables : module de commit contrôlé, tests d'intégration.
- Validations principales : `npm run typecheck`, `npm run test`, `npm run build`.
- Dépendance logique : s'appuie sur les approbations humaines d'ORCH-5.2 et sur l'interface d'ORCH-6.2.

## ORCH-7.2 — Push Git contrôlé

- Objectif : implémenter l'exécution du push contrôlé, avec approbation séparée et sans force push ni changement automatique de branche.
- Principaux livrables : module de push contrôlé, tests d'intégration.
- Validations principales : `npm run typecheck`, `npm run test`, `npm run build`.
- Dépendance logique : s'appuie sur le commit contrôlé d'ORCH-7.1.

## ORCH-8.1 — Test intégré

- Objectif : valider un cycle complet du workflow de bout en bout (sélection, prompt, exécution, rapport, validations, commit, push) dans un environnement de test.
- Principaux livrables : suite de tests d'intégration bout en bout.
- Validations principales : `npm run test`, `npm run build`.
- Dépendance logique : s'appuie sur l'ensemble des phases précédentes.

## ORCH-8.2 — Durcissement et documentation

- Objectif : consolider la robustesse du système (gestion des cas limites, reprise après redémarrage, messages d'erreur) et finaliser la documentation utilisateur et technique.
- Principaux livrables : corrections de durcissement, documentation finale mise à jour.
- Validations principales : `npm run typecheck`, `npm run test`, `npm run build`.
- Dépendance logique : s'appuie sur le test intégré d'ORCH-8.1.

## Extension future

Un profil Shopify complet n'est pas inclus dans la V1. Un tel profil pourra être ajouté ultérieurement comme extension du système de profils introduit en ORCH-3.1, sans modification de l'architecture centrale de l'orchestrateur.
