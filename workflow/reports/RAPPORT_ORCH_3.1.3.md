# Rapport — ORCH-3.1.3 — Empreinte stable du profil

## 1. Résumé

Cette sous-phase a créé une fonction pure de calcul d'empreinte (`src/main/orchestration/workflowProfileFingerprint.ts`) : à partir d'un `WorkflowProfileConfig` déjà validé (ORCH-3.1.1/3.1.2), elle produit une représentation canonique (tri récursif des clés d'objet, ordre des tableaux conservé) puis un hash SHA-256 formaté `sha256:<hex>`. Aucune persistance, aucune validation du dépôt, aucune exécution de commande, aucun profil réel de projet créé — strictement la fonction, ses tests, le prompt et ce rapport.

## 2. Fichiers créés et modifiés

**Créés :**

- `src/main/orchestration/workflowProfileFingerprint.ts` — la fonction de calcul d'empreinte.
- `src/main/orchestration/workflowProfileFingerprint.test.ts` — 9 tests.
- `workflow/prompts/ORCH_3.1.3_PROMPT.md` — le prompt d'implémentation.
- `workflow/reports/RAPPORT_ORCH_3.1.3.md` — le présent rapport.

**Modifié :** aucun fichier existant.

Confirmé par `git status --short --untracked-files=all` : uniquement des fichiers `??` (nouveaux), aucun `M`. `workflowProfileConfig.ts`, `workflowProfileLoader.ts`, `src/shared/orchestration/index.ts`, tout repository, toute migration : tous non touchés.

## 3. API exportée

```ts
export function computeWorkflowProfileFingerprint(config: WorkflowProfileConfig): string
```

Retourne une chaîne au format `sha256:<hex>` (64 caractères hexadécimaux minuscules après le préfixe).

## 4. Décisions prises

| Décision | Choix retenu | Raison |
|---|---|---|
| Entrée de la fonction | `WorkflowProfileConfig` déjà validé (jamais du JSON brut ni `unknown`) | Le fingerprint ne doit jamais être calculé sur une donnée non validée ; aucune duplication de la validation Zod. |
| Emplacement | `src/main/orchestration/` (et non `src/shared/orchestration/`) | `node:crypto` n'est pas garanti côté renderer ; `src/shared/**/*.ts` est inclus dans `tsconfig.web.json`, qui ne cible pas Node. |
| Représentation canonique | JSON déterministe, tri récursif et générique des clés d'objet, tableaux conservés dans leur ordre d'origine | L'ordre de `validationCommands` et de `manualValidationChecklist` est sémantiquement significatif (documenté dans `workflowProfileConfig.ts`) : le trier romprait la garantie « un changement significatif modifie l'empreinte ». Un tri générique (pas de liste de champs codée en dur) reste correct si le schéma évolue. |
| Algorithme de hachage | SHA-256, résultat hex préfixé `sha256:` | Cohérent avec le format déjà utilisé dans `workflowRun.test.ts` (`profileFingerprint: 'sha256:abcdef'`). |

Aucune de ces décisions n'a été jugée suffisamment ambiguë ou risquée pour justifier un arrêt humain préalable (pas de choix architectural non défini, pas de contradiction documentaire, pas de dépendance ajoutée — `node:crypto` est un module natif Node).

## 5. Stratégie d'implémentation

1. `toCanonicalValue(value)` : fonction récursive interne — si `value` est un tableau, retourne `value.map(toCanonicalValue)` (ordre conservé) ; si `value` est un objet non nul, retourne un nouvel objet dont les clés sont triées alphabétiquement puis chacune récursivement canonicalisée ; sinon retourne `value` tel quel (types primitifs).
2. `computeWorkflowProfileFingerprint(config)` : sérialise `toCanonicalValue(config)` en JSON, hache la chaîne UTF-8 résultante avec `createHash('sha256')`, retourne `sha256:${hash.digest('hex')}`.
3. Aucune mutation de `config` : `toCanonicalValue` ne lit que les propriétés existantes et construit toujours de nouveaux objets/tableaux via `Object.fromEntries`/`.map`.

## 6. Tests ajoutés

9 tests dans `workflowProfileFingerprint.test.ts`, avec un helper `buildConfig(overrides)` construisant un `WorkflowProfileConfig` valide représentatif (2 commandes de validation, checklist à 2 éléments) :

1. Deux objets JS distincts mais équivalents → même empreinte.
2. Clés de `artifactPaths` déclarées dans un ordre différent → même empreinte.
3. Appels répétés sur le même objet → empreinte strictement identique à chaque fois.
4. Changement d'un champ scalaire racine (`version`) → empreinte différente.
5. Changement d'un champ scalaire imbriqué (`blocking` d'une commande) → empreinte différente.
6. Réordonnancement de `validationCommands` (même contenu, ordre inversé) → empreinte différente.
7. Réordonnancement de `manualValidationChecklist` → empreinte différente.
8. Format exact du résultat vérifié par regex (`/^sha256:[0-9a-f]{64}$/`).
9. Absence de mutation de l'objet `config` reçu (comparaison avec un snapshot `JSON.parse(JSON.stringify(...))` pris avant l'appel).

## 7. Auto-review effectuée

Les 9 points de l'auto-review obligatoire du prompt ont été vérifiés :

1. Diff complet relu (`git status --short --untracked-files=all`) : uniquement 4 fichiers nouveaux dans le périmètre autorisé (2 sources + prompt + ce rapport), aucune modification.
2. Le tri de clés est réellement récursif et générique : `toCanonicalValue` s'applique uniformément à tout objet rencontré (racine, `artifactPaths`, chaque élément de `validationCommands`) sans aucune liste de champs codée en dur — confirmé par le test 2 (tri appliqué à un objet imbriqué sans code dédié à `artifactPaths`).
3. Aucun tableau n'est trié : seule la branche `Array.isArray` existe pour les tableaux, et elle ne fait que `.map`, jamais `.sort` — confirmé par les tests 6 et 7 (réordonnancement change l'empreinte).
4. Aucune mutation de l'entrée : confirmé par le test 9 dédié.
5. Format de sortie vérifié par un test dédié à une expression régulière stricte.
6. Aucune responsabilité d'ORCH-3.1.4 (profil réel), d'ORCH-3.2.1 (canonicalisation/restriction de chemin) ou d'ORCH-3.1.V (validation intégrée, comparaison à un fingerprint existant) introduite : la fonction ne lit aucun fichier, ne compare à rien, ne connaît aucun chemin.
7. Aucun fichier hors périmètre modifié : confirmé par `git status --short --untracked-files=all` (uniquement des `??`).
8. Aucun défaut certain trouvé dans l'implémentation lors de cette auto-review. Aucun incident d'infrastructure rencontré cette fois (contrairement à ORCH-3.1.2).
9. Aucun `git add`, `git commit` ou `git push` exécuté à aucun moment de cette intervention.

## 8. Responsabilités explicitement reportées

- La **comparaison** entre un fingerprint calculé et un `WorkflowRun.profileFingerprint` déjà persisté (pour détecter une modification du profil en cours de workflow) reste hors périmètre — logique d'exécution ultérieure.
- La **canonicalisation/résolution de chemin** et la restriction au dépôt restent hors périmètre, reportées à ORCH-3.2.1.
- La **création du profil réel du projet** (`workflow/config/project.workflow.json`) reste hors périmètre, reportée à ORCH-3.1.4.
- La **validation intégrée** (chargement du vrai profil + calcul de son fingerprint + cohérence documentaire) reste hors périmètre, reportée à ORCH-3.1.V.

## 9. Résultats des validations ciblées

**`npm run typecheck`** :

```text
> theme-factory-companion@1.0.0 typecheck
> tsc -p tsconfig.node.json --noEmit && tsc -p tsconfig.web.json --noEmit
```

Succès, aucune erreur.

**`npx vitest run src/main/orchestration/workflowProfileFingerprint.test.ts --maxWorkers=1`** :

```text
Test Files  1 passed (1)
     Tests  9 passed (9)
```

Succès intégral, dès la première exécution (aucun incident d'infrastructure cette fois).

**`git diff --check`** : exit code 0, aucune sortie.

Conformément aux instructions, la suite Vitest complète et `npm run build` n'ont pas été exécutés à ce stade : réservés à ORCH-3.1.V.

## 10. Résultat de `git status --short --untracked-files=all`

Capturé après l'exécution des validations ciblées, avant la rédaction du présent rapport :

```text
?? src/main/orchestration/workflowProfileFingerprint.test.ts
?? src/main/orchestration/workflowProfileFingerprint.ts
?? workflow/prompts/ORCH_3.1.3_PROMPT.md
```

(Le présent rapport, `RAPPORT_ORCH_3.1.3.md`, n'apparaît pas encore dans cette capture puisqu'il est créé juste après.)

## 11. Confirmation

- Aucun fichier hors du périmètre autorisé n'a été créé ou modifié.
- `workflowProfileConfig.ts`, `workflowProfileLoader.ts` et `src/shared/orchestration/index.ts` n'ont subi aucune modification.
- Aucun repository, aucune migration, aucun IPC/preload/renderer, aucune dépendance, aucun `package.json` n'a été modifié.
- Aucun `git add`, `git commit` ou `git push` n'a été exécuté à aucun moment de cette intervention.
