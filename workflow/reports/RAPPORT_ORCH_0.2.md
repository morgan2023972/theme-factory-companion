# Rapport — ORCH-0.2 — Règles de sécurité de l'orchestrateur local V1

## 1. Résumé de la phase

Cette phase a produit la politique de sécurité complète de l'orchestrateur local V1 : un document de règles détaillé (`ORCHESTRATOR_V1_SAFETY_RULES.md`) et une matrice compacte action par action (`ORCHESTRATOR_V1_SECURITY_MATRIX.md`), tous deux cohérents avec le périmètre, les rôles et le workflow définis en ORCH-0.1. Aucune implémentation applicative n'a été réalisée : la phase est strictement documentaire.

## 2. Fichiers créés

- `docs/orchestration/ORCHESTRATOR_V1_SAFETY_RULES.md` — politique de sécurité complète (23 sections) : principes fail-closed/fail-safe/moindre privilège, frontières de confiance, validation des chemins, lecture/écriture de fichiers, profil de workflow, exécution des commandes, commandes interdites, liste blanche, sécurité Claude Code, concurrence, timeout/annulation/reprise, secrets, journalisation, règles Git (staging, commit, push), approbations humaines, catégories d'erreurs, responsabilités par couche, checklist de validation des futures implémentations et décisions volontairement non fixées.
- `docs/orchestration/ORCHESTRATOR_V1_SECURITY_MATRIX.md` — matrice compacte listant les actions demandées avec catégorie, autorisation V1, approbation humaine requise, conditions et comportement en cas d'échec.
- `workflow/reports/RAPPORT_ORCH_0.2.md` — le présent rapport de phase.

## 3. Fichiers modifiés

Aucun fichier existant n'a été modifié. Aucun des trois fichiers cibles n'existait préalablement.

## 4. Principales règles définies

- Principe général « en cas de doute, ne pas exécuter », décliné en fail-safe / fail-closed / moindre privilège / refus par défaut.
- Frontières de confiance explicites pour l'utilisateur, les modèles IA, stdout/stderr, les rapports, le profil, Git, SQLite et les fichiers.
- Validation stricte des chemins : dépôt déclaré, résolution absolue, rejet hors dépôt, normalisation de `..`, résolution des liens symboliques/jonctions, refus des chemins réseau.
- `shell: false` par défaut, arguments séparés, `cwd` explicite, capture systématique de stdout/stderr/code de sortie, timeout et annulation obligatoires.
- Liste explicite de commandes interdites (force push, reset hard, clean, rebase, merge, tag, `rm -rf`, `Invoke-Expression`, etc.).
- Politique de liste blanche par catégorie (lecture, validation, écriture contrôlée, Git sensible), refus par défaut de toute commande non catégorisée.
- Sécurité spécifique à Claude Code : dépôt validé, prompt approuvé, une seule exécution par projet, rapport traité comme déclaration non comme preuve.
- Staging explicite (interdiction de `git add .`/`git add -A`), commit et push soumis à des approbations humaines distinctes.
- Protection des secrets : aucun secret en base ni dans les artefacts, masquage dans les journaux, refus par défaut des fichiers sensibles (`.env`, `*.pem`, `*.key`, clés SSH) avant commit.
- Règle de reprise après interruption : aucune reprise automatique implicite, vérification de l'état réel avant toute relance.

## 5. Décisions prises

- La matrice de sécurité est présentée comme une traduction opérationnelle du document de règles, ce dernier faisant foi en cas de divergence apparente.
- Rebase, merge et tag sont classés « hors périmètre V1 » (et non « interdit ») dans la matrice, en cohérence avec `ORCHESTRATOR_V1_SCOPE.md` qui les exclut du périmètre V1 plutôt que de les interdire techniquement pour toujours.
- Reset hard et clean sont classés « interdit » (et non « hors périmètre »), car ce sont des commandes explicitement bannies par la section 8 des règles de sécurité, indépendamment du périmètre fonctionnel.
- Les valeurs numériques (durées de timeout, limites de taille, nombre maximal de cycles de correction) sont explicitement laissées ouvertes plutôt que fixées arbitrairement.

## 6. Points laissés ouverts

- La durée exacte des timeouts (Claude Code, commandes de validation) : à définir lors d'ORCH-4.1/ORCH-4.2.
- Les limites de taille exactes des fichiers d'artefacts (prompts, rapports) : à définir lors d'ORCH-3.2.
- Le nombre maximal exact de cycles de correction autorisés par phase : à définir au plus tard lors d'ORCH-1.2.
- Le format exact de journalisation (schéma de table, structure JSON) : à définir lors d'ORCH-2.1/ORCH-2.2.
- La liste précise des motifs de détection de secrets (regex, heuristiques) : à affiner lors de l'implémentation du command runner (ORCH-4.1).

## 7. Vérifications effectuées

```powershell
git status --short
git branch --show-current
```

```powershell
git diff --check
git status --short --untracked-files=all
```

Les deux documents de sécurité et le rapport ont été relus intégralement après création pour confirmer l'absence de contenu vide ou tronqué.

## 8. Confirmation du périmètre

- Aucun fichier sous `src` n'a été modifié.
- Aucune migration n'a été modifiée.
- Aucun `package.json` n'a été modifié.
- Aucune dépendance n'a été installée.
- Aucun script npm n'a été modifié.
- Aucun commit n'a été exécuté.
- Aucun push n'a été exécuté.

## 9. Résultat de `git diff --check`

Aucune sortie retournée par la commande : aucun conflit de fin de ligne ni d'espace superflu détecté.

## 10. Résultat de `git status --short --untracked-files=all`

```text
?? docs/orchestration/ORCHESTRATOR_V1_SAFETY_RULES.md
?? docs/orchestration/ORCHESTRATOR_V1_SECURITY_MATRIX.md
?? workflow/reports/RAPPORT_ORCH_0.2.md
```

## 11. Risques ou ambiguïtés restantes

- La classification « hors périmètre V1 » versus « interdit » pour rebase/merge/tag d'une part et reset hard/clean d'autre part repose sur une interprétation de la différence entre exclusion fonctionnelle (V1 ne gère pas cela) et interdiction de sécurité (commande dangereuse bannie) ; cette distinction pourra être revue en review humaine si elle prête à confusion.
- Le mécanisme concret de détection des motifs de secrets dans stdout/stderr n'est pas encore spécifié techniquement, seul le principe est posé.
- La checklist de validation des futures implémentations (section 22 des règles de sécurité) devra être reprise explicitement comme critère d'acceptation dans chaque sous-phase applicative à partir d'ORCH-1.1.
