# Registre des opportunités d'automatisation

Ce registre recense les opérations répétitives identifiées au fil du projet, susceptibles d'être automatisées. **Aucune de ces automatisations n'est implémentée à ce stade** : ce document est un espace d'observation et de décision, pas une spécification technique.

## Structure d'une entrée

Chaque opportunité identifiée doit préciser :

- **Opération** — l'action répétitive observée.
- **Contexte** — dans quelle situation cette opération survient.
- **Fréquence** — à quelle fréquence cette opération est réalisée.
- **Valeur potentielle** — le bénéfice attendu d'une automatisation.
- **Risque** — les risques associés à l'automatisation de cette opération.
- **Prérequis** — ce qui doit exister avant de pouvoir envisager cette automatisation.
- **Décision** — automatiser, ne pas automatiser, ou reporter la décision.
- **Statut** — proposé, accepté, refusé, implémenté.

## Exemples initiaux

### Génération d'un rapport de validation

- **Contexte** : à la fin d'une tâche, un récapitulatif des validations effectuées (typecheck, tests, build, validation manuelle) doit être produit.
- **Fréquence** : à chaque tâche clôturée.
- **Valeur potentielle** : gain de temps et cohérence du format des rapports.
- **Risque** : faible, tant que le rapport reste une aide et non une preuve automatique de validation.
- **Prérequis** : modèle de données des tâches et des commandes de validation en place.
- **Décision** : à évaluer après la phase 4 de la [roadmap](ROADMAP.md).
- **Statut** : proposé.

### Export Markdown d'une tâche

- **Contexte** : besoin ponctuel de partager le détail d'une tâche (prompt, critères, checklist) en dehors de l'application.
- **Fréquence** : occasionnelle.
- **Valeur potentielle** : facilite le partage et l'archivage.
- **Risque** : faible.
- **Prérequis** : modèle de données des tâches finalisé, export Markdown du projet disponible (phase 7).
- **Décision** : à évaluer.
- **Statut** : proposé.

### Création d'une checklist depuis un modèle

- **Contexte** : certaines checklists reviennent d'un projet à l'autre (ex. checklist de validation d'un thème Shopify).
- **Fréquence** : à chaque nouvelle tâche similaire.
- **Valeur potentielle** : gain de temps, réduction des oublis.
- **Risque** : moyen — un modèle mal maintenu peut propager des erreurs.
- **Prérequis** : mécanisme de modèles de checklist à concevoir.
- **Décision** : à évaluer après la phase 4.
- **Statut** : proposé.

### Détection des tâches bloquées

- **Contexte** : une tâche peut rester longtemps sans progression sans que cela soit visible.
- **Fréquence** : continue.
- **Valeur potentielle** : meilleure visibilité sur les blocages, via le tableau de bord.
- **Risque** : faible, si la détection reste indicative et ne modifie pas automatiquement le statut des tâches.
- **Prérequis** : modèle de statuts et de timestamps finalisé (voir [docs/DATA_MODEL_DRAFT.md](DATA_MODEL_DRAFT.md)).
- **Décision** : à évaluer après la phase 6.
- **Statut** : proposé.

### Proposition d'entrée de journal après changement de statut

- **Contexte** : chaque changement de statut significatif (tâche, phase, projet) pourrait suggérer une entrée de journal pré-remplie.
- **Fréquence** : à chaque changement de statut.
- **Valeur potentielle** : encourage la tenue régulière du [journal du projet](project-journal/) sans en imposer la rédaction complète.
- **Risque** : moyen — risque de journal bruité si la suggestion est acceptée sans relecture.
- **Prérequis** : modèle de données `activity_log` en place (phase 6).
- **Décision** : à évaluer après la phase 6.
- **Statut** : proposé.
