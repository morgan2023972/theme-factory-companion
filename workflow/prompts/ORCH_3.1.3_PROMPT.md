# Prompt Claude Code — ORCH-3.1.3 — Empreinte stable du profil

## Contexte

- ORCH-3.1.1 a fixé le contrat `WorkflowProfileConfig` (`src/shared/orchestration/workflowProfileConfig.ts`).
- ORCH-3.1.2 a livré `loadWorkflowProfile` (`src/main/orchestration/workflowProfileLoader.ts`), qui lit, parse et valide un fichier de profil et retourne un `WorkflowProfileConfig` entièrement validé.
- ORCH-3.1.3 ajoute une fonction pure qui calcule une empreinte (« fingerprint ») stable à partir d'un `WorkflowProfileConfig` déjà validé.

Cette empreinte est distincte de `WorkflowProfile.version` (version métier déclarée par l'auteur du profil) et de `WorkflowRun.profileFingerprint` (champ de stockage déjà défini en ORCH-1.1, dont le format attendu — observé dans les tests existants — est une chaîne du type `"sha256:<hex>"`).

## Objectif

Créer `src/main/orchestration/workflowProfileFingerprint.ts` exportant :

```ts
export function computeWorkflowProfileFingerprint(config: WorkflowProfileConfig): string
```

qui :

1. Produit une représentation canonique déterministe de `config` : sérialisation JSON avec tri récursif des clés de chaque objet (ordre alphabétique), en conservant l'ordre d'origine de tous les tableaux (l'ordre de `validationCommands` et de `manualValidationChecklist` est sémantiquement significatif — voir `workflowProfileConfig.ts` — donc il ne doit jamais être réordonné).
2. Calcule un SHA-256 (`node:crypto`, `createHash('sha256')`) sur cette représentation canonique encodée en UTF-8.
3. Retourne la chaîne au format `sha256:<hex>` (hex en minuscules).

Contraintes strictes :

- Fonction pure : aucune lecture de fichier, aucun accès réseau, aucun accès SQLite, aucune dépendance à Electron ou au renderer.
- Aucune mutation de l'objet `config` reçu en paramètre.
- Le tri de clés doit être **récursif** (s'applique à `artifactPaths` et à chaque élément de `validationCommands`), implémenté de façon générique (pas de liste de champs codée en dur), pour rester correct si le schéma évolue.
- Ne pas dupliquer ni ré-implémenter la validation Zod : l'entrée est supposée déjà valide (le type `WorkflowProfileConfig` fait foi).
- Ne rien persister, ne rien comparer à un fingerprint existant, ne rien logger.

## Cas de test attendus (`workflowProfileFingerprint.test.ts`)

1. Même `WorkflowProfileConfig` (deux objets JS distincts mais équivalents) → même empreinte.
2. Deux objets équivalents mais dont les clés d'un objet imbriqué (`artifactPaths`) sont déclarées dans un ordre différent en JS → même empreinte (le tri de clés neutralise l'ordre de déclaration).
3. Appels répétés sur le même objet → toujours la même empreinte (aucun aléa, aucun horodatage).
4. Changement d'un champ scalaire (ex. `version`, `name`, `blocking` d'une commande) → empreinte différente.
5. Réordonnancement de `validationCommands` (même contenu, ordre différent) → empreinte différente (l'ordre des tableaux est significatif).
6. Réordonnancement de `manualValidationChecklist` → empreinte différente.
7. Format du résultat : préfixe exact `sha256:`, suivi de 64 caractères hexadécimaux minuscules.
8. `config` passé en paramètre n'est pas muté après l'appel (comparaison profonde avant/après).

## Hors périmètre (ne pas implémenter ici)

- Aucune persistance du run.
- Aucune validation du dépôt (ORCH-3.2.1).
- Aucune exécution de commande.
- Aucune comparaison avec un `WorkflowRun.profileFingerprint` existant.
- Aucun profil réel de projet (ORCH-3.1.4).

## Validations à exécuter (sous-phase limitée)

```powershell
npm run typecheck
npx vitest run src/main/orchestration/workflowProfileFingerprint.test.ts --maxWorkers=1
git diff --check
```

La suite Vitest complète et `npm run build` sont réservés à ORCH-3.1.V.

## Auto-review obligatoire avant rapport

1. Relire le diff complet (`git status --short --untracked-files=all`) : uniquement les fichiers attendus.
2. Vérifier que le tri de clés est réellement récursif et générique (pas de champ oublié, pas de liste codée en dur).
3. Vérifier qu'aucun tableau n'est trié (seuls les objets le sont).
4. Vérifier l'absence de toute mutation de l'entrée.
5. Vérifier le format exact de sortie (`sha256:` + 64 hex minuscules) par un test dédié.
6. Vérifier qu'aucune responsabilité d'ORCH-3.1.4, ORCH-3.2.1 ou ORCH-3.1.V n'a été introduite.
7. Vérifier qu'aucun fichier hors périmètre n'a été modifié (`workflowProfileConfig.ts`, `workflowProfileLoader.ts`, `index.ts` partagé, repositories, migrations : aucun ne doit changer).
8. Rédiger `workflow/reports/RAPPORT_ORCH_3.1.3.md` selon le même format que les rapports précédents (résumé, fichiers créés/modifiés, API exportée, stratégie, tests, auto-review, responsabilités reportées, résultats des validations ciblées, résultat de `git status`).
9. Ne pas exécuter `git add`, `git commit` ou `git push`.
