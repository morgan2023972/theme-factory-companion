# Cycle de développement

Ce document précise le cycle de travail obligatoire pour toute évolution technique de Theme Factory Companion, ainsi que les responsabilités de chaque intervenant. Ce cycle reprend et détaille les étapes déjà résumées dans [CONTRIBUTING.md](../CONTRIBUTING.md).

## Cycle obligatoire

```text
Plan
→ prompt Claude Code
→ implémentation limitée
→ typecheck
→ tests
→ build
→ validation manuelle
→ correction
→ commit Git
```

### 1. Plan

Clarifier l'objectif de l'étape, son périmètre exact, et ce qui en est explicitement exclu.

### 2. Prompt Claude Code

Rédiger un prompt précis, dérivé directement du plan, qui délimite clairement ce que Claude Code doit implémenter — et rien de plus.

### 3. Implémentation limitée

Claude Code implémente strictement ce qui est demandé par le prompt, sans élargir le périmètre ni anticiper des besoins futurs.

### 4. Typecheck

Vérification de la cohérence des types sur l'ensemble du code modifié.

### 5. Tests

Exécution des tests concernés par le changement.

### 6. Build

Vérification que le projet se construit correctement.

### 7. Validation manuelle

Vérification humaine du comportement obtenu, au-delà de ce que les tests automatisés peuvent couvrir.

### 8. Correction

Correction des problèmes identifiés lors des étapes précédentes, avant de considérer l'étape comme terminée.

### 9. Commit Git

Enregistrement du changement validé, avec un message clair et ciblé (voir [docs/CONVENTIONS.md](CONVENTIONS.md)).

## Responsabilités

### ChatGPT

- Aide à la réflexion, au cadrage et à la structuration du travail.
- Formulation des plans et des prompts destinés à Claude Code.
- Arbitrage des choix de conception avant implémentation.

### Claude Code

- Implémentation strictement limitée au prompt fourni.
- Exécution des étapes techniques du cycle (typecheck, tests, build) lorsque cela est demandé.
- Signalement de toute ambiguïté ou de tout écart nécessaire par rapport au prompt initial, sans élargir le périmètre de sa propre initiative.

### Utilisateur

- Validation manuelle du résultat produit.
- Décision finale sur les corrections à apporter.
- Décision et exécution des commits Git.
- Arbitrage final sur les décisions structurantes, consignées dans [docs/decisions/](decisions/).
