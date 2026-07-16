# PHASE 3.6 — IPC ET API PRELOAD DES PHASES

## Contexte

Le projet **Theme Factory Companion** est une application desktop locale développée avec :

* Electron ;
* React ;
* TypeScript ;
* electron-vite ;
* SQLite ;
* better-sqlite3 ;
* Zod ;
* Vitest.

L’architecture impose une séparation stricte entre :

* `src/main` ;
* `src/preload` ;
* `src/renderer` ;
* `src/shared`.

SQLite et les repositories doivent rester exclusivement dans le processus principal Electron.

Le renderer ne doit jamais importer directement :

* Electron ;
* Node.js ;
* better-sqlite3 ;
* les repositories ;
* la connexion SQLite.

Toutes les opérations accessibles au renderer doivent passer par une API preload limitée et des canaux IPC explicitement autorisés.

## État actuel

Les phases suivantes sont terminées et validées :

* Phase 3.1 — Schémas Zod et types partagés pour les projets ;
* Phase 3.2 — Repository `projects` ;
* Phase 3.3 — IPC et API preload des projets ;
* Phase 3.4 — Interface CRUD des projets ;
* Phase 3.5 — Schémas et repository des phases.

La Phase 3.5 a notamment ajouté ou modifié les éléments suivants :

* `src/shared/schemas/phase.ts` ;
* `src/shared/schemas/phase.test.ts` ;
* `src/main/database/repositories/phasesRepository.ts` ;
* `src/main/database/repositories/phasesRepository.test.ts` ;
* les éventuelles adaptations des schémas et du repository des projets.

Le repository des phases et les schémas Zod existants constituent la source de vérité.

## Objectif

Implémenter la communication IPC et l’API preload permettant au renderer d’utiliser les opérations autorisées sur les phases.

À la fin de cette phase, le renderer devra pouvoir accéder à une API similaire à :

```ts
window.themeFactoryApi.phases
```

Cette API doit exposer uniquement les opérations déjà prises en charge par le repository des phases.

La Phase 3.6 ne doit créer aucune interface utilisateur de gestion des phases.

L’interface CRUD des phases sera réalisée séparément pendant la Phase 3.7.

---

# 1. Inspection obligatoire avant modification

Avant de modifier le code, inspecter précisément :

* `src/shared/schemas/phase.ts` ;
* `src/shared/schemas/project.ts` ;
* `src/shared/contracts/ipcChannels.ts` ;
* `src/shared/contracts/themeFactoryApi.ts` ;
* `src/main/database/repositories/phasesRepository.ts` ;
* `src/main/database/repositories/projectsRepository.ts` ;
* `src/main/ipc/registerProjectsHandlers.ts` ;
* les tests associés aux handlers des projets ;
* `src/main/index.ts` ;
* `src/preload/index.ts` ;
* les tests du preload ;
* la configuration Vitest existante.

Identifier les conventions déjà utilisées pendant la Phase 3.3 pour :

* la déclaration des canaux IPC ;
* l’injection des repositories dans les handlers ;
* la validation Zod ;
* la gestion des erreurs ;
* l’enregistrement des handlers ;
* l’exposition de l’API preload ;
* les tests unitaires ;
* les tests d’intégration.

Réutiliser ces conventions au lieu de créer une deuxième architecture.

Ne pas modifier les signatures existantes des schémas ou du repository des phases sans nécessité démontrée.

---

# 2. Canaux IPC des phases

Étendre le contrat centralisé des canaux IPC existant.

Ajouter des canaux explicites pour les opérations réellement disponibles dans `phasesRepository`.

Les opérations attendues sont probablement proches de :

* liste des phases d’un projet ;
* lecture d’une phase par identifiant, uniquement si cette opération existe déjà dans le repository ;
* création d’une phase ;
* modification d’une phase ;
* suppression d’une phase.

Utiliser les noms exacts et les signatures du repository existant.

Exemple indicatif de structure :

```ts
phases: {
  listByProject: 'phases:listByProject',
  getById: 'phases:getById',
  create: 'phases:create',
  update: 'phases:update',
  remove: 'phases:remove',
}
```

Cet exemple n’est pas une obligation de nommage.

Respecter la structure et les conventions déjà utilisées pour les projets.

Ne pas utiliser de chaînes de canaux IPC dispersées directement dans plusieurs fichiers.

Tous les canaux doivent provenir du contrat central partagé.

---

# 3. Handlers IPC côté main

Créer un module dédié, probablement :

```text
src/main/ipc/registerPhasesHandlers.ts
```

Le nom exact doit rester cohérent avec `registerProjectsHandlers.ts`.

Le module doit enregistrer uniquement les handlers nécessaires aux opérations supportées.

## Exigences

Chaque handler doit :

1. recevoir uniquement les arguments nécessaires ;
2. valider toutes les entrées externes avec les schémas Zod partagés ;
3. utiliser le repository des phases injecté ou fourni selon la convention existante ;
4. retourner directement une donnée sérialisable ;
5. ne jamais exposer un objet SQLite, une requête préparée ou une instance de repository ;
6. ne jamais faire confiance aux données provenant du renderer ;
7. conserver les erreurs utiles sans masquer les erreurs de programmation.

## Validation des identifiants

Les identifiants reçus depuis le renderer doivent être validés.

Cela concerne notamment :

* `projectId` ;
* `phaseId` ;
* les identifiants présents dans les données de création ou de modification.

Réutiliser les schémas existants lorsque possible.

S’il n’existe pas encore de schéma partagé adapté à un identifiant UUID, utiliser une validation Zod locale minimale et cohérente avec la Phase 3.3.

Ne pas introduire une abstraction générique importante uniquement pour cette phase.

## Création

Le handler de création doit :

* valider le payload avec le schéma de création existant ;
* appeler la méthode de création du repository ;
* retourner la phase créée.

Ne pas générer l’UUID ou les timestamps dans le handler si cette responsabilité appartient déjà au repository.

## Modification

Le handler de modification doit :

* valider l’identifiant de la phase ;
* valider le payload avec le schéma de mise à jour existant ;
* respecter la distinction entre données absentes et valeurs explicitement fournies ;
* appeler la méthode de mise à jour du repository ;
* retourner le résultat réel du repository.

Ne pas transformer arbitrairement une mise à jour partielle en remplacement complet.

## Suppression

Le handler de suppression doit :

* valider l’identifiant ;
* appeler la méthode de suppression du repository ;
* retourner le résultat défini par le repository.

Ne pas modifier silencieusement le format de retour existant.

## Liste par projet

Le handler de liste doit :

* valider `projectId` ;
* appeler la méthode de liste par projet ;
* conserver l’ordre défini par le repository, notamment l’ordre basé sur la position si celui-ci existe.

Ne pas refaire le tri dans le renderer ou dans le handler si le repository garantit déjà cet ordre.

---

# 4. Enregistrement des handlers

Intégrer les handlers des phases dans le cycle de démarrage du processus principal.

Modifier le point d’entrée principal uniquement lorsque nécessaire, probablement :

```text
src/main/index.ts
```

Respecter l’ordre d’initialisation déjà en place :

1. ouverture de la base ;
2. migrations ;
3. health check ;
4. création ou récupération des repositories ;
5. enregistrement des handlers IPC ;
6. création de la fenêtre.

Ne pas ouvrir une seconde connexion SQLite.

Ne pas créer une seconde instance indépendante de base de données si l’application utilise déjà une connexion partagée.

Éviter les doubles enregistrements de handlers.

---

# 5. Contrat partagé de l’API

Étendre le contrat TypeScript partagé existant, probablement :

```text
src/shared/contracts/themeFactoryApi.ts
```

Ajouter une section `phases`.

Le contrat doit être construit à partir des types déjà exportés par :

```text
src/shared/schemas/phase.ts
```

Ne pas dupliquer manuellement des interfaces équivalentes aux types Zod déjà disponibles.

L’API doit refléter précisément les opérations réellement exposées.

Exemple indicatif :

```ts
export interface ThemeFactoryApi {
  projects: {
    // API existante
  };

  phases: {
    listByProject(projectId: string): Promise<Phase[]>;
    getById(id: string): Promise<Phase | null>;
    create(input: CreatePhaseInput): Promise<Phase>;
    update(id: string, input: UpdatePhaseInput): Promise<Phase | null>;
    remove(id: string): Promise<boolean>;
  };
}
```

Adapter cet exemple aux signatures réelles du repository.

Ne pas ajouter `getById` si cette opération n’existe pas et n’est pas requise par l’architecture actuelle.

Ne pas élargir artificiellement le périmètre du repository pendant cette phase.

---

# 6. API preload

Étendre l’objet exposé avec `contextBridge`.

L’API accessible dans le renderer doit devenir cohérente avec :

```ts
window.themeFactoryApi.phases
```

Chaque méthode preload doit appeler `ipcRenderer.invoke` avec un canal provenant du contrat partagé centralisé.

Exemple indicatif :

```ts
phases: {
  listByProject: (projectId) =>
    ipcRenderer.invoke(ipcChannels.phases.listByProject, projectId),

  create: (input) =>
    ipcRenderer.invoke(ipcChannels.phases.create, input),

  update: (id, input) =>
    ipcRenderer.invoke(ipcChannels.phases.update, id, input),

  remove: (id) =>
    ipcRenderer.invoke(ipcChannels.phases.remove, id),
}
```

Adapter les arguments aux conventions déjà utilisées pour les projets.

## Contraintes de sécurité

Le preload ne doit exposer :

* ni `ipcRenderer` ;
* ni une fonction générique `invoke` ;
* ni un accès arbitraire à un canal ;
* ni Electron ;
* ni Node.js ;
* ni SQLite.

Seules les méthodes explicitement autorisées doivent être exposées.

---

# 7. Typage global du renderer

Vérifier comment `window.themeFactoryApi` est actuellement typé.

Mettre à jour le typage existant si nécessaire afin que TypeScript reconnaisse :

```ts
window.themeFactoryApi.phases
```

Ne pas créer plusieurs déclarations globales contradictoires.

Réutiliser le contrat partagé `ThemeFactoryApi`.

Le renderer doit pouvoir utiliser l’API sans cast manuel vers `any`.

L’utilisation de `any`, `unknown as`, `@ts-ignore` ou `@ts-expect-error` pour contourner le typage est interdite, sauf justification technique exceptionnelle et documentée.

---

# 8. Tests des handlers IPC

Créer les tests unitaires nécessaires, probablement :

```text
src/main/ipc/registerPhasesHandlers.test.ts
```

Réutiliser la stratégie appliquée à `registerProjectsHandlers.test.ts`.

Les tests doivent vérifier au minimum :

## Enregistrement

* chaque canal attendu est enregistré ;
* aucune chaîne de canal arbitraire n’est utilisée ;
* le repository injecté est appelé par le bon handler.

## Liste par projet

* un `projectId` valide appelle le repository ;
* un identifiant invalide est rejeté ;
* le résultat du repository est retourné sans transformation incorrecte.

## Création

* un payload valide appelle le repository avec des données validées ;
* un payload invalide est rejeté ;
* le repository n’est pas appelé lorsque la validation échoue ;
* la phase créée est retournée.

## Modification

* un identifiant valide et un payload valide appellent le repository ;
* un identifiant invalide est rejeté ;
* un payload invalide est rejeté ;
* le repository n’est pas appelé après un échec de validation ;
* les mises à jour partielles restent partielles.

## Suppression

* un identifiant valide appelle le repository ;
* un identifiant invalide est rejeté ;
* le résultat du repository est retourné.

## Lecture par identifiant

Tester cette opération uniquement si elle est réellement exposée.

Les tests ne doivent pas dépendre d’un ordre fragile d’enregistrement, sauf si cet ordre fait partie du contrat.

---

# 9. Tests d’intégration IPC et SQLite

Créer ou compléter un test d’intégration si la stratégie de la Phase 3.3 en possède déjà un, probablement :

```text
src/main/ipc/registerPhasesHandlers.integration.test.ts
```

Le test d’intégration doit utiliser :

* une base SQLite temporaire ou en mémoire selon les conventions existantes ;
* les migrations réelles ;
* le vrai repository des projets ;
* le vrai repository des phases ;
* les handlers IPC capturés ou invoqués avec le mécanisme de test déjà établi.

Le scénario doit couvrir au minimum :

1. créer un projet parent ;
2. créer une phase via le handler IPC ;
3. lister les phases du projet via le handler IPC ;
4. modifier la phase via le handler IPC ;
5. vérifier la persistance réelle ;
6. supprimer la phase via le handler IPC ;
7. vérifier qu’elle n’apparaît plus dans la liste.

Lorsque le modèle impose plusieurs phases ou des positions, ajouter un scénario vérifiant que l’ordre retourné reste conforme au repository.

Ne pas tester Electron graphiquement dans Vitest.

Ne pas démarrer une vraie fenêtre Electron dans les tests.

---

# 10. Tests du preload

Mettre à jour les tests existants du preload.

Vérifier au minimum que :

* `themeFactoryApi.phases` est exposé ;
* chaque méthode utilise le bon canal IPC ;
* chaque méthode transmet les bons arguments ;
* aucune fonction générique permettant d’appeler un canal arbitraire n’est exposée ;
* l’API existante des projets continue à fonctionner.

Les tests doivent couvrir les opérations réellement ajoutées.

Ne pas supprimer ou affaiblir les tests du preload des projets.

---

# 11. Non-régression

La Phase 3.6 ne doit pas casser :

* le CRUD des projets ;
* la sélection du projet actif ;
* les schémas Zod des projets ;
* le repository des projets ;
* les migrations SQLite ;
* le health check ;
* le démarrage Electron ;
* l’API preload existante ;
* les tests précédemment validés.

Toutes les fonctionnalités des phases précédentes doivent continuer à fonctionner.

---

# 12. Périmètre interdit

Ne pas implémenter pendant cette phase :

* l’interface React des phases ;
* une page CRUD des phases ;
* un formulaire de phase ;
* le réordonnancement par glisser-déposer ;
* les tâches ;
* les checklists ;
* le tableau de bord ;
* le journal d’activité ;
* une API générique IPC ;
* une nouvelle architecture de gestion d’état ;
* une nouvelle bibliothèque ;
* une connexion SQLite dans le preload ou le renderer ;
* une refonte esthétique ;
* une modification massive des repositories existants ;
* une migration de base non nécessaire ;
* une fonctionnalité de Phase 3.7 ou ultérieure.

Ne pas installer de nouvelle dépendance sans nécessité absolue.

---

# 13. Qualité attendue

Le code doit respecter les règles suivantes :

* TypeScript strict ;
* aucune erreur masquée ;
* aucun `any` introduit sans justification ;
* aucune duplication inutile de types ;
* aucune chaîne IPC dispersée ;
* validation Zod aux frontières ;
* fonctions petites et explicites ;
* dépendances injectables lorsque la convention actuelle le permet ;
* tests déterministes ;
* fermeture correcte des bases temporaires ;
* suppression correcte des fichiers temporaires de test ;
* changements limités au périmètre de la Phase 3.6.

---

# 14. Commandes de validation

À la fin de l’implémentation, exécuter dans cet ordre :

```bash
npm run typecheck
npm run test
npm run build
```

Si une commande échoue :

1. analyser la cause réelle ;
2. corriger le code ou le test ;
3. relancer la commande concernée ;
4. relancer ensuite la séquence complète.

Ne pas utiliser :

* `skipLibCheck` ;
* `@ts-ignore` ;
* la désactivation de tests ;
* `.skip` ;
* `.only` ;
* un assouplissement injustifié des schémas ;
* un changement de configuration destiné uniquement à masquer une erreur.

Après validation automatisée, lancer :

```bash
npm run dev
```

Vérifier manuellement que :

* l’application démarre ;
* aucune erreur IPC n’apparaît au démarrage ;
* la page Projets existante fonctionne encore ;
* la sélection du projet actif fonctionne encore ;
* aucune erreur visible n’apparaît dans la console Electron ou renderer.

La future interface des phases n’existant pas encore, aucune validation manuelle CRUD des phases n’est attendue pendant cette phase.

---

# 15. Rapport obligatoire

Créer :

```text
workflow/reports/RAPPORT_PHASE_3.6.md
```

Le rapport doit contenir :

## Résumé

* objectif de la phase ;
* résultat obtenu ;
* statut final.

## Fichiers créés

Liste exacte des fichiers créés.

## Fichiers modifiés

Liste exacte des fichiers modifiés.

## API exposée

Présenter les méthodes finales de :

```ts
window.themeFactoryApi.phases
```

avec leurs signatures TypeScript.

## Validation des entrées

Préciser :

* les schémas Zod utilisés ;
* les identifiants validés ;
* le comportement en cas de payload invalide.

## Tests

Indiquer :

* les fichiers de tests créés ou modifiés ;
* les scénarios couverts ;
* le nombre de fichiers de tests exécutés ;
* le nombre total de tests réussis.

## Commandes exécutées

Reporter les résultats exacts de :

```bash
npm run typecheck
npm run test
npm run build
npm run dev
```

## Validation manuelle

Documenter :

* le démarrage de l’application ;
* l’absence d’erreur IPC ;
* la non-régression du module Projets.

## Écarts

Mentionner tout écart par rapport au prompt et sa justification.

## Risques ou points à surveiller

Identifier les éléments utiles pour la Phase 3.7.

## Git

Ne pas créer de commit automatiquement, sauf instruction explicite séparée.

Présenter uniquement :

```bash
git status --short
git diff --stat
```

---

# 16. Livrable final attendu dans le terminal Claude Code

À la fin, afficher une synthèse courte contenant :

1. le statut de la Phase 3.6 ;
2. les fichiers principaux créés ou modifiés ;
3. l’API finale `window.themeFactoryApi.phases` ;
4. le résultat du typecheck ;
5. le résultat des tests ;
6. le résultat du build ;
7. le résultat du démarrage manuel ;
8. le chemin du rapport ;
9. les éventuels écarts ou limites ;
10. la confirmation qu’aucun commit n’a été créé.

---

# Critères d’acceptation

La Phase 3.6 est considérée comme terminée uniquement si :

* les canaux IPC des phases sont centralisés ;
* les handlers des phases sont enregistrés dans le main process ;
* toutes les entrées provenant du renderer sont validées ;
* les handlers utilisent le repository existant ;
* `window.themeFactoryApi.phases` est correctement typé ;
* le preload n’expose aucune API IPC générique ;
* les opérations supportées par le repository sont accessibles au renderer ;
* les tests unitaires des handlers réussissent ;
* le test d’intégration avec SQLite réussit si cette stratégie existe déjà ;
* les tests du preload réussissent ;
* les tests des projets continuent à réussir ;
* `npm run typecheck` réussit ;
* `npm run test` réussit ;
* `npm run build` réussit ;
* l’application démarre avec `npm run dev` ;
* aucune fonctionnalité de la Phase 3.7 n’a été implémentée ;
* le rapport `workflow/reports/RAPPORT_PHASE_3.6.md` est créé ;
* aucun commit Git n’est créé automatiquement.
