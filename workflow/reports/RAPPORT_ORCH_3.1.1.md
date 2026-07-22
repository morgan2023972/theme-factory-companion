# Rapport — ORCH-3.1.1 — Contrat exact du profil Electron/TypeScript

## 1. Résumé

Cette sous-phase a créé le contrat Zod partagé du **fichier de configuration** d'un profil de workflow (`src/shared/orchestration/workflowProfileConfig.ts`), strictement distinct du modèle persistant `WorkflowProfile` et de son schéma de création `createWorkflowProfileSchema` (ORCH-1.1/2.2). Aucun chargeur de fichier, aucun calcul d'empreinte, aucun service de fichiers, aucune canonicalisation de chemin réelle n'a été implémenté : cette sous-phase se limite à la forme et aux règles syntaxiques du contenu JSON attendu, conformément à `docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md` (ORCH-3.1.1).

## 2. Fichiers créés et modifiés

**Créés :**

- `src/shared/orchestration/workflowProfileConfig.ts` — le contrat.
- `src/shared/orchestration/workflowProfileConfig.test.ts` — 44 tests.
- `workflow/prompts/ORCH_3.1.1_PROMPT.md` — le prompt d'implémentation.
- `workflow/reports/RAPPORT_ORCH_3.1.1.md` — le présent rapport.

**Modifié :**

- `src/shared/orchestration/index.ts` — ajout d'un unique bloc d'export pour les 6 éléments de l'API (schémas + types). Aucun export existant retiré ou modifié.

Aucun autre fichier n'a été créé ou modifié. En particulier : `workflowProfile.ts`, `common.ts`, tout repository, toute migration, `package.json`, tout fichier `src/preload`/`src/renderer`, aucun canal IPC.

## 3. API exportée

Les 6 éléments exactement demandés, exportés depuis `workflowProfileConfig.ts` puis depuis `index.ts` :

1. `workflowProfileCommandConfigSchema`
2. `type WorkflowProfileCommandConfig` (`z.infer`)
3. `workflowArtifactPathsConfigSchema`
4. `type WorkflowArtifactPathsConfig`
5. `workflowProfileConfigSchema`
6. `type WorkflowProfileConfig`

## 4. Contrat exact implémenté

```text
{
  schemaVersion: 1,
  profileKey: string,          // kebab-case, non vide
  name: string,                 // non vide
  version: string,               // SemVer strict "MAJOR.MINOR.PATCH"
  validationCommands: [
    {
      key: string,               // kebab-case, unique dans le tableau
      name: string,               // non vide
      command: string,            // exécutable unique, sans espace/opérateur shell
      args: string[],             // éléments non vides après trim, tableau vide accepté
      blocking: boolean,          // obligatoire
      timeoutMs: number           // entier, 1000 <= x <= 1800000
    },
    ...
  ],                             // au moins une commande, ordre du tableau conservé
  artifactPaths: {
    promptsDirectory: string,    // chemin relatif syntaxiquement valide
    reportsDirectory: string
  },
  manualValidationChecklist: string[]  // au moins un élément, non vides, sans doublon après trim
}
```

Les trois schémas objet (`workflowProfileCommandConfigSchema`, `workflowArtifactPathsConfigSchema`, `workflowProfileConfigSchema`) sont tous `.strict()` : toute propriété inconnue à la racine ou dans une commande est rejetée.

## 5. Décisions techniques appliquées

Les 18 décisions imposées par le prompt sont appliquées telles quelles :

1. Les trois schémas objet sont `.strict()`.
2. Aucun `.default()`, aucune coercition, aucun `.catch()` (confirmé par recherche exhaustive dans le fichier : aucune occurrence hors commentaire).
3. `schemaVersion: z.literal(1)`.
4. `profileKey` : `nonEmptyTrimmedText` (réutilisé depuis `common.ts`) combiné à un `.refine()` kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).
5. `name` du profil : `nonEmptyTrimmedText`.
6. `version` : `nonEmptyTrimmedText` combiné à un `.refine()` SemVer strict (`^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$`), excluant préfixe `v`, pré-version et métadonnée de build.
7. `workflowProfileCommandConfigSchema` contient exactement `key`, `name`, `command`, `args`, `blocking`, `timeoutMs` (`.strict()`).
8. `key` : même regex kebab-case que `profileKey` (helper local partagé `kebabCaseTextSchema`) ; unicité vérifiée par `.superRefine()` sur le tableau `validationCommands`.
9. `name`/`command` de commande : `nonEmptyTrimmedText`.
10. `command` : `.refine()` rejetant toute présence d'espace/tabulation/retour à la ligne (`\s`) ou d'opérateur shell évident (`&`, `|`, `;`, `<`, `>` — couvrant `&&`/`||` par la présence d'un seul caractère de la classe). Aucun parseur shell général introduit.
11. `args` : `z.array(nonEmptyTrimmedText(...))`, tableau vide accepté, chaque élément conservé tel quel (aucune concaténation).
12. `blocking` : `z.boolean()`, sans `.default()`.
13. `timeoutMs` : `z.number().int().min(1000).max(1800000)`, sans `.default()`.
14. `validationCommands` : `.min(1)` + `.superRefine()` d'unicité des `key` ; ordre du tableau conservé tel quel (aucun tri, aucun champ `position`).
15. `workflowArtifactPathsConfigSchema` contient exactement `promptsDirectory`, `reportsDirectory` (`.strict()`).
16. Chemins validés syntaxiquement par `isSyntacticallyValidRelativeConfigPath` : rejette backslash, chemin commençant/finissant par `/`, lettre de lecteur Windows (`^[a-zA-Z]:`), et tout segment vide/`.`/`..` après découpage sur `/`. Un chemin UNC (`\\server\share\...`) est rejeté par la même règle de backslash, sans logique dédiée. Validation strictement syntaxique, sans accès disque ni résolution réelle — conformément au report explicite vers ORCH-3.2.1.
17. `manualValidationChecklist` : `.min(1)` + éléments `nonEmptyTrimmedText` + `.superRefine()` détectant les doublons après trim ; ordre conservé.
18. `workflowProfileConfigSchema` ne réutilise ni n'importe `workflowProfileSchema` ni `createWorkflowProfileSchema` : `workflowProfileConfig.ts` n'importe que `nonEmptyTrimmedText` depuis `common.ts`, rien depuis `workflowProfile.ts`.

## 6. Tests ajoutés

44 tests dans `workflowProfileConfig.test.ts`, répartis en 4 blocs `describe` :

1. **Cas valides** — 7 tests : profil minimal ; ordre des commandes conservé (3 commandes) ; `args` vide ; `timeoutMs` à 1000 (borne basse) ; `timeoutMs` à 1800000 (borne haute) ; chemins `workflow/prompts`/`workflow/reports` ; checklist de 3 éléments.
2. **Cas invalides** — 33 tests : couvrent exactement la liste demandée (propriété inconnue racine/commande, `schemaVersion`, `profileKey` vide/non kebab-case, `version` vide/non SemVer/préfixe `v`/pré-version, `validationCommands` vide, clés dupliquées, `key` invalide, `name`/`command` vides, `command` avec espace/opérateur shell, argument vide, `blocking`/`timeoutMs` absents, `timeoutMs` non entier/hors bornes des deux côtés, chemin absolu Unix/Windows/UNC/`..`/`.`/backslash/commence ou finit par `/`, checklist vide/élément vide/doublon après trim).
3. **`workflowProfileCommandConfigSchema` — schéma isolé** — 2 tests : commande valide isolée ; rejet explicite d'un champ `position` (confirme l'absence de ce champ dans le contrat de configuration, point 14).
4. **`workflowArtifactPathsConfigSchema` — schéma isolé** — 2 tests : chemins valides isolés ; rejet d'une propriété inconnue.

## 7. Auto-review effectuée

Les 9 points de l'auto-review obligatoire ont été vérifiés :

1. Diff complet relu (`git diff --stat` : uniquement `index.ts` modifié en insertion pure, plus 3 fichiers créés).
2. Contrat distinct confirmé : `workflowProfileConfig.ts` n'importe rien de `workflowProfile.ts` ; seul `nonEmptyTrimmedText` de `common.ts` est réutilisé.
3. Les 3 schémas objet sont bien `.strict()` (vérifié par lecture et par test dédié de rejet de propriété inconnue sur chacun des 3).
4. Recherche exhaustive de `.default(`/`.catch(`/`coerce` dans le fichier : aucune occurrence hors commentaire.
5. Unicité des `key` de commandes vérifiée par lecture du `.superRefine()` et confirmée par le test « refuse des clés de commandes dupliquées ».
6. Règles de chemins Windows/Unix relues ligne à ligne (backslash, lettre de lecteur, UNC via backslash, segments `.`/`..`/vides, bornes `/`) et confirmées par 8 tests négatifs dédiés.
7. Bornes numériques testées des deux côtés (`timeoutMs` = 999/1000/1800000/1800001).
8. **Aucun défaut certain découvert** lors de cette relecture : les 44 tests sont passés dès la première exécution, sans nécessiter de correction.
9. Aucun choix architectural non prévu n'a été introduit (pas de canonicalisation de chemin, pas de fingerprint, pas de chargeur, pas de nouvelle abstraction dans `common.ts`).

Aucune correction autonome n'a donc été nécessaire.

## 8. Responsabilités explicitement reportées

- La **lecture réelle** d'un fichier de configuration (UTF-8, JSON.parse, erreurs explicites) est hors périmètre, reportée à ORCH-3.1.2.
- Le **calcul d'une empreinte stable** (fingerprint) du profil est hors périmètre, reporté à ORCH-3.1.3.
- La **canonicalisation réelle des chemins**, la vérification d'appartenance au dépôt et la résolution des liens symboliques sont hors périmètre, reportées à ORCH-3.2.1 : la validation de `promptsDirectory`/`reportsDirectory` implémentée ici reste strictement syntaxique (aucun accès disque).
- Le **profil réel du projet** (`workflow/config/project.workflow.json`) n'est pas créé ici : reporté à ORCH-3.1.4.

## 9. Résultats des validations ciblées

**`npm run typecheck`** :

```text
> theme-factory-companion@1.0.0 typecheck
> tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit
```

Succès, aucune erreur.

**`npx vitest run src/shared/orchestration/workflowProfileConfig.test.ts --maxWorkers=1`** :

```text
Test Files  1 passed (1)
     Tests  44 passed (44)
```

Succès intégral dès la première exécution.

**`git diff --check`** : exit code 0. Seul un avertissement informatif `LF will be replaced by CRLF` sur `index.ts` (conversion `core.autocrlf`), sans rapport avec le contenu.

Conformément aux instructions, la suite Vitest complète et `npm run build` n'ont pas été exécutés à ce stade : ils sont réservés à ORCH-3.1.V.

## 10. Résultat de `git status --short --untracked-files=all`

Capturé après l'exécution des validations ciblées, avant la rédaction du présent rapport :

```text
 M src/shared/orchestration/index.ts
?? src/shared/orchestration/workflowProfileConfig.test.ts
?? src/shared/orchestration/workflowProfileConfig.ts
?? workflow/prompts/ORCH_3.1.1_PROMPT.md
```

(Le présent rapport, `RAPPORT_ORCH_3.1.1.md`, n'apparaît pas encore dans cette capture puisqu'il est créé juste après.)

## 11. Confirmation

- Aucun fichier hors du périmètre autorisé n'a été créé ou modifié.
- `workflowProfile.ts` n'a subi aucune modification.
- Aucun repository, aucune migration, aucun IPC/preload/renderer, aucune dépendance, aucun `package.json` n'a été modifié.
- Aucun `git add`, `git commit` ou `git push` n'a été exécuté à aucun moment de cette intervention.
