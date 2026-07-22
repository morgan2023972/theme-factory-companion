# Prompt Claude Code — ORCH-3.1.V — Validation intégrée du profil Electron/TypeScript

## Contexte

- ORCH-3.1.1 (contrat, `src/shared/orchestration/workflowProfileConfig.ts`), ORCH-3.1.2 (loader, `src/main/orchestration/workflowProfileLoader.ts`), ORCH-3.1.3 (fingerprint, `src/main/orchestration/workflowProfileFingerprint.ts`) et ORCH-3.1.4 (profil réel, `workflow/config/project.workflow.json`, test `src/main/orchestration/projectWorkflowProfile.test.ts`) sont terminées, validées, commitées et poussées.
- ORCH-3.1.V clôture le bloc ORCH-3.1 : il ne s'agit pas d'ajouter une fonctionnalité, mais de vérifier l'intégration complète de ce qui existe déjà et de compléter uniquement les tests d'intégration réellement manquants.

## Objectif

Valider ensemble, sans rien ajouter de fonctionnel :

- le contrat du profil (`workflowProfileConfigSchema`) ;
- le chargement du vrai fichier `workflow/config/project.workflow.json` ;
- la stabilité du fingerprint calculé sur ce vrai fichier ;
- l'ordre et la validité des commandes déclarées ;
- les chemins d'artefacts déclarés ;
- la checklist manuelle déclarée.

## Analyse de couverture existante (à confirmer, pas à refaire)

- `src/shared/orchestration/workflowProfileConfig.test.ts` couvre déjà exhaustivement le contrat (cas valides et invalides, tous les champs).
- `src/main/orchestration/workflowProfileLoader.test.ts` couvre déjà le chargement (17 tests, toutes les catégories d'erreur).
- `src/main/orchestration/workflowProfileFingerprint.test.ts` couvre déjà la stabilité/sensibilité du fingerprint sur des configurations synthétiques (`buildConfig`).
- `src/main/orchestration/projectWorkflowProfile.test.ts` couvre déjà : chargement du vrai fichier, ordre et forme des 5 commandes, `artifactPaths`, présence d'une checklist non vide, stabilité du fingerprint sur deux appels et sur deux chargements indépendants.

**Lacune identifiée** : aucun test n'exerce la **sensibilité** du fingerprint sur le **vrai fichier de profil** (seule la stabilité y est testée) — la sensibilité à un changement significatif n'est vérifiée que sur des configurations synthétiques (ORCH-3.1.3). Il manque un test reliant le vrai fichier chargé à une mutation contrôlée en mémoire (jamais écrite sur disque) démontrant que l'empreinte change bien.

## Travail attendu

1. Ajouter, dans `src/main/orchestration/projectWorkflowProfile.test.ts`, uniquement le(s) test(s) d'intégration manquant(s) identifié(s) ci-dessus :
   - charger le vrai fichier, produire une copie modifiée **en mémoire** (ex. `blocking` inversé sur une commande, ou réordonnancement de `validationCommands`), et vérifier que `computeWorkflowProfileFingerprint` produit une empreinte différente de celle du profil réel inchangé ;
   - ne jamais écrire sur `workflow/config/project.workflow.json` depuis le test.
2. Ne modifier aucun module fonctionnel (`workflowProfileConfig.ts`, `workflowProfileLoader.ts`, `workflowProfileFingerprint.ts`, `workflow/config/project.workflow.json`) **sauf défaut certain et démontré** pendant cette validation — le cas échéant, documenter précisément le défaut et le correctif minimal dans le rapport.
3. Exécuter la suite complète et le build :

```powershell
npm run typecheck
npx vitest run --maxWorkers=1
npm run build
git diff --check
git status --short --untracked-files=all
```

4. Effectuer une auto-review complète du bloc ORCH-3.1 (les 4 fichiers de code + leurs tests + le profil réel), pas seulement du test ajouté.
5. Corriger uniquement les défauts certains et non ambigus rencontrés.

## Contraintes strictes

- Aucune nouvelle fonctionnalité.
- Aucune modification des migrations, repositories, IPC, preload ou renderer.
- Aucune dépendance ajoutée.
- Aucun changement du contrat (`workflowProfileConfig.ts`) sans défaut démontré et documenté.
- Arrêt et décision humaine demandée en cas de problème architectural, d'échec fonctionnel non local à ce bloc, ou de fichier hors périmètre détecté.
- Le rapport doit être finalisé **avant** le commit : ne pas y inscrire le hash du commit (il n'existe pas encore au moment de la rédaction) — se limiter à confirmer que le commit sera créé si toutes les conditions sont réunies, sans anticiper son hash.

## Fichiers autorisés pour le commit

- `src/main/orchestration/projectWorkflowProfile.test.ts` (test(s) d'intégration manquant(s) ajouté(s))
- `workflow/prompts/ORCH_3.1.V_PROMPT.md`
- `workflow/reports/RAPPORT_ORCH_3.1.V.md`
- (uniquement si un défaut certain est démontré et corrigé : le fichier fonctionnel concerné parmi `workflowProfileConfig.ts`, `workflowProfileLoader.ts`, `workflowProfileFingerprint.ts`, `workflow/config/project.workflow.json` — à documenter explicitement dans le rapport si utilisé)

## Message de commit

```
test: validate workflow profile integration
```

## Commit local automatique

- autorisé uniquement si l'auto-review complète du bloc ORCH-3.1 est réussie, `npm run typecheck`, la suite Vitest complète et `npm run build` sont tous verts, `git diff --check` réussit, et la liste réelle des fichiers modifiés correspond exactement à la liste ci-dessus (voir `docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md`, section « Commit local automatique après une sous-phase réussie », 13 conditions) ;
- en cas d'anomalie quelconque, arrêt sans commit et décision humaine demandée.

## Push

- strictement interdit : ne jamais exécuter `git push`, `git push --force` ou `git push --force-with-lease`.

## Rapport

Créer `workflow/reports/RAPPORT_ORCH_3.1.V.md` : résumé de la validation intégrée, couverture existante confirmée, lacune identifiée et test ajouté, résultats de toutes les commandes exécutées (typecheck, suite complète, build, git diff --check, git status), auto-review du bloc ORCH-3.1 complet, vérification des 13 conditions d'autorisation du commit, confirmation qu'aucun push n'a été exécuté. Le hash du commit n'y figure pas (rapport finalisé avant le commit).
