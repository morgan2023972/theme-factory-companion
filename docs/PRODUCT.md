# Produit — Theme Factory Companion

## Contexte

La création d'un thème Shopify premium de qualité implique de nombreuses étapes : analyse de l'existant, structuration technique, développement itératif, validation méthodique, et suivi rigoureux des décisions prises en cours de route. Ce travail est aujourd'hui dispersé entre plusieurs outils (notes, conversations avec des IA, fichiers divers), ce qui rend difficile le suivi méthodique d'un projet dans la durée.

## Mission

Theme Factory Companion a pour mission de fournir un espace de pilotage local et structuré pour mener méthodiquement un projet de création de thème Shopify, de la phase de cadrage jusqu'à la livraison, en gardant une trace fiable des tâches, décisions, questions et erreurs rencontrées.

## Utilisateur principal

L'utilisateur principal est un développeur solo (ou une très petite équipe) créant des thèmes Shopify premium, qui s'appuie fortement sur des agents IA (ChatGPT, Claude Code) pour concevoir et implémenter le thème, et qui a besoin d'un cadre méthodique pour éviter la dérive du périmètre et garder une vue d'ensemble du projet.

## Problèmes résolus

- Absence de suivi structuré des phases et tâches d'un projet de thème Shopify.
- Perte de contexte sur les décisions prises et leurs justifications.
- Difficulté à documenter les erreurs produites par les agents IA et à en tirer des enseignements.
- Absence de vue centralisée sur les questions ouvertes et les problèmes en cours.
- Difficulté à identifier les tâches répétitives qui pourraient être automatisées.

## Rôle de ChatGPT

ChatGPT intervient en amont, dans les phases de réflexion, de cadrage et de structuration : clarification des besoins, formulation des plans, rédaction des prompts destinés à Claude Code, et arbitrage des choix de conception.

## Rôle de Theme Factory Companion

Theme Factory Companion est l'outil de suivi qui matérialise et conserve le résultat du travail de cadrage et d'exécution : projets, phases, tâches, checklists, prompts utilisés, critères d'acceptation, décisions, questions, problèmes, erreurs IA et journal d'activité. Il ne génère pas de code et n'exécute pas d'agent IA lui-même.

## Rôle de Claude Code

Claude Code intervient comme agent d'implémentation, à partir de prompts précis issus du travail de cadrage. Il exécute les tâches de développement dans le respect strict du périmètre défini pour chaque étape, en suivant le [workflow de développement](DEVELOPMENT_WORKFLOW.md).

## Rôle de VS Code

VS Code est l'environnement de développement utilisé pour écrire, relire et versionner le code produit, ainsi que pour exécuter Claude Code en tant qu'extension ou outil en ligne de commande.

## Premier cas d'usage

Le premier cas d'usage visé est le pilotage méthodique de la création d'un thème Shopify OS 2.0, depuis l'analyse initiale jusqu'à la livraison, en structurant le travail en phases et tâches suivies dans l'application.

## Référence CHIMI

Dans le cadre de ce premier cas d'usage, le thème **CHIMI** peut être utilisé comme référence d'analyse (structure, fonctionnalités, organisation) pour nourrir la réflexion. Il ne s'agit en aucun cas d'un support à dupliquer : le thème final produit devra rester **original**, tant sur le plan visuel que technique.
