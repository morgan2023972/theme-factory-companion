# Prompt Claude Code — ORCH-3.1.4 — Profil réel du projet Electron/TypeScript

## Contexte

- ORCH-3.1.1 (contrat, `src/shared/orchestration/workflowProfileConfig.ts`), ORCH-3.1.2 (loader, `src/main/orchestration/workflowProfileLoader.ts`) et ORCH-3.1.3 (fingerprint, `src/main/orchestration/workflowProfileFingerprint.ts`) sont terminées, validées, commitées et poussées.
- Cette sous-phase crée le **premier profil réel** du projet, conforme au contrat `workflowProfileConfigSchema`, sans modifier ce contrat ni le loader ni le fingerprint.
- Le workflow d'auto-review et de commit local automatique conditionnel (`docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md`) s'applique à cette sous-phase.

## Objectif

Créer `workflow/config/project.workflow.json`, un fichier de configuration JSON conforme à `workflowProfileConfigSchema`, chargeable tel quel par `loadWorkflowProfile` et dont l'empreinte est calculable de façon stable par `computeWorkflowProfileFingerprint`.

## Contenu exact attendu

```json
{
  "schemaVersion": 1,
  "profileKey": "electron-typescript",
  "name": "Electron / TypeScript",
  "version": "1.0.0",
  "validationCommands": [
    {
      "key": "typecheck",
      "name": "Typecheck",
      "command": "npm",
      "args": ["run", "typecheck"],
      "blocking": true,
      "timeoutMs": 120000
    },
    {
      "key": "test",
      "name": "Tests",
      "command": "npm",
      "args": ["run", "test"],
      "blocking": true,
      "timeoutMs": 300000
    },
    {
      "key": "build",
      "name": "Build",
      "command": "npm",
      "args": ["run", "build"],
      "blocking": true,
      "timeoutMs": 300000
    },
    {
      "key": "git-diff-check",
      "name": "git diff --check",
      "command": "git",
      "args": ["diff", "--check"],
      "blocking": true,
      "timeoutMs": 30000
    },
    {
      "key": "git-status-short",
      "name": "git status --short",
      "command": "git",
      "args": ["status", "--short"],
      "blocking": true,
      "timeoutMs": 15000
    }
  ],
  "artifactPaths": {
    "promptsDirectory": "workflow/prompts",
    "reportsDirectory": "workflow/reports"
  },
  "manualValidationChecklist": [
    "L'application Electron démarre sans erreur visible dans la console.",
    "Le comportement demandé par la sous-phase fonctionne réellement dans l'application.",
    "Aucune régression visible n'est constatée sur les écrans existants."
  ]
}
```

Justification des commandes : lues directement dans `package.json` à la racine du dépôt —

- `"typecheck": "tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit"` → `npm run typecheck` ;
- `"test": "vitest run"` → `npm run test` ;
- `"build": "electron-vite build"` → `npm run build` ;
- `git diff --check` et `git status --short` proviennent de `ORCHESTRATOR_V1_WORKFLOW.md` (Étape 9).

`command` est toujours un exécutable unique (`npm` ou `git`), les sous-commandes (`run typecheck`, `diff --check`, etc.) sont dans `args`, jamais concaténées dans `command` — conforme à `commandExecutableSchema` et aux règles de sécurité (section 7).

Toutes les commandes sont déclarées `blocking: true` : aucune exception non bloquante n'est documentée ici, conformément à la règle par défaut (« un code de sortie non nul est considéré comme un échec par défaut, sauf exception explicitement documentée dans le profil »).

## Contraintes strictes

- Lire `package.json` avant de fixer les commandes (fait ci-dessus — ne pas s'en écarter sans le revérifier).
- Ne modifier ni `workflowProfileConfig.ts`, ni `workflowProfileLoader.ts`, ni `workflowProfileFingerprint.ts`, ni `src/shared/orchestration/index.ts`.
- Ne pas exécuter réellement les commandes du profil dans le test d'intégration (ni `npm run build`, ni `git diff --check`, etc. déclenchés depuis le test) : le test charge et fingerprinte le fichier, il ne lance aucune des commandes qu'il déclare.
- Aucune logique Shopify.
- Ne pas modifier migrations, repositories, IPC, preload, renderer ou `package.json`.
- Ne pas anticiper ORCH-3.2 (pas de canonicalisation de chemin, pas de service de prompts/rapports, pas de persistance d'artefact).
- Encodage UTF-8, terminaison de ligne cohérente avec le reste du dépôt.

## Test d'intégration attendu

Créer `workflow/config/project.workflow.test.ts` (ou emplacement équivalent sous `src/main/orchestration/`, à choisir selon la convention déjà utilisée pour les tests d'intégration du projet) qui :

1. appelle `loadWorkflowProfile` sur le **vrai chemin** `workflow/config/project.workflow.json` (résolu depuis la racine du dépôt, par exemple via `path.join(__dirname, ...)` ou `process.cwd()` selon la convention déjà en usage dans le dépôt) ;
2. vérifie que le chargement réussit et que le résultat correspond au contenu attendu (au moins : `profileKey`, `version`, nombre et ordre des `validationCommands`, clés des commandes, `artifactPaths`) ;
3. appelle `computeWorkflowProfileFingerprint` sur le résultat chargé et vérifie que l'empreinte est stable (deux appels consécutifs produisent la même valeur) et respecte le format `sha256:<64 hex>` ;
4. ne mocke ni le système de fichiers ni le contenu du profil : lecture réelle du fichier réel créé par cette sous-phase.

## Fichiers autorisés pour le commit

- `workflow/config/project.workflow.json`
- `src/main/orchestration/projectWorkflowProfile.test.ts` (test d'intégration, colocalisé avec les tests existants d'ORCH-3.1.2/3.1.3, `workflow/config` étant hors du glob `include` de `vitest.config.ts`)
- `workflow/prompts/ORCH_3.1.4_PROMPT.md`
- `workflow/reports/RAPPORT_ORCH_3.1.4.md`

## Message de commit

```
feat: add Electron TypeScript workflow profile
```

## Commit local automatique

- autorisé uniquement si l'auto-review est réussie, toutes les validations ciblées sont vertes, `git diff --check` réussit, et que la liste réelle des fichiers modifiés correspond exactement à la liste ci-dessus (voir `docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md`, section « Commit local automatique après une sous-phase réussie », 13 conditions) ;
- en cas d'anomalie quelconque (fichier hors périmètre, validation en échec, correction encore nécessaire, ambiguïté), arrêt sans commit et décision humaine demandée.

## Push

- strictement interdit : ne jamais exécuter `git push`, `git push --force` ou `git push --force-with-lease`.

## Validations ciblées à exécuter

```powershell
npm run typecheck
npx vitest run workflow/config/project.workflow.test.ts --maxWorkers=1
git diff --check
```

(adapter le chemin du test ciblé à l'emplacement réellement choisi)

## Auto-review obligatoire avant rapport

1. Relire le diff complet (`git status --short --untracked-files=all`) : uniquement les fichiers attendus.
2. Vérifier que le JSON créé valide intégralement avec `workflowProfileConfigSchema` (via le test, en passant par le vrai loader — pas de duplication de validation).
3. Vérifier que chaque commande déclarée correspond exactement à un script réel de `package.json` (ou à `git`), sans invention.
4. Vérifier qu'aucune commande interne de l'orchestrateur (Git, Claude Code) n'a été ajoutée en dehors des deux commandes de lecture Git explicitement demandées (`git diff --check`, `git status --short`), déjà couvertes par la liste blanche documentée.
5. Vérifier que le test d'intégration utilise le vrai fichier et le vrai loader/fingerprint, sans mock.
6. Vérifier qu'aucun fichier hors périmètre (contrat, loader, fingerprint, migrations, repositories, IPC, preload, renderer, `package.json`) n'a été modifié.
7. Vérifier qu'aucune dépendance n'a été ajoutée.
8. Rédiger `workflow/reports/RAPPORT_ORCH_3.1.4.md`.
9. Appliquer la procédure de commit local automatique décrite dans `docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md` si et seulement si toutes les conditions sont réunies ; sinon, arrêt et rapport du blocage.
10. Ne jamais exécuter `git push`.
