# Registre des erreurs IA

Ce registre conserve la trace des erreurs significatives produites par des agents IA (Claude Code, ChatGPT) au cours du projet, afin d'en tirer des enseignements et d'éviter leur répétition.

## Quelles erreurs conserver

Doivent être consignées les erreurs qui :

- ont produit un résultat incorrect, incomplet ou hors périmètre par rapport à la demande ;
- ont nécessité une correction manuelle non triviale ;
- révèlent un risque de récurrence (mauvaise compréhension d'une convention, d'une contrainte d'architecture, etc.) ;
- pourraient aider à mieux formuler de futurs prompts.

Les erreurs mineures, corrigées immédiatement et sans conséquence, ne nécessitent pas d'entrée dédiée.

## Fonctionnement

- Chaque erreur fait l'objet d'un fichier Markdown distinct dans ce dossier, nommé selon le format `AAAA-MM-JJ-titre-court.md`.
- Chaque fichier suit le [modèle d'erreur IA](AI_ERROR_TEMPLATE.md).

## Règle impérative

**Ne jamais inclure de secret, clé API ou donnée sensible dans ce registre.** Toute erreur impliquant potentiellement une donnée sensible doit être décrite de façon anonymisée ou générique, sans reproduire la donnée elle-même.
