# Rapport — ORCH-0.1 — Spécification fonctionnelle de l'orchestrateur local V1

## 1. Résumé de la phase

Cette phase a produit la spécification fonctionnelle complète de la V1 de l'orchestrateur local de Theme Factory Companion : périmètre fonctionnel, rôles et responsabilités, workflow complet en 15 étapes, cas d'échec et de reprise, et roadmap détaillée des sous-phases ORCH-0.1 à ORCH-8.2. Aucune implémentation applicative n'a été réalisée : la phase est strictement documentaire.

## 2. Fichiers créés

- `docs/orchestration/ORCHESTRATOR_V1_SCOPE.md` — spécifie la finalité, le problème traité, les objectifs, le périmètre inclus/exclu, les contraintes techniques, les rôles et responsabilités, les artefacts produits et la Definition of Done de la V1.
- `docs/orchestration/ORCHESTRATOR_V1_WORKFLOW.md` — décrit le cycle complet d'exécution en 15 étapes, avec pour chacune le responsable, les entrées, l'action, les sorties et les conditions de réussite/échec, ainsi que les cas d'échec, les états fonctionnels indicatifs et les règles de reprise.
- `docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md` — retranscrit la roadmap complète des 18 sous-phases (ORCH-0.1 à ORCH-8.2) avec objectif, livrables, validations et dépendances pour chacune.
- `workflow/reports/RAPPORT_ORCH_0.1.md` — le présent rapport de phase.

## 3. Fichiers modifiés

Aucun fichier existant n'a été modifié. Le dossier `docs/orchestration` existait déjà mais était vide ; aucun des quatre fichiers cibles n'existait préalablement.

## 4. Décisions documentaires prises

- L'orchestrateur est positionné comme module interne de Theme Factory Companion, pilotable avant toute interface graphique dédiée.
- Le workflow complet est découpé en 15 étapes strictement séquentielles, avec approbations humaines obligatoires avant l'exécution de Claude Code, avant le commit et avant le push (approbation séparée pour le push).
- Les commandes de validation automatique (typecheck, test, build, vérifications Git) sont définies par le profil de workflow et non codées en dur dans le moteur.
- Le nombre de cycles de correction est volontairement limité dans la V1 ; aucune boucle de correction autonome illimitée n'est autorisée.
- La roadmap reprend exactement les 18 sous-phases fournies, sans en inventer de nouvelles, et mentionne un profil Shopify uniquement comme extension future hors périmètre V1.
- Les états fonctionnels du workflow sont documentés de façon indicative, sans figer la modélisation TypeScript qui sera définie en ORCH-1.2.

## 5. Points volontairement laissés ouverts

- Les règles de sécurité détaillées (limites de chemins précises, gestion des secrets, politique de timeout) sont renvoyées à ORCH-0.2.
- Le modèle TypeScript exact de la machine à états sera défini en ORCH-1.2.
- Le schéma de persistance SQLite (tables, colonnes, index) sera défini en ORCH-2.1 et ORCH-2.2.
- Le format exact des fichiers de profil (structure JSON/YAML/TS) sera défini en ORCH-3.1.
- Les détails d'implémentation de l'adaptateur Claude Code (commande exacte, options CLI) seront définis en ORCH-4.2.

## 6. Vérifications effectuées

```powershell
git status --short
```

```powershell
git diff --check
```

```powershell
git diff -- docs/orchestration workflow/reports/RAPPORT_ORCH_0.1.md
```

Les trois fichiers Markdown de `docs/orchestration` ont été relus intégralement après création pour confirmer l'absence de contenu vide ou tronqué.

## 7. Confirmation de l'absence de modification applicative

- Aucun fichier sous `src` n'a été modifié.
- Aucune migration SQLite n'a été créée ou modifiée.
- Aucun `package.json` n'a été modifié.
- Aucune dépendance n'a été installée.
- Aucun script npm n'a été modifié.
- Aucun canal IPC n'a été ajouté.
- Aucun commit n'a été exécuté.
- Aucun push n'a été exécuté.

## 8. Résultat de `git diff --check`

Aucune sortie retournée par la commande : aucun conflit de fin de ligne ni d'espace superflu détecté.

## 9. Résultat de `git status --short`

```text
?? docs/orchestration/
?? workflow/reports/RAPPORT_ORCH_0.1.md
```

## 10. Risques ou ambiguïtés restantes

- Le format exact des profils de workflow (ORCH-3.1) n'est pas encore arrêté ; les exemples de commandes cités dans ce document (`npm run typecheck`, etc.) sont indicatifs et devront être confirmés lors de cette phase.
- La limite exacte du nombre de cycles de correction autorisés (Étape 8) n'est pas chiffrée dans ce document ; elle devra être précisée soit en ORCH-0.2, soit en ORCH-1.2.
- Aucune décision n'a été prise sur l'outil ou le mécanisme concret de présentation des approbations humaines (CLI interne, tests, ou interface) avant ORCH-6.2 ; ce point est intentionnellement laissé ouvert conformément au périmètre de cette phase.
