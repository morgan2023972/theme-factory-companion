# Rapport de corrections — ORCH-0.1

## 1. Résumé

Deux corrections documentaires mineures ont été appliquées à `docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md` pour clôturer ORCH-0.1 :

1. la sous-phase ORCH-1.1 a été reformulée pour désigner explicitement les entités propres au moteur d'orchestration, sans les confondre avec les entités métier `Project` et `Phase` déjà existantes dans Theme Factory Companion ;
2. `npm run build` a été ajouté aux validations principales des 11 sous-phases applicatives qui ne le mentionnaient pas encore, afin d'harmoniser la roadmap avec le workflow obligatoire `typecheck → tests → build`.

## 2. Fichiers modifiés ou créés

```text
docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md
workflow/reports/RAPPORT_CORRECTIONS_ORCH_0.1.md
```

## 3. Correction ORCH-1.1

La nouvelle définition d'ORCH-1.1 désigne explicitement les six entités propres au moteur d'orchestration, dans `src/shared/orchestration` :

- `WorkflowRun` ;
- `WorkflowStep` ;
- `WorkflowArtifact` ;
- `WorkflowApproval` ;
- `CommandExecution` ;
- `WorkflowProfile`.

Les entités métier `Project` et `Phase`, déjà existantes dans Theme Factory Companion, ne sont plus présentées comme de nouvelles entités à créer dans ORCH-1.1. Les principaux livrables ont été reformulés en conséquence : « schémas Zod des entités d'orchestration, types TypeScript dérivés et tests unitaires de validation ».

## 4. Harmonisation des validations

`npm run build` a été ajouté aux validations principales des 11 sous-phases suivantes :

- ORCH-1.1 ;
- ORCH-1.2 ;
- ORCH-2.2 ;
- ORCH-3.2 ;
- ORCH-4.1 ;
- ORCH-4.2 ;
- ORCH-5.1 ;
- ORCH-5.2 ;
- ORCH-6.1 ;
- ORCH-7.1 ;
- ORCH-7.2.

Les validations des sous-phases ORCH-0.1, ORCH-0.2, ORCH-2.1, ORCH-3.1, ORCH-6.2, ORCH-8.1 et ORCH-8.2 n'ont pas été modifiées, conformément à la demande (formulations documentaires ou spécifiques déjà adaptées).

## 5. Confirmation du périmètre

- Aucun autre document n'a été modifié (`ORCHESTRATOR_V1_SCOPE.md`, `ORCHESTRATOR_V1_WORKFLOW.md` et `RAPPORT_ORCH_0.1.md` sont restés inchangés).
- Aucun fichier applicatif n'a été modifié.
- Aucune migration n'a été modifiée.
- Aucune dépendance n'a été installée.
- Aucune commande npm de validation (`typecheck`, `test`, `build`) n'a été réellement exécutée pendant cette correction.
- Aucun commit n'a été exécuté.
- Aucun push n'a été exécuté.

## 6. Vérifications Git

```powershell
git diff --check
```

Aucune sortie retournée : aucune erreur détectée.

```powershell
git status --short --untracked-files=all
```

```text
?? docs/orchestration/ORCHESTRATOR_V1_ROADMAP.md
?? docs/orchestration/ORCHESTRATOR_V1_SCOPE.md
?? docs/orchestration/ORCHESTRATOR_V1_WORKFLOW.md
?? workflow/reports/RAPPORT_CORRECTIONS_ORCH_0.1.md
?? workflow/reports/RAPPORT_ORCH_0.1.md
```

Les cinq fichiers de la phase ORCH-0.1 existent bien sur le disque et sont tous non suivis par Git au moment de cette vérification.
