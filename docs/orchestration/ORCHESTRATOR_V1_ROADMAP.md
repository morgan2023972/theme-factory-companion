# Orchestrateur local V1 — Roadmap technique détaillée

Statut global : développement en cours.

État validé au moment de cette mise à jour :

- ORCH-0.1 — Spécification fonctionnelle : terminée
- ORCH-0.2 — Règles de sécurité : terminée
- ORCH-1.1 — Schémas partagés : terminée, commitée et poussée
- ORCH-1.2 — Machine à états : terminée, corrigée, commitée et poussée
- ORCH-2.1 — Migration SQLite : terminée, corrigée, commitée et poussée
- ORCH-2.2 — Repositories : terminée, reviewée, corrigée, commitée et poussée
- Prochaine sous-phase : ORCH-3.1.1 — Contrat exact du profil Electron/TypeScript

Cette roadmap conserve le périmètre fonctionnel initial de l’orchestrateur local V1, mais détaille désormais les prochaines phases en sous-phases techniques plus petites afin de :

- limiter la taille des implémentations ;
- réduire les décisions implicites prises pendant le développement ;
- améliorer la qualité des prompts Claude Code ;
- utiliser des validations ciblées pendant les petites sous-phases ;
- réserver les reviews complètes aux blocs présentant un risque élevé ;
- réduire les cycles de corrections et les allers-retours ;
- faciliter des commits plus fréquents et plus lisibles.

## Workflow de développement applicable à l’orchestrateur

Pour chaque sous-phase :

1. cadrage technique préalable dans la conversation ;
2. rédaction d’un prompt Claude Code précis (voir « Format exigé pour les prompts de sous-phase » ci-dessous) ;
3. implémentation limitée ;
4. tests ciblés et typecheck ;
5. auto-review Claude Code ;
6. correction immédiate des défauts certains et non ambigus ;
7. rapport consolidé de sous-phase ;
8. review ici ;
9. corrections séparées uniquement si nécessaires ;
10. validation finale du bloc ;
11. **commit local automatique par Claude Code**, uniquement si toutes les conditions d’autorisation ci-dessous sont réunies ;
12. **push strictement manuel**, exécuté uniquement par l’utilisateur, jamais par Claude Code.

Claude Code doit s’arrêter et demander une décision humaine lorsqu’il rencontre :

- un choix architectural non défini ;
- une contradiction documentaire ;
- un besoin d’élargir le périmètre ;
- une modification de migration déjà validée ;
- une modification d’API publique ;
- un ajout de dépendance ;
- une règle métier ambiguë ;
- une action destructive ;
- un problème de sécurité ;
- une action Git sensible non autorisée ;
- une anomalie quelconque détectée pendant la procédure de commit local automatique décrite ci-dessous.

Pour une petite sous-phase, les validations minimales sont :

```powershell
npm run typecheck
npx vitest run <tests-ciblés> --maxWorkers=1
git diff --check
```

À la fin d’un bloc fonctionnel :

```powershell
npm run typecheck
npx vitest run --maxWorkers=1
npm run build
git diff --check
git status --short --untracked-files=all
```

### Commit local automatique après une sous-phase réussie

Depuis ORCH-WORKFLOW-AUTOCOMMIT, Claude Code est autorisé à créer le **commit local** d’une sous-phase de façon automatique, sans validation humaine intermédiaire pour cette seule action. Le **push reste strictement manuel** en toutes circonstances (voir plus bas) : cette règle ne modifie en rien les règles de sécurité de l'orchestrateur lui-même (`ORCHESTRATOR_V1_SAFETY_RULES.md`, sections 15 à 18), qui continuent de s'appliquer telles quelles au futur moteur applicatif ; elle ne concerne que le processus de développement de l'orchestrateur mené dans ce dépôt.

#### Conditions d’autorisation du commit local automatique

Le commit local automatique n’est autorisé que si **toutes** les conditions suivantes sont réunies :

1. l’auto-review Claude Code est explicitement réussie ;
2. aucun défaut non résolu n’est présent ;
3. aucune correction supplémentaire n’est nécessaire ;
4. toutes les validations ciblées exigées par la sous-phase sont vertes ;
5. `git diff --check` réussit ;
6. la liste exacte des fichiers de la sous-phase est connue ;
7. tous les fichiers modifiés appartiennent au périmètre autorisé ;
8. aucun fichier sensible n’est détecté (voir `ORCHESTRATOR_V1_SAFETY_RULES.md`, section 13) ;
9. aucune modification préexistante non liée n’est présente ;
10. aucun conflit, merge, rebase ou état Git ambigu n’est en cours ;
11. le rapport de sous-phase a été créé ;
12. le message de commit est défini dans le prompt de la sous-phase ;
13. aucune décision humaine n’est en attente.

Si une seule de ces conditions n’est pas réunie, Claude Code s’arrête sans ajouter ni committer, et rend compte du blocage plutôt que de committer un état partiel.

#### Procédure Git obligatoire avant commit

Claude Code doit exécuter, dans cet ordre :

```powershell
git status --short
git diff --check
git diff --stat
git diff
```

puis comparer la liste réelle des fichiers modifiés avec la liste des « Fichiers autorisés pour le commit » définie dans le prompt de la sous-phase.

#### Conditions d’arrêt avant staging

Claude Code doit arrêter immédiatement, sans ajouter ni committer, si :

- un fichier hors périmètre apparaît ;
- un fichier sensible apparaît ;
- un fichier `.env`, certificat, clé ou secret apparaît ;
- `git diff --check` échoue ;
- une validation échoue ;
- l’auto-review n’est pas entièrement réussie ;
- une correction reste nécessaire ;
- une modification antérieure non liée est présente ;
- la liste exacte des fichiers à committer est ambiguë ;
- le dépôt est en état de merge, rebase, cherry-pick ou conflit ;
- la branche ou HEAD a changé de manière inattendue ;
- le rapport final ne correspond pas au diff réel.

#### Règles de staging

Si toutes les conditions précédentes sont satisfaites :

- ajouter uniquement les fichiers explicitement autorisés et réellement modifiés ;
- utiliser une liste exacte de chemins (`git add <chemin1> <chemin2> ...`) ;
- ne jamais utiliser `git add .` ;
- ne jamais utiliser `git add -A` ;
- ne jamais utiliser `git commit -a` ;
- ne jamais ajouter un fichier non mentionné dans le prompt de sous-phase.

Après staging, exécuter :

```powershell
git diff --cached --check
git diff --cached --stat
git status --short
```

puis vérifier que :

- tous les fichiers indexés appartiennent à la sous-phase ;
- aucun autre fichier n’est indexé ;
- aucun fichier attendu n’a été oublié ;
- le diff indexé est cohérent avec le rapport de sous-phase.

#### Exécution du commit local automatique

Si et seulement si toutes les vérifications précédentes sont réussies :

- créer le commit avec le message exact défini dans le prompt de la sous-phase (ne jamais improviser un autre message) ;
- ne jamais amender un commit existant (`git commit --amend` interdit) ;
- ne jamais modifier l’historique ;
- ne jamais pousser.

Après le commit, exécuter :

```powershell
git status --short
git log -1 --oneline
git show --stat --oneline HEAD
```

Le rapport de sous-phase doit indiquer :

- le hash court du commit ;
- le message du commit ;
- les fichiers inclus ;
- le résultat de `git status` après commit ;
- la confirmation explicite qu’aucun push n’a été exécuté.

#### Push strictement interdit à Claude Code

Claude Code ne doit jamais exécuter :

```text
git push
git push --force
git push --force-with-lease
```

Le push reste toujours manuel et séparé, effectué uniquement par l’utilisateur après vérification du commit local — sans exception, y compris lorsque le commit automatique a réussi.

#### Commandes Git interdites dans ce workflow

Sont explicitement interdites à Claude Code dans le cadre de ce workflow, en plus des commandes déjà listées comme interdites par `ORCHESTRATOR_V1_SAFETY_RULES.md` (section 8) :

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

### Format exigé pour les prompts de sous-phase

Depuis ORCH-WORKFLOW-AUTOCOMMIT, chaque prompt de sous-phase (`workflow/prompts/ORCH_X.Y.Z_PROMPT.md`) doit contenir une section explicite au format suivant :

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

Le prompt doit également préciser explicitement que toute anomalie détectée (défaut non résolu, fichier hors périmètre, validation en échec, ambiguïté quelconque) entraîne un arrêt humain, sans commit.

---

# Bloc 0 — Documentation et sécurité

## ORCH-0.1 — Spécification fonctionnelle

Statut : TERMINÉE.

- Objectif : fixer le périmètre fonctionnel, les rôles, le workflow complet et les critères de fin de la V1.
- Livrables principaux :
  - `docs/orchestration/ORCHESTRATOR_V1_SCOPE.md`
  - `docs/orchestration/ORCHESTRATOR_V1_WORKFLOW.md`
  - `docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md`
- Validation : cohérence documentaire et absence de modification applicative.

## ORCH-0.2 — Règles de sécurité

Statut : TERMINÉE.

- Objectif : documenter les limites de chemins, les actions Git interdites, la gestion des secrets, les timeouts, les annulations et la concurrence.
- Livrable principal :
  - `docs/orchestration/ORCHESTRATOR_V1_SAFETY_RULES.md`
- Validation : cohérence avec ORCH-0.1.

---

# Bloc 1 — Domaine partagé

## ORCH-1.1 — Schémas partagés

Statut : TERMINÉE, COMMITÉE ET POUSSÉE.

- Objectif : définir les schémas Zod et types partagés de l’orchestrateur.
- Entités :
  - `WorkflowRun`
  - `WorkflowStep`
  - `WorkflowArtifact`
  - `WorkflowApproval`
  - `CommandExecution`
  - `WorkflowProfile`
- Validation : typecheck, tests, build.

## ORCH-1.2 — Machine à états

Statut : TERMINÉE, CORRIGÉE, COMMITÉE ET POUSSÉE.

- Objectif : implémenter les transitions autorisées du workflow.
- Validation :
  - transitions valides ;
  - transitions interdites ;
  - absence d’I/O ;
  - cohérence avec ORCH-1.1 et les documents fonctionnels.

---

# Bloc 2 — Persistance SQLite

## ORCH-2.1 — Migration SQLite

Statut : TERMINÉE, CORRIGÉE, COMMITÉE ET POUSSÉE.

- Objectif : persister les entités de l’orchestrateur.
- Tables :
  - `workflow_profiles`
  - `workflow_profile_validation_commands`
  - `workflow_runs`
  - `workflow_steps`
  - `workflow_artifacts`
  - `workflow_approvals`
  - `command_executions`
- Validation :
  - migration idempotente ;
  - intégrité relationnelle ;
  - contraintes CHECK ;
  - réouverture réelle de la base ;
  - reprise après redémarrage.

## ORCH-2.2 — Repositories

Statut : TERMINÉE, REVIEWÉE, CORRIGÉE, COMMITÉE ET POUSSÉE.

- Objectif : fournir les repositories SQLite de l’orchestrateur.
- Repositories :
  - profils ;
  - runs ;
  - steps ;
  - artefacts ;
  - approbations ;
  - exécutions de commandes.
- Garanties :
  - requêtes préparées ;
  - intégration de la machine à états ;
  - contrôle d’appartenance de `currentStepId` ;
  - timestamps déterministes ;
  - tests de reprise après redémarrage via les repositories ;
  - aucune logique IPC, interface ou command runner.

Reports connus vers des phases ultérieures :

- décision métier sur le statut admissible de `currentStepId` ;
- finders de reprise de haut niveau ;
- filtrage des secrets avant persistance des sorties ;
- amélioration du diagnostic des colonnes JSON corrompues.

---

# Bloc 3 — Profils et services de fichiers

## ORCH-3.1 — Profil de workflow Electron/TypeScript

Statut : À DÉVELOPPER.

### ORCH-3.1.1 — Contrat exact du profil

Objectif :

- finaliser le format métier du premier profil Electron/TypeScript ;
- définir précisément les champs obligatoires ;
- définir la représentation des commandes et arguments ;
- définir les règles de chemins ;
- définir les paramètres de timeout et de blocage ;
- définir les conventions de validation manuelle et d’artefacts.

Décisions à fixer avant implémentation :

- identité et version du profil ;
- structure de `validationCommands` ;
- politique sur les propriétés inconnues ;
- chemins relatifs autorisés ;
- valeurs obligatoires et valeurs explicitement interdites ;
- absence de valeur implicite dangereuse.

Tests attendus :

- profil minimal valide ;
- profil complet valide ;
- nom ou commande vide refusé ;
- argument invalide refusé ;
- chemins absolus ou hors dépôt refusés lorsqu’applicables ;
- propriétés inconnues selon la politique retenue.

### ORCH-3.1.2 — Chargeur de profil

Objectif :

- lire un fichier JSON en UTF-8 ;
- parser le JSON ;
- valider avec Zod ;
- produire des erreurs explicites.

Cas limites :

- fichier absent ;
- fichier vide ;
- JSON invalide ;
- profil invalide ;
- encodage non attendu ;
- contenu non conforme au contrat.

### ORCH-3.1.3 — Empreinte stable du profil

Objectif :

- produire une représentation canonique ;
- calculer un fingerprint stable ;
- garantir qu’un même profil produit la même empreinte ;
- garantir qu’un changement significatif modifie l’empreinte.

Responsabilités reportées :

- aucune persistance du run ;
- aucune validation du dépôt ;
- aucune exécution de commande.

### ORCH-3.1.4 — Profil réel du projet

Objectif :

- créer `workflow/config/project.workflow.json` ;
- définir les commandes :
  - typecheck ;
  - tests ;
  - build ;
  - `git diff --check` ;
  - `git status --short` ;
- définir la checklist manuelle ;
- définir les conventions de prompts et rapports.

### ORCH-3.1.V — Validation intégrée du profil

Objectif :

- charger le vrai profil ;
- valider sa structure ;
- calculer son fingerprint ;
- vérifier sa cohérence avec les documents du workflow ;
- exécuter la suite complète et le build.

Review complète : non obligatoire si les sous-phases sont limitées et que l’auto-review est concluante.

---

## ORCH-3.2 — Services de fichiers

Statut : À DÉVELOPPER.

### ORCH-3.2.1 — Résolution sécurisée des chemins

Objectif :

- canonicaliser le chemin du dépôt ;
- résoudre un chemin relatif ;
- garantir que la cible reste dans le dépôt ;
- refuser les traversées ;
- prendre en charge les chemins Windows.

Tests attendus :

- chemin valide ;
- `../` ;
- chemin absolu ;
- répertoire au préfixe similaire ;
- séparateurs Windows ;
- symlinks selon la politique retenue.

### ORCH-3.2.2 — Service des prompts

Objectif :

- calculer le nom d’un prompt ;
- écrire en UTF-8 ;
- refuser l’écrasement silencieux ;
- lire le contenu ;
- détecter un fichier absent ou vide.

### ORCH-3.2.3 — Service des rapports

Objectif :

- calculer le chemin du rapport attendu ;
- lire un rapport ;
- détecter un rapport absent ;
- détecter un rapport vide ;
- distinguer rapport d’implémentation, review et corrections.

### ORCH-3.2.4 — Persistance des artefacts

Objectif :

- enregistrer les prompts et rapports dans `workflow_artifacts` ;
- stocker uniquement leur chemin relatif ;
- les rattacher au run et éventuellement au step ;
- éviter toute duplication de l’écriture physique du fichier.

### ORCH-3.2.V — Validation intégrée des fichiers

Objectif :

- utiliser un dépôt temporaire réel ;
- tester écritures et lectures ;
- refuser les chemins externes ;
- refuser l’écrasement ;
- persister les artefacts ;
- vérifier la reprise après réouverture.

Review complète : OBLIGATOIRE, en raison des enjeux de sécurité des chemins et d’écriture de fichiers.

---

# Bloc 4 — Exécution locale et Claude Code

## ORCH-4.1 — Command runner

Statut : À DÉVELOPPER.

### ORCH-4.1.1 — Exécution minimale sécurisée

Objectif :

- utiliser `spawn` ;
- utiliser `shell: false` ;
- séparer l’exécutable et les arguments ;
- imposer un répertoire de travail validé ;
- récupérer le code de sortie.

Hors périmètre :

- timeout ;
- annulation ;
- persistance ;
- verrouillage ;
- filtrage des secrets.

### ORCH-4.1.2 — Capture et limitation des sorties

Objectif :

- capturer stdout et stderr ;
- gérer l’encodage ;
- limiter la mémoire consommée ;
- indiquer la troncature.

### ORCH-4.1.3 — Filtrage des secrets

Objectif :

- masquer les motifs de secrets connus ;
- traiter stdout et stderr avant persistance ;
- fermer explicitement le report ORCH-2.2 sur les sorties sensibles.

### ORCH-4.1.4 — Timeout

Objectif :

- timeout configurable ;
- arrêt contrôlé du processus ;
- statut `timed_out` ;
- conservation des sorties disponibles ;
- nettoyage des timers.

### ORCH-4.1.5 — Annulation

Objectif :

- annuler une commande en cours ;
- distinguer annulation et timeout ;
- garantir une résolution unique ;
- gérer un processus déjà terminé.

### ORCH-4.1.6 — Verrouillage des exécutions

Objectif :

- empêcher deux commandes incompatibles pour le même projet ;
- garantir la libération du verrou ;
- définir le comportement après redémarrage.

Décision préalable obligatoire :

- verrou uniquement en mémoire ;
- ou verrou appuyé par l’état persistant.

### ORCH-4.1.7 — Historisation

Objectif :

- créer `CommandExecution` avant lancement ;
- passer à `running` ;
- persister le résultat final ;
- gérer l’erreur de lancement ;
- ne jamais laisser silencieusement une commande incohérente.

### ORCH-4.1.V — Validation intégrée du runner

Scénarios :

- succès ;
- exit code non nul ;
- exécutable absent ;
- stdout important ;
- stderr important ;
- secret filtré ;
- timeout ;
- annulation ;
- double lancement ;
- persistance après réouverture.

Review complète : OBLIGATOIRE.

---

## ORCH-4.2 — Adaptateur Claude Code

Statut : À DÉVELOPPER.

### ORCH-4.2.1 — Interface générique d’agent de code

Objectif :

- définir une interface indépendante de Claude Code ;
- définir les entrées ;
- définir les types d’intervention ;
- définir un résultat structuré.

Types d’intervention :

- implémentation ;
- review ;
- corrections.

### ORCH-4.2.2 — Détection de Claude Code

Objectif :

- vérifier la disponibilité de la commande ;
- distinguer absence, mauvaise configuration et erreur d’exécution ;
- empêcher le lancement si l’outil est indisponible.

### ORCH-4.2.3 — Exécution d’implémentation

Objectif :

- transmettre un prompt ;
- lancer Claude Code dans le bon dépôt ;
- récupérer le résultat ;
- vérifier le rapport attendu.

### ORCH-4.2.4 — Exécution de review

Objectif :

- utiliser un prompt distinct ;
- interdire explicitement toute modification ;
- récupérer un verdict ou rapport stable.

### ORCH-4.2.5 — Exécution de corrections

Objectif :

- transmettre uniquement les corrections approuvées ;
- produire un rapport distinct ;
- interdire les boucles autonomes illimitées.

### ORCH-4.2.V — Validation intégrée de l’adaptateur

Objectif :

- utiliser un faux exécutable ou une fixture contrôlée ;
- ne pas rendre toute la suite Vitest dépendante de la présence réelle de Claude Code.

Review complète : OBLIGATOIRE.

---

# Bloc 5 — Validations et approbations

## ORCH-5.1 — Validation runner

Statut : À DÉVELOPPER.

### ORCH-5.1.1 — Modèle des résultats

Définir :

- résultat par commande ;
- caractère bloquant ;
- avertissement ;
- commande non exécutée ;
- résumé global.

### ORCH-5.1.2 — Exécution séquentielle

Objectif :

- respecter l’ordre du profil ;
- lancer les commandes via le command runner ;
- arrêter sur échec bloquant ;
- poursuivre après avertissement.

### ORCH-5.1.3 — Relance ciblée

Objectif :

- relancer les validations sans relancer Claude Code ;
- choisir tout ou partie des commandes ;
- historiser chaque tentative.

### ORCH-5.1.4 — Persistance et reprise

Objectif :

- retrouver les validations déjà exécutées ;
- distinguer résultats anciens et actuels ;
- empêcher qu’une ancienne réussite valide un dépôt modifié.

Décision préalable obligatoire :

- mécanisme de fingerprint ou d’identification de l’état du dépôt validé.

### ORCH-5.1.V — Validation intégrée

Scénarios :

- succès complet ;
- avertissement non bloquant ;
- échec bloquant ;
- commandes suivantes non exécutées ;
- relance ;
- redémarrage ;
- dépôt modifié après validation.

---

## ORCH-5.2 — Approbations humaines

Statut : À DÉVELOPPER.

### ORCH-5.2.1 — Service générique d’approbation

Objectif :

- créer une demande ;
- approuver ;
- refuser ;
- empêcher une seconde décision ;
- enregistrer dates et commentaire selon le modèle retenu.

### ORCH-5.2.2 — Approbation du prompt

Objectif :

- lier l’approbation à un artefact précis ;
- invalider l’approbation si le prompt change ;
- autoriser uniquement la transition correspondante.

### ORCH-5.2.3 — Approbation des corrections

Objectif :

- présenter les corrections proposées ;
- approuver ou refuser ;
- lier la décision à la review concernée.

### ORCH-5.2.4 — Validation manuelle

Objectif :

- enregistrer réussite ou refus ;
- imposer un commentaire en cas de refus ;
- permettre une nouvelle demande après correction.

### ORCH-5.2.5 — Approbation du commit

Objectif :

- lier l’approbation à un état exact du dépôt ;
- invalider l’approbation si le diff change.

### ORCH-5.2.6 — Approbation du push

Objectif :

- créer une approbation distincte ;
- la lier au hash du commit et à la branche ;
- empêcher sa réutilisation après changement.

### ORCH-5.2.7 — Intégration avec la machine à états

Objectif :

- chaque décision autorise une transition précise ;
- aucune approbation ne produit une transition implicite multiple ;
- refus et annulation restent traçables.

### ORCH-5.2.V — Validation intégrée des approbations

Review complète : OBLIGATOIRE.

---

# Bloc 6 — Intégration Electron

## ORCH-6.1 — IPC et preload

Statut : À DÉVELOPPER.

### ORCH-6.1.1 — Contrats partagés

Objectif :

- définir les schémas Zod d’entrée et de sortie ;
- séparer lecture, action, approbation et annulation ;
- éviter tout canal générique.

### ORCH-6.1.2 — Canaux de lecture

Exposer uniquement :

- état du run ;
- étapes ;
- artefacts ;
- commandes ;
- validations ;
- approbations.

### ORCH-6.1.3 — Canaux d’action

Exposer uniquement des actions métier explicites :

- créer un run ;
- lancer l’action autorisée ;
- annuler ;
- approuver ;
- refuser ;
- relancer les validations.

Interdiction :

- aucun canal de type `execute-command`.

### ORCH-6.1.4 — API preload

Objectif :

- surface minimale ;
- aucun type Electron exposé ;
- aucune primitive arbitraire de fichiers, processus, SQLite ou Git.

### ORCH-6.1.5 — Tests d’intégration IPC

Scénarios :

- entrée valide ;
- entrée invalide ;
- erreur métier contrôlée ;
- transition interdite ;
- absence de canal dangereux.

### ORCH-6.1.V — Validation intégrée main/preload

Review complète : OBLIGATOIRE.

---

## ORCH-6.2 — Interface minimale

Statut : À DÉVELOPPER.

### ORCH-6.2.1 — Page et état du workflow

Afficher :

- projet ;
- phase ;
- statut ;
- étape courante ;
- prochaine action ;
- blocage éventuel.

### ORCH-6.2.2 — Prompts et rapports

Objectif :

- afficher le prompt ;
- afficher les rapports ;
- afficher les erreurs d’absence ou d’invalidité ;
- éviter toute édition directe non prévue.

### ORCH-6.2.3 — Validations

Afficher :

- commandes ;
- statuts ;
- sorties filtrées ;
- erreurs ;
- action de relance.

### ORCH-6.2.4 — Approbations

Objectif :

- approuver ;
- refuser ;
- commenter ;
- désactiver les actions non autorisées.

### ORCH-6.2.5 — Historique et reprise

Objectif :

- afficher l’historique ;
- restaurer l’état après redémarrage ;
- signaler une action interrompue.

### ORCH-6.2.6 — Validation manuelle de l’interface

Validation humaine obligatoire :

- navigation ;
- lisibilité ;
- boutons conditionnels ;
- absence d’erreur console ;
- reprise après redémarrage.

---

# Bloc 7 — Git contrôlé

## ORCH-7.1 — Commit Git contrôlé

Statut : À DÉVELOPPER.

### ORCH-7.1.1 — Inspection du dépôt

Collecter :

- branche actuelle ;
- fichiers modifiés ;
- fichiers non suivis ;
- conflits ;
- résultat de `git diff --check` ;
- résultat de `git diff --stat`.

### ORCH-7.1.2 — Détection des fichiers sensibles

Contrôler notamment :

- `.env` ;
- clés ;
- certificats ;
- fichiers hors dépôt ;
- fichiers hors périmètre ;
- gros fichiers inattendus.

### ORCH-7.1.3 — Sélection explicite des fichiers

Objectif :

- produire une liste exacte ;
- interdire `git add .` ;
- refuser un fichier modifié après approbation.

### ORCH-7.1.4 — Proposition du commit

Présenter :

- message ;
- liste des fichiers ;
- diff stat ;
- état du dépôt ;
- empreinte de l’état proposé.

### ORCH-7.1.5 — Exécution

Objectif :

- vérifier l’approbation ;
- ajouter explicitement les fichiers ;
- créer le commit ;
- récupérer le hash ;
- interdire tout push implicite.

### ORCH-7.1.V — Tests Git sur dépôt temporaire

Review complète : OBLIGATOIRE.

---

## ORCH-7.2 — Push Git contrôlé

Statut : À DÉVELOPPER.

### ORCH-7.2.1 — Inspection avant push

Contrôler :

- branche ;
- remote ;
- upstream ;
- commit HEAD ;
- état du dépôt.

### ORCH-7.2.2 — Approbation liée au commit

L’approbation doit devenir invalide si :

- HEAD change ;
- la branche change ;
- le remote change.

### ORCH-7.2.3 — Exécution

Objectif :

- exécuter un push normal uniquement ;
- interdire `--force` ;
- interdire la création automatique de branche ;
- interdire les tags automatiques ;
- historiser le résultat.

### ORCH-7.2.V — Tests avec remote Git local temporaire

Aucun push réel vers GitHub pendant les tests automatiques.

Review complète : OBLIGATOIRE.

---

# Bloc 8 — Validation intégrée et durcissement

## ORCH-8.1 — Test intégré

Statut : À DÉVELOPPER.

### ORCH-8.1.1 — Environnement de test

Créer :

- dépôt temporaire ;
- base SQLite temporaire ;
- profil de test ;
- faux adaptateur Claude Code ;
- remote Git local.

### ORCH-8.1.2 — Parcours nominal jusqu’aux validations

Tester :

- création du run ;
- création du prompt ;
- approbation ;
- exécution simulée ;
- récupération du rapport ;
- validations.

### ORCH-8.1.3 — Parcours Git

Tester :

- validation manuelle simulée ;
- approbation du commit ;
- commit ;
- approbation séparée du push ;
- push vers remote local.

### ORCH-8.1.4 — Scénarios d’échec

Tester :

- prompt absent ;
- rapport absent ;
- rapport vide ;
- commande échouée ;
- timeout ;
- refus d’approbation ;
- dépôt modifié après approbation ;
- commit échoué ;
- push échoué.

### ORCH-8.1.5 — Reprise après redémarrage

Tester plusieurs interruptions :

- avant exécution ;
- pendant une attente d’approbation ;
- après validation ;
- après commit mais avant push.

### ORCH-8.1.V — Test complet de non-régression

Review complète : OBLIGATOIRE.

---

## ORCH-8.2 — Durcissement et documentation

Statut : À DÉVELOPPER.

### ORCH-8.2.1 — Registre des reports techniques

Traiter ou documenter notamment :

- diagnostic de `JSON.parse` reporté en ORCH-2.2 ;
- comportement métier de `currentStepId` ;
- processus interrompus ;
- commandes laissées à l’état `running` ;
- dépôt déplacé ;
- profil modifié ;
- historique incomplet.

### ORCH-8.2.2 — Durcissement des erreurs

Objectif :

- définir des catégories d’erreurs ;
- produire des messages compréhensibles ;
- conserver la cause technique ;
- ne masquer aucun échec ;
- proposer une reprise lorsqu’elle est possible.

### ORCH-8.2.3 — Audit de sécurité

Contrôler :

- chemins ;
- secrets ;
- commandes ;
- approbations ;
- Git ;
- sorties persistées ;
- actions accessibles depuis le renderer.

### ORCH-8.2.4 — Documentation utilisateur

Documenter :

- configuration ;
- lancement ;
- approbations ;
- validations ;
- reprise ;
- commit ;
- push.

### ORCH-8.2.5 — Documentation technique

Documenter :

- architecture ;
- profils ;
- machine à états ;
- persistance ;
- services ;
- sécurité ;
- extension future Shopify.

### ORCH-8.2.6 — Validation finale de la V1

Exécuter :

- typecheck ;
- suite complète ;
- build ;
- parcours manuel ;
- redémarrage ;
- test Git temporaire ;
- revue des limites connues ;
- préparation du backlog post-V1.

Review complète : OBLIGATOIRE.

---

# Extension future

Un profil Shopify complet n’est pas inclus dans la V1.

Il pourra être ajouté comme extension du système de profils introduit en ORCH-3.1, sans modification de l’architecture centrale, à condition que :

- les commandes restent configurables ;
- les conventions de fichiers restent pilotées par le profil ;
- les validations Shopify restent séparées du moteur générique ;
- aucune logique Shopify ne soit codée en dur dans le cœur de l’orchestrateur.

---

# Prochaine action

Préparer le cadrage technique puis le prompt Claude Code de :

**ORCH-3.1.1 — Contrat exact du profil Electron/TypeScript**
