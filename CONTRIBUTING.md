# Contribuer à Theme Factory Companion

Ce document décrit le workflow obligatoire pour toute contribution au projet, dès que le développement technique commencera. Il s'applique également, dans son esprit, à la phase documentaire actuelle.

## Workflow obligatoire

Toute évolution du projet doit suivre les étapes suivantes, dans l'ordre :

1. **Plan** — clarifier l'objectif et le périmètre de la modification avant d'agir.
2. **Prompt Claude Code précis** — rédiger une instruction ciblée, limitée au périmètre défini par le plan.
3. **Implémentation limitée** — n'implémenter que ce qui est strictement nécessaire à l'étape en cours.
4. **Typecheck** — vérifier la cohérence des types avant toute autre validation.
5. **Tests** — exécuter les tests concernés.
6. **Build** — s'assurer que le projet compile et se construit correctement.
7. **Validation manuelle** — vérifier concrètement le comportement obtenu.
8. **Correction** — corriger les problèmes identifiés avant de poursuivre.
9. **Commit Git** — enregistrer le changement une fois validé.

## Règles générales

- **Une phase à la fois.** Ne pas anticiper ou mélanger le travail de plusieurs phases de la [roadmap](docs/ROADMAP.md).
- **Aucun changement hors périmètre.** Chaque contribution doit rester strictement dans le cadre défini par le plan ou la tâche en cours.
- **Changements petits et vérifiables.** Préférer plusieurs modifications courtes et faciles à valider à un changement volumineux et difficile à relire.
- **Ne jamais masquer une erreur TypeScript.** Toute erreur de typage doit être corrigée à la source, jamais contournée.
- **Ne jamais ignorer un test en échec.** Un test rouge doit être compris et corrigé, pas désactivé ou supprimé sans justification.
- **Documenter les décisions importantes.** Toute décision structurante doit être consignée dans [docs/decisions/](docs/decisions/) en suivant le [modèle de décision](docs/decisions/DECISION_TEMPLATE.md).
- **Enregistrer les erreurs IA significatives.** Toute erreur notable produite par un agent IA doit être consignée dans [docs/ai-errors/](docs/ai-errors/) en suivant le [modèle d'erreur IA](docs/ai-errors/AI_ERROR_TEMPLATE.md).
- **Identifier les opérations automatisables.** Toute tâche répétitive identifiée doit être ajoutée au registre [docs/AUTOMATION_OPPORTUNITIES.md](docs/AUTOMATION_OPPORTUNITIES.md).
- **Ne pas mélanger refactoring, fonctionnalité et correction sans justification.** Chaque commit ou changement doit avoir un objectif unique et clairement identifiable, sauf justification explicite documentée.

## Pourquoi ce workflow

Ce cadre vise à garder le développement de Theme Factory Companion prévisible, traçable et facile à réviser, malgré l'usage intensif d'agents IA (ChatGPT, Claude Code) dans le processus de conception et d'implémentation. Voir [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md) pour le détail du cycle et des responsabilités de chaque intervenant.
