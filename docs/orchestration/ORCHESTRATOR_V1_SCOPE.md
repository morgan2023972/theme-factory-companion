# Orchestrateur local V1 — Spécification de périmètre

Statut : documentaire uniquement (ORCH-0.1). Aucun code applicatif n'est concerné par ce document.

## 1. Finalité

L'orchestrateur est un module interne de Theme Factory Companion. Il n'est pas une application indépendante.

- Il sera d'abord développé comme un moteur interne, sans interface graphique dédiée.
- Il pourra être piloté (via scripts, CLI interne ou tests) avant la création d'une interface complexe.
- Il sera ensuite exposé progressivement dans l'interface Electron existante de Theme Factory Companion, au fil des phases ultérieures de la roadmap.

## 2. Problème traité

Le workflow actuel de développement assisté par IA repose sur une série d'opérations manuelles répétitives :

- création du fichier prompt ;
- copie du prompt depuis ChatGPT ;
- collage du prompt dans VS Code ou Claude Code ;
- exécution de Claude Code ;
- génération du rapport ;
- récupération du rapport ;
- copie du rapport vers ChatGPT ;
- préparation du prompt de review ;
- création du fichier de review ;
- préparation d'un éventuel prompt de correction ;
- exécution des validations ;
- inspection Git ;
- préparation du commit ;
- préparation du push.

Chacune de ces étapes est aujourd'hui effectuée manuellement, avec un risque d'erreur, de perte de contexte et de copier-coller fastidieux entre plusieurs outils (ChatGPT, VS Code, Claude Code, terminal Git).

## 3. Objectifs de la V1

La V1 doit progressivement permettre :

- de sélectionner un projet ;
- de sélectionner une phase ;
- de charger le profil du projet ;
- de préparer un prompt ;
- de présenter le prompt à l'utilisateur ;
- de faire approuver ce prompt ;
- de créer automatiquement le fichier correspondant ;
- de lancer Claude Code dans le bon dépôt ;
- de capturer le résultat de son exécution ;
- de récupérer le rapport attendu ;
- d'analyser ou de faire analyser le rapport ;
- de préparer une éventuelle review ;
- de préparer d'éventuelles corrections ;
- d'exécuter des validations configurées ;
- de conserver les résultats ;
- de reprendre le workflow après redémarrage ;
- de bloquer les actions sensibles sans approbation ;
- de préparer un commit contrôlé ;
- d'exiger une approbation séparée pour le push.

## 4. Utilisateur cible

La V1 est :

- locale ;
- mono-utilisateur ;
- destinée initialement au développeur de Theme Factory Companion ;
- utilisée en combinaison avec VS Code, Claude Code, Git et un modèle orchestrateur ;
- conçue initialement pour un projet Electron et TypeScript (Theme Factory Companion lui-même).

## 5. Périmètre inclus

La V1 inclut au minimum :

- un projet actif à la fois ;
- un workflow actif par projet ;
- un premier profil Electron/TypeScript ;
- des artefacts Markdown (prompts, rapports, reviews) ;
- des validations automatiques configurables (via le profil) ;
- des validations manuelles ;
- une persistance locale (SQLite) ;
- un historique des étapes ;
- un historique des commandes exécutées ;
- un historique des approbations humaines ;
- une reprise après redémarrage de l'application ;
- une architecture extensible vers un futur profil Shopify.

## 6. Hors périmètre

Sont explicitement exclus de la V1 :

- la collaboration multi-utilisateur ;
- la synchronisation cloud ;
- les fonctionnalités SaaS ;
- les agents parallèles ;
- les exécutions concurrentes sur le même projet ;
- la boucle de correction autonome illimitée ;
- le force push ;
- la gestion avancée des branches (rebase, merge complexe, etc.) ;
- la création automatique de pull requests ;
- la création automatique de tags ;
- l'analyse visuelle Shopify ;
- la compréhension automatique de tout dépôt arbitraire ;
- la publication automatique (npm publish, déploiement, etc.) ;
- le stockage de secrets en base de données ;
- la gestion complète d'un workflow Shopify dans la V1.

## 7. Contraintes techniques et architecturales

Ces contraintes s'appliquent aux futures phases d'implémentation et doivent guider toute décision de conception :

- SQLite est utilisé uniquement dans le main process ;
- aucun accès direct à Node depuis le renderer ;
- aucun accès direct à Electron depuis le renderer ;
- aucun accès direct à SQLite depuis le renderer ;
- aucun accès direct à Git depuis le renderer ;
- aucun lancement direct de Claude Code depuis le renderer ;
- les canaux IPC utilisés doivent être explicitement autorisés ;
- toute entrée doit être validée avec Zod ;
- les changements de code doivent rester petits et testables ;
- aucune erreur TypeScript ne doit être masquée ;
- aucun test en échec ne doit être masqué ;
- les validations humaines sont obligatoires aux points sensibles ;
- aucune action Git ne doit être implicite ;
- aucun écrasement silencieux de fichier n'est autorisé ;
- les chemins de fichiers manipulés doivent rester limités au dépôt déclaré du projet.

## 8. Rôles et responsabilités

### Utilisateur

Responsable de :

- choisir le projet ;
- choisir la phase ;
- valider le prompt ;
- valider les corrections ;
- effectuer la validation manuelle ;
- autoriser le commit ;
- autoriser le push ;
- refuser une action ;
- interrompre ou annuler le workflow.

### Modèle orchestrateur

Responsable à terme de :

- proposer le plan ;
- structurer les phases ;
- générer ou préparer les prompts ;
- définir les critères d'acceptation ;
- analyser les rapports ;
- préparer les prompts de review ;
- préparer les prompts de correction ;
- synthétiser les résultats.

### Claude Code

Responsable de :

- lire le dépôt ;
- respecter le périmètre du prompt ;
- modifier uniquement les fichiers autorisés ;
- exécuter les commandes demandées ;
- produire les rapports demandés ;
- appliquer uniquement les corrections autorisées.

### Theme Factory Companion

Responsable de :

- piloter les étapes du workflow ;
- stocker l'état du workflow ;
- gérer les artefacts (prompts, rapports, reviews) ;
- lancer les commandes depuis le main process ;
- capturer les sorties des commandes ;
- appliquer les règles de sécurité ;
- afficher les résultats à l'utilisateur ;
- demander les approbations humaines nécessaires.

### Git

Utilisé uniquement pour :

- inspecter l'état du dépôt ;
- inspecter les différences ;
- préparer une liste explicite de fichiers ;
- créer un commit après approbation humaine ;
- pousser après une approbation humaine séparée.

## 9. Artefacts produits

L'orchestrateur produit et conserve au minimum les artefacts suivants :

- prompt de phase ;
- rapport de phase ;
- prompt de review ;
- rapport de review ;
- prompt de correction ;
- rapport de correction ;
- rapport de validation ;
- journal des commandes ;
- journal des approbations ;
- hash de commit éventuel ;
- résultat du push éventuel.

## 10. Definition of Done de la V1

La V1 est considérée terminée lorsque :

- l'utilisateur peut sélectionner un projet et une phase ;
- le prompt peut être préparé puis approuvé ;
- le fichier prompt est créé automatiquement ;
- Claude Code est lancé dans le bon dépôt ;
- ses sorties sont capturées ;
- le rapport attendu est récupéré ;
- les validations techniques sont exécutées et historisées ;
- le workflow peut reprendre après redémarrage ;
- les étapes sensibles sont bloquées sans approbation ;
- le commit est exécuté uniquement après validation humaine ;
- le push exige une approbation séparée ;
- toute l'activité est traçable ;
- aucun secret n'est stocké en base ;
- aucune action Git dangereuse n'est implicite.
