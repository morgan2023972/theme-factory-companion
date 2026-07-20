# Orchestrateur local V1 — Workflow fonctionnel

Statut : documentaire uniquement (ORCH-0.1). Ce document décrit le comportement fonctionnel attendu, sans imposer la modélisation TypeScript définitive (voir ORCH-1.2 — Machine à états).

## 1. Vue d'ensemble

Le cycle complet d'une exécution suit l'enchaînement suivant :

```text
Sélection du projet et de la phase
→ préparation du prompt
→ approbation humaine du prompt
→ création du fichier prompt
→ lancement de Claude Code
→ récupération du rapport
→ analyse ou review
→ corrections éventuelles approuvées
→ validations automatiques
→ validation manuelle
→ préparation du commit
→ autorisation du commit
→ commit
→ autorisation séparée du push
→ push
→ clôture
```

## 2. Structure obligatoire de chaque étape

Pour chaque grande étape du workflow, les éléments suivants doivent être définis :

- responsable principal ;
- entrées ;
- action ;
- sorties ;
- conditions de réussite ;
- conditions d'échec ;
- prochaine transition possible.

## 3. Étapes obligatoires

### Étape 1 — Sélection du projet et de la phase

- Responsable principal : Utilisateur.
- Entrées : projet actif, chemin local du dépôt, phase active, profil de workflow.
- Action : initialisation du contexte de travail pour la phase choisie.
- Sortie : contexte de workflow initialisé.
- Condition de réussite : projet et phase valides, profil chargé.
- Condition d'échec : projet inexistant, chemin invalide, profil manquant.
- Transition possible : Étape 2.

### Étape 2 — Préparation du prompt

- Responsable principal : Modèle orchestrateur.
- Entrées : objectif de phase, périmètre, fichiers autorisés, fichiers interdits, critères d'acceptation, commandes de validation, chemin du rapport attendu.
- Action : assemblage du contenu du prompt de phase.
- Sortie : contenu du prompt prêt à être présenté à l'utilisateur.
- Condition de réussite : prompt complet et cohérent avec le profil.
- Condition d'échec : informations manquantes empêchant la génération.
- Transition possible : Étape 3.

### Étape 3 — Approbation humaine du prompt

- Responsable principal : Utilisateur.
- Entrées : contenu du prompt proposé.
- Action : lecture et décision de l'utilisateur.
- Sorties possibles : approuvé, refusé, modification demandée, workflow annulé.
- Condition de réussite : approbation explicite.
- Condition d'échec : refus ou annulation.
- Transition possible : Étape 4 (si approuvé), retour Étape 2 (si modification demandée), fin (si annulé).

Aucune exécution de Claude Code ne doit être possible sans approbation.

### Étape 4 — Création du fichier prompt

- Responsable principal : Theme Factory Companion.
- Entrées : contenu du prompt approuvé.
- Action : écriture du fichier prompt sur disque.
- Sortie : fichier prompt créé et associé au workflow actif.
- Précisions :
  - chemin attendu défini par convention du profil (par exemple sous `workflow/prompts`) ;
  - convention de nommage explicite incluant l'identifiant de phase ;
  - encodage UTF-8 ;
  - refus d'écrasement silencieux d'un fichier existant ;
  - vérification que le chemin reste dans le dépôt déclaré ;
  - association du fichier créé au workflow actif pour traçabilité.
- Condition de réussite : fichier créé, chemin validé.
- Condition d'échec : chemin hors dépôt, fichier déjà existant sans confirmation.
- Transition possible : Étape 5.

### Étape 5 — Exécution de Claude Code

- Responsable principal : Theme Factory Companion (déclenchement), Claude Code (exécution).
- Entrées : fichier prompt créé, répertoire de travail du dépôt.
- Action : lancement de Claude Code dans le répertoire du projet.
- Précisions :
  - répertoire de travail correspondant strictement au dépôt du projet actif ;
  - commande isolée derrière un adaptateur dédié ;
  - capture de stdout ;
  - capture de stderr ;
  - capture du code de sortie ;
  - horodatage de l'heure de début ;
  - horodatage de l'heure de fin ;
  - gestion d'un timeout ;
  - possibilité d'annulation par l'utilisateur ;
  - interdiction de lancer deux exécutions concurrentes sur le même projet.
- Sortie : résultat brut de l'exécution (stdout, stderr, code de sortie, horodatages).
- Condition de réussite : exécution terminée avec code de sortie exploitable.
- Condition d'échec : timeout, code de sortie d'erreur, exécution concurrente détectée.
- Transition possible : Étape 6.

### Étape 6 — Récupération du rapport

- Responsable principal : Theme Factory Companion.
- Entrées : chemin du rapport attendu (défini à l'Étape 2).
- Action : lecture du fichier de rapport produit par Claude Code.
- Précisions :
  - chemin attendu connu à l'avance ;
  - présence du fichier obligatoire ;
  - contenu non vide obligatoire ;
  - association du rapport au workflow ;
  - conservation du rapport dans l'historique des artefacts ;
  - comportement si le rapport manque : l'étape n'est pas considérée terminée ;
  - comportement si le rapport est vide : le rapport est considéré invalide.
- Sortie : rapport de phase récupéré et archivé.
- Condition de réussite : fichier présent et non vide.
- Condition d'échec : fichier absent ou vide.
- Transition possible : Étape 7 (si réussite), blocage avec possibilité de relance manuelle (si échec).

### Étape 7 — Analyse ou review

- Responsable principal : Modèle orchestrateur ou Utilisateur.
- Entrées : rapport de phase.
- Action : analyse du contenu du rapport au regard des critères d'acceptation.
- Sorties possibles : phase approuvée, phase approuvée avec remarques, corrections requises, validations insuffisantes, rapport incohérent, review humaine nécessaire.
- Condition de réussite : décision explicite rendue.
- Condition d'échec : rapport incompréhensible ou incohérent avec le prompt.
- Transition possible : Étape 9 (si approuvée), Étape 8 (si corrections requises), review humaine (si nécessaire).

### Étape 8 — Corrections éventuelles

- Responsable principal : Modèle orchestrateur (préparation), Utilisateur (approbation).
- Entrées : constats de l'étape 7.
- Action : préparation d'un prompt de correction ciblé.
- Précisions :
  - génération ou préparation d'un prompt de correction ;
  - validation humaine obligatoire avant toute nouvelle exécution ;
  - création du fichier de correction (mêmes règles qu'à l'Étape 4) ;
  - nouvelle exécution de Claude Code (mêmes règles qu'à l'Étape 5) ;
  - nouveau rapport (mêmes règles qu'à l'Étape 6) ;
  - nombre de cycles de correction limité dans la V1 ;
  - aucune boucle autonome illimitée n'est autorisée.
- Sortie : nouveau rapport de correction.
- Condition de réussite : correction validée par l'utilisateur puis exécutée.
- Condition d'échec : refus de l'utilisateur, ou nombre maximal de cycles atteint.
- Transition possible : retour Étape 7.

### Étape 9 — Validations automatiques

- Responsable principal : Theme Factory Companion.
- Entrées : profil de workflow (liste de commandes de validation).
- Action : exécution des commandes de validation définies par le profil.
- Précisions : le premier profil Electron/TypeScript pourra exécuter par exemple :

```text
npm run typecheck
npm run test
npm run build
git diff --check
git status --short
```

  - les commandes proviennent du profil, elles ne sont pas codées en dur dans le moteur ;
  - une commande bloquante en échec arrête la progression du workflow ;
  - toutes les sorties des commandes sont conservées dans l'historique.
- Sortie : rapport de validation automatique.
- Condition de réussite : toutes les commandes bloquantes réussissent.
- Condition d'échec : une commande bloquante échoue.
- Transition possible : Étape 10 (si réussite), retour Étape 8 ou blocage (si échec).

### Étape 10 — Validation manuelle

- Responsable principal : Utilisateur.
- Entrées : résultat des validations automatiques, application en cours d'exécution le cas échéant.
- Action : vérification manuelle du comportement réel.
- Exemples de critères : l'application démarre correctement, aucune erreur n'apparaît dans la console, le comportement demandé fonctionne, la persistance est vérifiée lorsque nécessaire, aucune régression visible n'est constatée.
- Sortie : validation manuelle explicite (accord ou refus).
- Condition de réussite : accord explicite de l'utilisateur.
- Condition d'échec : refus ou constat de régression.
- Transition possible : Étape 11 (si accord), retour Étape 8 (si refus).

### Étape 11 — Préparation du commit

- Responsable principal : Theme Factory Companion.
- Entrées : état du dépôt après validation manuelle.
- Action : inspection du dépôt et proposition de commit.
- Précisions : inspections réalisées :

```text
git status --short
git diff --stat
git diff --check
```

  Le workflow doit afficher :
  - la branche courante ;
  - la liste exacte des fichiers modifiés ;
  - la liste exacte des fichiers proposés pour le commit ;
  - les éventuels fichiers hors périmètre ;
  - une proposition de message de commit.
- Sortie : proposition de commit prête à être approuvée.
- Condition de réussite : proposition cohérente avec le périmètre approuvé.
- Condition d'échec : fichiers hors périmètre détectés sans explication.
- Transition possible : Étape 12.

### Étape 12 — Autorisation du commit

- Responsable principal : Utilisateur.
- Entrées : proposition de commit.
- Sorties possibles : autorisé, refusé, modification demandée, workflow interrompu.
- Condition de réussite : autorisation explicite.
- Condition d'échec : refus ou interruption.
- Transition possible : Étape 13 (si autorisé), retour Étape 11 (si modification demandée), fin (si interrompu).

### Étape 13 — Commit

- Responsable principal : Theme Factory Companion (exécution technique), sous autorisation de l'utilisateur.
- Entrées : liste de fichiers approuvée, message de commit approuvé.
- Action : exécution du commit Git.
- Précisions :
  - aucun `git add .` aveugle ;
  - ajout explicite des fichiers listés et approuvés ;
  - message de commit conforme à celui approuvé ;
  - hash du commit enregistré dans l'historique ;
  - aucun push automatique déclenché.
- Sortie : commit créé, hash enregistré.
- Condition de réussite : commit créé avec succès.
- Condition d'échec : erreur Git lors du commit.
- Transition possible : Étape 14.

### Étape 14 — Autorisation du push

- Responsable principal : Utilisateur.
- Entrées : commit créé, branche courante, remote cible.
- Précisions :
  - approbation séparée et distincte de celle du commit ;
  - branche affichée avant décision ;
  - remote affiché avant décision ;
  - commit affiché avant décision ;
  - refus possible à tout moment.
- Sortie : décision explicite (autorisé ou refusé).
- Condition de réussite : autorisation explicite.
- Condition d'échec : refus.
- Transition possible : Étape 15 (si autorisé), clôture en état commité non poussé (si refusé).

### Étape 15 — Push

- Responsable principal : Theme Factory Companion (exécution technique), sous autorisation de l'utilisateur.
- Entrées : autorisation de push.
- Action : exécution du push Git.
- Précisions :
  - aucun `--force` ;
  - aucun changement automatique de branche ;
  - aucun tag automatique ;
  - enregistrement du résultat du push dans l'historique ;
  - clôture du workflow uniquement après connaissance du résultat réel du push.
- Sortie : résultat du push enregistré.
- Condition de réussite : push accepté par le remote.
- Condition d'échec : push rejeté ou erreur réseau.
- Transition possible : clôture du workflow.

## 4. Cas d'échec et de reprise

### Prompt refusé

Le workflow reste en attente de modification ou peut être annulé par l'utilisateur.

### Claude Code en échec

Sont conservés :

- le code de sortie ;
- le stdout ;
- le stderr ;
- l'étape concernée ;
- la possibilité d'une relance manuelle.

### Rapport absent

L'étape n'est pas considérée terminée.

### Rapport vide

Le rapport est considéré invalide.

### Validation technique en échec

Le passage à la validation de commit est interdit tant que l'échec n'est pas résolu.

### Correction nécessaire

Une nouvelle approbation humaine est exigée avant toute relance de Claude Code.

### Fermeture de l'application

Le workflow doit être repris depuis le dernier état persistant connu.

### Commande interrompue lors de la fermeture

Il ne faut jamais supposer automatiquement qu'une commande interrompue a réussi. L'état réel doit être vérifié avant de proposer une reprise.

### Commit refusé

Aucune commande de commit ne doit être exécutée.

### Push refusé

Le workflow peut rester dans un état commité mais non poussé, sans que cela soit considéré comme un échec du workflow.

### Annulation

L'historique est conservé et le workflow est marqué comme annulé.

## 5. États fonctionnels indicatifs

Les états suivants sont indicatifs et décrivent le comportement fonctionnel attendu, sans figer le futur modèle TypeScript (voir ORCH-1.2) :

- brouillon ;
- prompt prêt ;
- en attente d'approbation ;
- implémentation en cours ;
- implémentation terminée ;
- rapport disponible ;
- review nécessaire ;
- corrections nécessaires ;
- validations en cours ;
- validation échouée ;
- validation manuelle requise ;
- prêt à committer ;
- commité ;
- prêt à pousser ;
- terminé ;
- annulé ;
- échoué.

## 6. Règles de reprise

- Le workflow peut reprendre après un redémarrage de l'application, à partir du dernier état persistant connu.
- Une commande échouée peut être relancée manuellement par l'utilisateur.
- Il est impossible de reprendre automatiquement une commande encore considérée comme active au moment de la fermeture : son état réel doit d'abord être vérifié.
- L'état réel du dépôt Git doit être vérifié avant toute reprise.
- L'existence et le contenu des fichiers générés doivent être vérifiés avant toute reprise.
- Aucune transition d'état n'est effectuée implicitement à la réouverture de l'application.
