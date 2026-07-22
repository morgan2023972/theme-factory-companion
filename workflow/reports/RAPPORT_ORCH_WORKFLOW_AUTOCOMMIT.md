# Rapport — ORCH-WORKFLOW-AUTOCOMMIT — Commit local automatique

## 1. Résumé du nouveau workflow

Le workflow de développement de l'orchestrateur (`docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md`, section « Workflow de développement applicable à l'orchestrateur ») intègre désormais une étape de **commit local automatique** exécutée par Claude Code après une sous-phase réussie, conditionnée à 13 critères d'autorisation stricts. Le **push reste strictement interdit à Claude Code** en toutes circonstances : action manuelle et séparée réservée à l'utilisateur.

Ce changement ne concerne que le processus de développement de l'orchestrateur mené dans ce dépôt (le « méta-workflow »), et non le comportement du futur moteur applicatif de l'orchestrateur décrit dans `ORCHESTRATOR_V1_WORKFLOW.md` (Étapes 11-15) et `ORCHESTRATOR_V1_SAFETY_RULES.md` (sections 15-18), qui conservent commit et push soumis à approbation humaine explicite dans le produit final. Ces deux documents n'ont donc pas été modifiés.

## 2. Fichiers documentaires modifiés

**Modifié :**

- `docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md` — section « Workflow de développement applicable à l'orchestrateur » étendue : étapes 11/12 scindées (commit automatique / push manuel), nouvelle sous-section « Commit local automatique après une sous-phase réussie » (conditions d'autorisation, procédure Git obligatoire, conditions d'arrêt, règles de staging, exécution du commit, interdiction du push, commandes interdites), nouvelle sous-section « Format exigé pour les prompts de sous-phase ».

**Créés :**

- `workflow/prompts/ORCH_WORKFLOW_AUTOCOMMIT_PROMPT.md` — le prompt de cette intervention.
- `workflow/reports/RAPPORT_ORCH_WORKFLOW_AUTOCOMMIT.md` — le présent rapport.

**Non modifiés (décision documentée)** :

- `docs/orchestration/ORCHESTRATOR_V1_WORKFLOW.md` — décrit le comportement du futur moteur applicatif (Étapes 11-15), distinct du méta-workflow de développement ; aucune contradiction introduite, aucune modification nécessaire.
- `docs/orchestration/ORCHESTRATOR_V1_SAFETY_RULES.md` — mêmes raisons (sections 15-18) ; les règles de sécurité du futur produit (staging explicite, interdiction de `git add .`/`git add -A`, approbations séparées commit/push) restent inchangées et cohérentes avec le nouveau méta-workflow.
- `docs/CONVENTIONS.md` — la convention générale sur les messages de commit (petits, ciblés, clairs) reste valable telle quelle et n'entre pas en contradiction avec la nouvelle règle ; aucun ajout jugé nécessaire.

## 3. Règles d'autorisation du commit local automatique

Le commit local automatique n'est autorisé que si les 13 conditions suivantes sont **toutes** réunies :

1. auto-review Claude Code explicitement réussie ;
2. aucun défaut non résolu ;
3. aucune correction supplémentaire nécessaire ;
4. toutes les validations ciblées vertes ;
5. `git diff --check` réussi ;
6. liste exacte des fichiers de la sous-phase connue ;
7. tous les fichiers modifiés dans le périmètre autorisé ;
8. aucun fichier sensible détecté ;
9. aucune modification préexistante non liée présente ;
10. aucun conflit, merge, rebase ou état Git ambigu en cours ;
11. rapport de sous-phase créé ;
12. message de commit défini dans le prompt de la sous-phase ;
13. aucune décision humaine en attente.

Procédure Git obligatoire avant commit : `git status --short`, `git diff --check`, `git diff --stat`, `git diff`, puis comparaison de la liste réelle des fichiers modifiés avec la liste des fichiers autorisés du prompt de sous-phase. Après staging : `git diff --cached --check`, `git diff --cached --stat`, `git status --short`, avec vérification que seuls les fichiers de la sous-phase sont indexés.

## 4. Conditions d'arrêt

Arrêt immédiat, sans ajout ni commit, si :

- fichier hors périmètre ;
- fichier sensible (`.env`, certificat, clé, secret) ;
- `git diff --check` en échec ;
- une validation en échec ;
- auto-review non entièrement réussie ;
- correction restant nécessaire ;
- modification antérieure non liée présente ;
- liste exacte des fichiers ambiguë ;
- dépôt en état de merge, rebase, cherry-pick ou conflit ;
- branche ou HEAD ayant changé de manière inattendue ;
- rapport final incohérent avec le diff réel.

## 5. Commandes interdites

Interdites à Claude Code dans ce workflow (staging, commit, push) :

```text
git add .
git add -A
git commit -a
git commit --amend
git reset --hard
git clean -fd
git push
git push --force
git push --force-with-lease
```

## 6. Format exigé pour les futurs prompts de sous-phase

Chaque prompt de sous-phase (`workflow/prompts/ORCH_X.Y.Z_PROMPT.md`) doit désormais contenir :

```text
Fichiers autorisés pour le commit :
- liste exacte des chemins

Message de commit :
- message exact

Commit local automatique :
- autorisé uniquement si auto-review réussie et validations vertes

Push :
- strictement interdit
```

ainsi qu'une précision explicite : toute anomalie détectée entraîne un arrêt humain, sans commit.

## 7. Confirmation du push manuel

Le push (`git push`, `git push --force`, `git push --force-with-lease`) reste, sans aucune exception, une action strictement manuelle exécutée uniquement par l'utilisateur, après vérification du commit local — y compris lorsque le commit automatique a réussi. Aucune règle introduite par cette intervention ne permet à Claude Code de pousser, directement ou indirectement (aucun alias, aucun script intermédiaire, aucune commande composée).

## 8. Auto-review effectuée

1. Diff complet relu (`git diff --stat` : un seul fichier modifié, `ORCHESTRATOR_V1_ROADMAP.md`, 158 insertions / 3 suppressions — correspondant exactement à la section étendue ; un seul fichier nouveau dans le périmètre).
2. Vérifié : aucune règle ajoutée ne permet un push automatique — la sous-section dédiée l'interdit explicitement et sans exception.
3. Vérifié : le commit automatique reste strictement conditionnel aux 13 critères listés, chacun devant être vérifié avant tout `git add`.
4. Vérifié : `git add .` et `git add -A` sont explicitement listés parmi les commandes interdites, avec renvoi vers un staging par liste exacte de chemins.
5. Vérifié : la présence d'un fichier hors périmètre figure explicitement dans les conditions d'arrêt avant staging.
6. Vérifié : les validations ciblées et l'auto-review réussie sont des conditions numérotées 1 et 4 parmi les 13 prérequis du commit.
7. Vérifié : le push manuel reste documenté comme le dernier contrôle humain, distinct et postérieur au commit local.
8. Aucun défaut certain trouvé lors de cette relecture ; aucune correction nécessaire.
9. Aucun fichier applicatif, test, migration, repository, IPC, preload, renderer, dépendance ou `package.json` modifié.

## 9. Résultats des validations

**`git diff --check`** :

```text
exit code 0
```

(avertissement de fin de ligne CRLF/LF affiché par Git sur `ORCHESTRATOR_V1_ROADMAP.md` — normalisation d'affichage Windows habituelle, sans rapport avec un problème de contenu, `git diff --check` restant en succès.)

**`git status --short --untracked-files=all`** :

```text
 M docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md
?? workflow/prompts/ORCH_WORKFLOW_AUTOCOMMIT_PROMPT.md
```

(Le présent rapport n'apparaît pas encore dans cette capture, prise avant sa création.)

**`git diff --stat`** :

```text
docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md | 161 +++++++++++++++++++++++++-
1 file changed, 158 insertions(+), 3 deletions(-)
```

## 10. Décision explicite : aucun commit automatique pour cette intervention

Conformément à l'instruction reçue (« Ne pas exécuter de commit automatique pour cette intervention documentaire, sauf si le prompt actuel contient déjà une liste exacte de fichiers et un message de commit explicitement autorisé par l'utilisateur »), **aucun commit n'a été créé** pour cette intervention : la liste de fichiers et le message de commit présents dans `ORCH_WORKFLOW_AUTOCOMMIT_PROMPT.md` ont été rédigés par Claude Code lui-même dans le cadre de cette même intervention, et non explicitement fournis/autorisés au préalable par l'utilisateur — la condition d'exception n'est donc pas réunie au sens strict. Cette première application du nouveau workflow reste donc soumise à vérification et décision manuelles, comme les sous-phases précédentes.

- Aucun `git add`, `git commit` ou `git push` n'a été exécuté à aucun moment de cette intervention.
- Le dépôt reste dans l'état observé en section 9, prêt pour une vérification humaine puis, si approuvé, un commit (automatique dès la prochaine sous-phase, sous réserve des 13 conditions) et un push manuel séparé.
