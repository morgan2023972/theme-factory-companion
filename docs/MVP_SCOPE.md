# Périmètre du MVP

Ce document liste les fonctions incluses et explicitement exclues du MVP de Theme Factory Companion. Ce périmètre est une hypothèse de travail et pourra évoluer au fil du cadrage.

## Fonctions incluses

- **Tableau de bord** — vue d'ensemble de l'état des projets en cours.
- **Projets** — création et suivi de projets de thèmes Shopify.
- **Phases** — découpage d'un projet en phases successives.
- **Tâches** — unités de travail rattachées à une phase.
- **Checklists** — listes de vérification associées aux tâches.
- **Prompts Claude Code** — enregistrement des prompts utilisés pour chaque tâche.
- **Critères d'acceptation** — conditions de validation d'une tâche.
- **Commandes de validation** — commandes associées à la vérification d'une tâche (typecheck, tests, build, etc.).
- **Questions** — questions ouvertes liées à un projet, une phase ou une tâche.
- **Problèmes et solutions** — suivi des problèmes rencontrés et de leur résolution.
- **Décisions** — registre des décisions structurantes prises pendant le projet.
- **Erreurs IA** — registre des erreurs significatives produites par des agents IA.
- **Automatisations potentielles** — registre des opérations répétitives identifiées comme automatisables.
- **Journal d'activité** — historique chronologique des événements du projet.
- **Export JSON et Markdown** — export des données du projet dans ces deux formats.

## Fonctions explicitement exclues

- Authentification
- Fonctionnement cloud
- Collaboration multi-utilisateurs
- Intégration à des API IA (appels directs à des modèles de langage)
- Exécution de Claude Code depuis l'application
- Terminal intégré
- Fonctions Git avancées
- Génération automatique de thèmes
- Intégration à Shopify Admin
- Fonctions de type SaaS (facturation, multi-tenant, etc.)

Ces exclusions pourront être réévaluées dans des versions ultérieures, mais ne font pas partie du MVP tel que cadré actuellement.
