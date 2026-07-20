# Orchestrateur local V1 — Règles de sécurité

Statut : documentaire uniquement (ORCH-0.2). Aucun code applicatif n'est concerné par ce document.

Ce document complète `ORCHESTRATOR_V1_SCOPE.md` et `ORCHESTRATOR_V1_WORKFLOW.md`. Il fixe les règles de sécurité que toute implémentation future de l'orchestrateur (ORCH-1.x à ORCH-8.x) devra respecter.

## 1. Principe général

**En cas de doute, ne pas exécuter.**

Toute ambiguïté sur le périmètre d'une commande, la validité d'un chemin, la fraîcheur d'un état ou l'autorisation d'une action doit se résoudre par un blocage et une demande d'approbation humaine, jamais par une exécution optimiste.

## 2. Fail-safe, fail-closed, moindre privilège, refus par défaut

- **Fail-closed** : en cas d'erreur, de doute ou d'état inconnu, le système s'arrête plutôt que de continuer.
- **Fail-safe** : un échec ne doit jamais laisser le dépôt, la base SQLite ou le système de fichiers dans un état pire qu'avant l'action.
- **Moindre privilège** : chaque composant (renderer, preload, main process) n'a accès qu'aux capacités strictement nécessaires à son rôle.
- **Refus par défaut** : toute action, commande ou chemin non explicitement autorisé est refusé. L'autorisation est une liste blanche, jamais une liste noire.

## 3. Frontières de confiance

Les frontières de confiance suivantes sont établies :

- **Utilisateur** : source d'approbation humaine, considérée fiable pour les décisions mais dont les entrées textuelles (chemins, messages) restent validées.
- **Modèles IA** (modèle orchestrateur, Claude Code) : sources non fiables. Leurs propositions (prompts, plans, corrections, analyses de rapport) sont des suggestions soumises à validation, jamais des ordres d'exécution directs.
- **stdout / stderr** : données non fiables, pouvant contenir du texte trompeur, des secrets accidentels ou du contenu formaté pour tromper un parseur. Traitées comme du texte brut, jamais interprétées comme des commandes.
- **Rapports** (fichiers Markdown produits par Claude Code) : déclarations non fiables, jamais des preuves d'exécution (voir section 10).
- **Profil de workflow** : configuration semi-fiable, chargée depuis le disque, validée par schéma avant tout usage (voir section 6).
- **Git** : source d'état fiable une fois interrogé via des commandes de lecture, mais toute action d'écriture Git reste soumise aux règles des sections 15 à 17.
- **SQLite** : store de confiance interne au main process, jamais exposé directement au renderer.
- **Fichiers du dépôt** : la validation du chemin (voir section 4) autorise uniquement l'accès à l'emplacement ; elle ne rend jamais le contenu du fichier fiable. Le contenu reste non fiable tant qu'il n'a pas été validé par le mécanisme adapté à son type (schéma Zod pour une configuration, non-vacuité pour un rapport, etc.).

## 4. Validation des chemins

- Chaque projet déclare explicitement la racine de son dépôt ; toute opération sur fichier se réfère à cette racine déclarée.
- Tout chemin manipulé est résolu en chemin absolu avant toute vérification ou action.
- Tout chemin dont la résolution absolue sort de la racine du dépôt déclaré est rejeté.
- Les séquences `..` sont normalisées avant validation ; un chemin contenant une tentative de remontée hors dépôt est rejeté même après normalisation.
- Les liens symboliques et jonctions sont résolus (chemin réel) avant validation ; un lien pointant hors du dépôt déclaré est rejeté.
- Les chemins réseau (UNC, lecteurs mappés vers une ressource distante) sont refusés par défaut.

## 5. Lecture et écriture de fichiers

- Tous les fichiers texte manipulés par l'orchestrateur (prompts, rapports, reviews) sont lus et écrits en UTF-8.
- L'écrasement d'un prompt existant est interdit en V1, sans exception : jamais de confirmation permettant de réécrire un fichier de prompt déjà présent sur le même chemin. Toute nouvelle version d'un prompt est créée sous un nouveau chemin (nouveau nom de fichier incluant un suffixe de version ou d'itération, par exemple de correction), jamais par réécriture du fichier existant.
- Plus généralement, en dehors du cas des prompts, aucun écrasement silencieux n'est autorisé : l'écriture sur un chemin déjà existant nécessite une confirmation explicite ou une erreur bloquante.
- Un rapport attendu doit être présent et non vide pour que l'étape correspondante soit considérée terminée.
- Après toute écriture, une relecture de vérification confirme que le contenu écrit correspond au contenu attendu (au minimum : présence, non-vacuité, taille cohérente).
- L'écriture atomique (fichier temporaire puis renommage) est utilisée lorsque le système de fichiers le permet, afin d'éviter les fichiers partiellement écrits en cas d'interruption.

## 6. Profil de workflow

- Le profil de workflow est une entrée non fiable au même titre que tout fichier de configuration externe : il doit être validé avant usage.
- Le profil est validé par un schéma Zod avant chargement ; un profil invalide bloque le workflow.
- Seules les **commandes de validation propres au projet** (typecheck, tests, build, et toute autre commande de validation applicative) proviennent du profil validé. Le profil ne peut jamais définir ou modifier les commandes internes de l'orchestrateur lui-même (Git, lancement de Claude Code).
- Les **commandes internes de l'orchestrateur** (commandes Git de lecture/staging/commit/push, lancement de l'adaptateur Claude Code) proviennent exclusivement d'une liste blanche interne fermée, codée et versionnée avec l'orchestrateur, indépendante du profil et non modifiable par celui-ci.
- Aucune commande, qu'elle vienne du profil ou de la liste blanche interne, n'est jamais composée dynamiquement à partir d'une entrée utilisateur libre ou d'une sortie produite par un modèle IA (modèle orchestrateur, Claude Code). Une entrée utilisateur ou une sortie IA peut tout au plus sélectionner une commande déjà définie dans le profil ou la liste blanche ; elle ne peut jamais introduire une commande ou un argument de commande arbitraire.
- Une empreinte (ou version) du profil actif est capturée et conservée au démarrage de chaque workflow.
- Toute modification du profil détectée pendant qu'un workflow est actif (empreinte différente de celle capturée au démarrage) bloque immédiatement la progression du workflow et invalide toutes les approbations humaines déjà données qui reposaient sur ce profil (notamment celles liées aux commandes de validation). Une nouvelle validation du profil, suivie de nouvelles approbations, est requise avant de reprendre.

## 7. Exécution des commandes

- Toute commande est exécutée avec `shell: false` par défaut : pas d'interprétation shell implicite.
- La commande et ses arguments sont fournis sous forme de tableau séparé, jamais sous forme de chaîne concaténée.
- Le répertoire de travail (`cwd`) est toujours explicite et correspond au dépôt validé du projet actif.
- L'environnement transmis au processus enfant est limité au strict nécessaire (pas d'héritage aveugle de variables sensibles).
- stdout, stderr et le code de sortie sont systématiquement capturés et conservés, dans les limites de taille et selon les règles d'affichage définies en section 24.
- Chaque exécution est associée à un identifiant unique, une heure de début, une heure de fin et une durée.
- Chaque exécution est soumise à un timeout configurable.
- Chaque exécution peut être annulée par l'utilisateur.
- Un code de sortie non nul est considéré comme un échec par défaut, sauf exception explicitement documentée dans le profil.
- Le succès d'une commande n'est jamais déduit uniquement du texte affiché dans stdout ; seul le code de sortie (complété par les vérifications d'état réelles, par exemple Git) fait foi.

## 8. Commandes interdites ou restreintes

Les commandes suivantes sont interdites par défaut dans l'orchestrateur, quelle que soit la source de la demande :

- `git push --force`
- `git push -f`
- `git reset --hard`
- `git clean -fd`
- `git clean -fdx`
- `git checkout .`
- `git restore .`
- `git rebase`
- `git merge`
- `git tag`
- `git branch -D`
- `rm -rf`
- `Remove-Item -Recurse -Force`
- `Invoke-Expression`
- toute forme d'élévation de privilèges
- le téléchargement puis l'exécution automatique d'un script distant

Ces commandes restent hors périmètre V1 (voir `ORCHESTRATOR_V1_SCOPE.md`, section Hors périmètre) et ne doivent pas devenir accessibles via un contournement (alias, script intermédiaire, concaténation de commandes autorisées).

## 9. Politique par liste blanche

Les commandes exécutables sont classées en catégories explicitement autorisées :

- **commandes de lecture** (`git status`, `git diff --stat`, `git diff --check`, `git log` en lecture seule) : autorisées sans approbation supplémentaire, dans le cadre du workflow ;
- **commandes de validation** (`npm run typecheck`, `npm run test`, `npm run build`, telles que définies par le profil) : autorisées dans le cadre de l'étape de validation automatique ;
- **commandes d'écriture contrôlées** (création de fichier prompt/rapport, ajout explicite de fichiers à l'index) : autorisées sous conditions (voir sections 5, 16) ;
- **commandes Git sensibles** (commit, push) : autorisées uniquement après approbation humaine explicite et séparée (voir sections 16-18).

Toute commande ne figurant dans aucune de ces catégories est refusée par défaut, y compris si elle semble inoffensive.

## 10. Sécurité relative à Claude Code

- Claude Code n'est lancé que dans un dépôt dont le chemin a été validé (voir section 4).
- Claude Code n'est lancé qu'après approbation humaine explicite du prompt correspondant.
- Une seule exécution de Claude Code est autorisée à la fois par projet ; une tentative de lancement concurrent sur le même projet est refusée.
- Chaque exécution est soumise à un timeout et peut être annulée par l'utilisateur.
- L'état Git du dépôt est contrôlé avant le lancement et après la fin de l'exécution, afin de détecter les fichiers modifiés.
- Les fichiers modifiés hors du périmètre déclaré dans le prompt sont détectés et signalés avant toute progression vers le commit.
- Le rapport produit par Claude Code est considéré comme une déclaration de ce qui a été fait, jamais comme une preuve : seules les vérifications techniques réelles (validations automatiques, inspection Git) font foi.
- Aucune boucle de correction autonome illimitée n'est autorisée (voir `ORCHESTRATOR_V1_WORKFLOW.md`, Étape 8) ; chaque nouveau cycle exige une nouvelle approbation humaine.

## 11. Concurrence et verrouillage

- Un seul workflow actif est autorisé par projet à un instant donné.
- Un verrou logique (au niveau du projet) empêche le démarrage d'une nouvelle exécution de commande tant qu'une exécution est en cours pour ce projet.
- Toute tentative de contournement de ce verrou (deuxième instance, appel concurrent) est rejetée avec une erreur explicite plutôt que mise en file d'attente silencieuse.
- Un verrou retrouvé encore actif après un redémarrage de l'application (crash, fermeture brutale) n'est jamais supprimé silencieusement au démarrage.
- Avant toute libération d'un tel verrou, l'orchestrateur vérifie explicitement : l'absence réelle du processus concerné (Claude Code ou commande) en cours d'exécution, l'état réel du dépôt Git, et l'état réel des artefacts attendus (prompts, rapports) sur le disque.
- La libération du verrou n'intervient qu'après ces vérifications, et reste soumise aux règles de reprise de la section 19 (aucune reprise automatique implicite de l'étape elle-même).

## 12. Timeout, annulation et processus interrompus

- Toute commande longue (validation, Claude Code) est soumise à un timeout. Ce document ne fixe pas de durée numérique (voir section 23) : seul le principe qu'un timeout doit exister et être appliqué est posé ici.
- L'utilisateur peut annuler une exécution en cours.
- L'arrêt d'une commande, qu'il soit déclenché par un timeout ou par une annulation utilisateur, suit une séquence d'arrêt propre : signal d'arrêt propre d'abord, puis délai de grâce laissé au processus pour se terminer, puis arrêt forcé uniquement si le processus ne s'est pas terminé à l'expiration de ce délai.
- Les processus enfants éventuellement lancés par la commande (ou par Claude Code) sont explicitement contrôlés : ils doivent être arrêtés avec le processus parent, sans laisser de processus orphelin actif.
- Les sorties partielles (stdout/stderr déjà produites avant l'arrêt) sont conservées et journalisées, même en cas d'arrêt forcé.
- Après tout arrêt (timeout, annulation, arrêt forcé), l'état réel du dépôt Git est vérifié avant de qualifier l'exécution ou de proposer une suite.
- En cas de timeout ou d'annulation, l'état de l'exécution est marqué explicitement comme interrompu, distinct d'un succès ou d'un échec classique.
- Un processus interrompu par la fermeture de l'application n'est jamais supposé avoir réussi ni échoué automatiquement : son état réel doit être vérifié avant toute reprise (voir section 19).

## 13. Secrets

- Aucun secret (clé API, jeton, mot de passe) n'est stocké dans SQLite, dans les rapports, dans les prompts ou dans les journaux de commandes.
- Les sorties stdout/stderr capturées et journalisées sont filtrées pour masquer les motifs correspondant à des secrets connus (clés API, tokens) avant persistance.
- Avant tout commit, les fichiers suivants sont explicitement exclus par défaut et déclenchent un refus s'ils sont présents dans la liste proposée : `.env`, `.env.local`, `*.pem`, `*.key`, `id_rsa`, `id_ed25519`.

## 14. Journalisation

Chaque étape du workflow journalise au minimum :

- l'identifiant du workflow ;
- l'identifiant de l'étape ;
- la commande logique exécutée (nom fonctionnel, pas nécessairement la ligne de commande brute si elle contient des données sensibles) ;
- les arguments non sensibles ;
- le répertoire de travail (`cwd`) ;
- l'heure de début et de fin ;
- la durée ;
- le code de sortie ;
- le statut (succès, échec, interrompu, annulé) ;
- les sorties (stdout/stderr, filtrées des secrets) ;
- les erreurs rencontrées ;
- les approbations demandées et leur résultat ;
- les transitions d'état effectuées.

## 15. Git — principes généraux

- Toute action Git commence par une inspection préalable de l'état du dépôt (`git status`, `git diff`).
- Aucun changement de branche n'est effectué automatiquement par l'orchestrateur.
- Aucun `rebase`, `merge`, `tag`, `reset --hard`, `clean` ou `stash` n'est déclenché automatiquement.
- Le commit et le push sont soumis à des approbations humaines distinctes et séparées.

## 16. Staging et commit

- `git add .` et `git add -A` sont interdits.
- Seule une liste explicite de fichiers, validée par l'utilisateur, est ajoutée à l'index.
- Avant proposition de commit, les fichiers sensibles (voir section 13) présents dans la liste sont détectés et signalés.
- La préparation du commit s'appuie sur `git status --short`, `git diff --stat` et `git diff --check`.
- Aucun `git commit --amend` n'est exécuté automatiquement ; chaque commit approuvé est un nouveau commit.

## 17. Push

- Avant toute demande d'autorisation de push, la branche courante, le remote cible et le commit à pousser sont affichés à l'utilisateur.
- Aucun `--force` ni `--force-with-lease` n'est utilisé.
- Un état « commité mais non poussé » est un état stable et acceptable : le workflow peut se clôturer dans cet état si le push est refusé.

## 18. Approbations humaines

Les points suivants exigent une approbation humaine explicite avant de se poursuivre :

- le prompt de phase ;
- le prompt de correction ;
- la validation manuelle ;
- le commit ;
- le push.

Chaque approbation :

- est explicite (une action positive de l'utilisateur, jamais déduite d'une absence de refus) ;
- n'est pas réutilisable pour une action ultérieure similaire ;
- est invalidée si le contenu approuvé (prompt, liste de fichiers, message de commit) est modifié de façon significative après approbation, ce qui exige une nouvelle approbation.

## 19. Reprise après interruption

- Aucun processus ou commande n'est repris automatiquement après un redémarrage de l'application.
- L'état réel du dépôt Git, des artefacts attendus (prompts, rapports) et des fichiers sur disque est vérifié avant de proposer une reprise à l'utilisateur.
- La décision de relancer une étape interrompue appartient à l'utilisateur, jamais au système seul.

## 20. Catégories d'erreurs et comportement

Les niveaux de gravité restent :

- **Erreur bloquante** (échec de validation technique, rapport absent ou vide, chemin invalide, commande interdite détectée, exécution concurrente détectée) : arrête la progression du workflow jusqu'à résolution ou décision humaine explicite.
- **Erreur non bloquante mais signalée** (avertissement de lint non bloquant si le profil le configure ainsi, fichier hors périmètre détecté mais explicable) : signalée à l'utilisateur, qui décide de la suite.
- **Erreur d'annulation** (timeout, annulation utilisateur) : traitée comme un état distinct, ne se substitue jamais silencieusement à un succès.

Au-delà de ce niveau de gravité, chaque erreur appartient à l'une des catégories suivantes, correspondant aux domaines où une défaillance peut survenir :

- **chemin** (chemin hors dépôt, lien symbolique invalide, chemin réseau) ;
- **fichier** (écrasement refusé, fichier absent, fichier vide, échec de lecture/écriture) ;
- **profil** (profil invalide, empreinte de profil modifiée pendant un workflow actif) ;
- **commande** (commande hors liste blanche, `shell: true` détecté, syntaxe de composition shell détectée) ;
- **Claude Code** (exécution concurrente refusée, timeout, code de sortie d'erreur, fichiers hors périmètre détectés) ;
- **rapport** (rapport absent, rapport vide, rapport incohérent avec le prompt) ;
- **Git** (échec d'une commande Git, conflit détecté, commande Git interdite demandée) ;
- **persistance** (échec d'écriture ou de lecture SQLite) ;
- **reprise** (verrou actif après redémarrage, état réel introuvable ou incohérent) ;
- **violation de périmètre** (fichier modifié hors du périmètre déclaré par le prompt approuvé).

Pour chaque erreur, quelle que soit sa catégorie, les éléments suivants sont systématiquement définis et conservés :

- un **code d'erreur stable** (identifiant technique constant, indépendant de la formulation du message) ;
- un **type** correspondant à l'une des catégories ci-dessus ;
- un **message utilisateur** clair, sans détail technique sensible ;
- un **détail technique non sensible** destiné au journal (jamais de secret, de jeton ou de contenu de fichier sensible) ;
- l'**étape** du workflow concernée ;
- son **caractère bloquant ou non** ;
- les **actions suivantes autorisées** (par exemple : relance manuelle, modification du prompt, annulation du workflow, aucune action tant que l'utilisateur n'a pas tranché).

## 21. Responsabilités par couche

- **Renderer** : ne détient aucun accès direct à Node, Electron, SQLite ou Git. Toute action passe par l'IPC exposé via le preload.
- **Preload** : expose une API strictement limitée et validée par Zod, sans logique métier ni accès direct aux ressources sensibles.
- **Main process** : seul responsable de l'accès à SQLite, au système de fichiers, à Git et au lancement de commandes (dont Claude Code) ; applique l'ensemble des règles de sécurité de ce document.
- **Shared** : ne contient que des schémas, types et constantes ; aucun accès à une ressource sensible.

## 22. Checklist de validation des futures implémentations

Toute implémentation future d'un module de l'orchestrateur (à partir d'ORCH-1.1) doit être validée au regard de la checklist suivante avant d'être considérée conforme :

- validation des chemins conforme à la section 4 ;
- refus d'écrasement silencieux conforme à la section 5 ;
- `shell: false` respecté pour toute exécution de commande ;
- timeout configuré pour toute commande longue ;
- annulation possible pour toute commande longue ;
- capture systématique des sorties (stdout, stderr, code de sortie) ;
- verrouillage empêchant toute exécution concurrente sur un même projet ;
- absence de tout secret en base, rapport, prompt ou journal ;
- respect strict de la politique de liste blanche (section 9) ;
- approbations humaines correctement déclenchées aux points requis (section 18) ;
- staging explicite (jamais `git add .` ni `git add -A`) ;
- reprise conforme aux règles de la section 19 (aucune reprise automatique implicite) ;
- présence de tests unitaires pour la logique introduite ;
- présence de tests d'intégration lorsque pertinent ;
- `npm run typecheck` en succès ;
- `npm run test` en succès ;
- `npm run build` en succès.

## 23. Décisions volontairement non fixées à ce stade

Les valeurs suivantes ne sont pas fixées par ce document et devront être décidées lors de phases ultérieures (au plus tard ORCH-1.2 pour les règles de transition, ORCH-4.1/4.2 pour les paramètres d'exécution) :

- la durée exacte des timeouts (Claude Code, commandes de validation) et le délai de grâce exact avant arrêt forcé (section 12) ;
- les limites de taille exactes pour les fichiers d'artefacts (prompts, rapports) et pour la capture de stdout/stderr (section 24) ;
- le nombre maximal exact de cycles de correction autorisés par phase.

Ce document fixe uniquement le principe que ces valeurs doivent exister et être appliquées, pas leur valeur numérique.

## 24. Sorties volumineuses et affichage

- stdout et stderr sont soumis à une taille maximale configurable au-delà de laquelle la capture est tronquée ; ce document ne fixe pas la valeur numérique de cette taille (voir section 23), seulement le principe qu'une telle limite doit exister.
- Toute troncature de sortie est explicite : la sortie tronquée porte un indicateur visible signalant qu'elle a été coupée, jamais une troncature silencieuse laissant croire à une sortie complète.
- Avant tout affichage (interface, journal consultable), les sorties stdout/stderr sont échappées de façon adaptée au contexte d'affichage, afin d'éviter toute injection dans l'interface.
- Les sorties stdout/stderr ne sont jamais interprétées ni rendues comme du HTML : elles sont toujours traitées et affichées comme du texte brut.
