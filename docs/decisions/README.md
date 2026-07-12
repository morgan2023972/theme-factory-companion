# Registre des décisions

Ce registre conserve la trace des décisions structurantes prises au cours du projet Theme Factory Companion : choix d'architecture, de modèle de données, de conventions, ou tout autre arbitrage difficile à revenir en arrière.

## Fonctionnement

- Chaque décision fait l'objet d'un fichier Markdown distinct dans ce dossier, nommé selon le format `AAAA-MM-JJ-titre-court.md` (ex. `2026-07-12-choix-electron.md`).
- Chaque fichier suit le [modèle de décision](DECISION_TEMPLATE.md).
- Une décision documentée n'est pas figée : elle peut être révisée par une décision ultérieure, qui doit alors référencer la décision qu'elle remplace.
- Toute décision structurante doit être consignée avant d'être considérée comme actée (voir [CONTRIBUTING.md](../../CONTRIBUTING.md)).

## Quand créer une entrée

Une entrée doit être créée pour toute décision qui :

- engage l'architecture ou le modèle de données du projet ;
- écarte une alternative sérieuse envisagée ;
- serait coûteuse à revenir en arrière ;
- pourrait sembler arbitraire ou peu évidente relue plus tard sans contexte.

Les choix mineurs, réversibles et sans impact durable ne nécessitent pas d'entrée dédiée.
