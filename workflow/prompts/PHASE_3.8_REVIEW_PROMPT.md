# REVIEW INDÉPENDANTE — PHASE 3.8

Effectue une review technique indépendante de la **Phase 3.8 — Validation intégrée Projets + Phases** du projet Theme Factory Companion.

Cette review sera exécutée avec un modèle Claude puissant. Elle doit donc privilégier une analyse approfondie des preuves réelles, des tests ajoutés et des éventuels faux positifs.

## Documents de référence

Lis intégralement :

* `workflow/prompts/PHASE_3.8_PROMPT.md`
* `workflow/reports/RAPPORT_PHASE_3.8.md`

Lis également les documents utiles des phases précédentes :

* `workflow/reports/RAPPORT_PHASE_3.7.md`
* `workflow/reports/REVIEW_PHASE_3.7.md`
* `workflow/reports/RAPPORT_CORRECTIONS_REVIEW_PHASE_3.7.md`
* `workflow/reports/REVIEW_CORRECTIONS_PHASE_3.7.md`

Le rapport de Phase 3.8 décrit ce qui aurait été réalisé. Il ne constitue pas une preuve suffisante. Vérifie toutes les affirmations importantes directement dans le dépôt.

---

# 1. Fichiers à inspecter

Inspecte au minimum :

## Nouveaux tests de Phase 3.8

* `src/renderer/src/App.test.tsx`
* `src/main/database/repositories/projectsPhasesCascade.integration.test.ts`

## Câblage renderer réel

* `src/renderer/src/App.tsx`
* `src/renderer/src/navigation.ts`
* `src/renderer/src/pages/ProjectsPage.tsx`
* `src/renderer/src/pages/PhasesPage.tsx`
* `src/renderer/src/components/projects/ProjectCard.tsx`
* `src/renderer/src/components/phases/PhaseCard.tsx`

## Tests existants de comparaison

* `src/renderer/src/pages/ProjectsPage.test.tsx`
* `src/renderer/src/pages/PhasesPage.test.tsx`

## Repositories et SQLite

* `src/main/database/repositories/projectsRepository.ts`
* `src/main/database/repositories/phasesRepository.ts`
* `src/main/database/repositories/projectsRepository.test.ts`
* `src/main/database/repositories/phasesRepository.test.ts`
* les migrations définissant `projects` et `phases`
* le moteur de migrations
* le module d’ouverture et de fermeture de la base

## IPC et preload

* `src/main/ipc/registerProjectsHandlers.integration.test.ts`
* `src/main/ipc/registerPhasesHandlers.integration.test.ts`
* `src/preload/index.ts`
* `src/preload/index.test.ts`
* `src/shared/contracts/themeFactoryApi.ts`

## Git et documentation

* tous les fichiers créés ou modifiés visibles dans `git status --short`
* `workflow/prompts/PHASE_3.8_PROMPT.md`
* `workflow/reports/RAPPORT_PHASE_3.8.md`

---

# 2. Règles de la review

Pendant cette review :

* ne modifie aucun fichier applicatif ;
* ne modifie aucun test ;
* ne corrige aucune documentation ;
* ne crée aucune fonctionnalité ;
* ne commence pas la Phase 4 ;
* ne crée aucun commit.

La seule création autorisée est :

`workflow/reports/REVIEW_PHASE_3.8.md`

Si un défaut est identifié, décris une correction minimale, mais ne l’applique pas.

---

# 3. Vérification du périmètre

Confirme que la Phase 3.8 se limite réellement à :

* l’ajout de tests intégrés ;
* la validation de l’intégration projets + phases ;
* la validation de la cascade SQLite ;
* la validation de la persistance combinée ;
* la documentation de la clôture de Phase 3.

Vérifie qu’aucun code métier, composant, repository, handler IPC, preload, migration ou schéma partagé n’a été modifié.

Vérifie l’absence de :

* tâches ;
* checklists ;
* nouvelles fonctionnalités ;
* nouvelle dépendance ;
* changement de structure de base ;
* refonte renderer ;
* modification de configuration destinée uniquement aux tests.

Signale tout écart, même s’il paraît anodin.

---

# 4. Review de `App.test.tsx`

Analyse les deux tests du vrai composant `App`.

## Montage réel

Vérifie que :

* le test rend réellement `<App />` ;
* il ne remplace pas `App` par un harnais ;
* le state du projet actif est réellement détenu par `App.tsx`;
* les vraies pages `ProjectsPage` et `PhasesPage` sont rendues ;
* la navigation utilise les vrais boutons ou contrôles de l’application ;
* aucun state interne n’est manipulé directement.

## Mock API

Vérifie que :

* `window.themeFactoryApi` est mockée de manière strictement typée ;
* les APIs `projects` et `phases` sont présentes ;
* les méthodes non utilisées n’ont pas des comportements dangereux ou trompeurs ;
* les mocks sont réinitialisés entre les tests ;
* les résultats sont spécifiques aux identifiants de projets ;
* `listByProjectId(A)` et `listByProjectId(B)` renvoient bien des jeux de données différents.

## Scénario changement de projet

Vérifie que le test démontre réellement :

1. chargement des projets ;
2. sélection du projet A depuis l’interface ;
3. navigation vers la page des phases ;
4. appel de `listByProjectId` avec A ;
5. affichage des phases de A ;
6. retour vers Projets ;
7. sélection de B ;
8. retour vers Phases ;
9. appel avec B ;
10. disparition des phases de A ;
11. affichage des phases de B.

Contrôle que les assertions ne pourraient pas réussir même avec un câblage incorrect.

Vérifie notamment :

* que l’appel avec B est bien postérieur à la sélection de B ;
* que la phase de A est réellement absente après le changement ;
* que le nom du projet actif affiché correspond à B ;
* que le test n’utilise pas uniquement des appels mock déjà préprogrammés dans un ordre qui masquerait un identifiant incorrect.

## Scénario suppression du projet actif

Vérifie que le test démontre réellement :

1. sélection de A ;
2. navigation vers les phases de A ;
3. retour vers Projets ;
4. confirmation de suppression ;
5. appel réel à `projects.remove(A)` ;
6. mise à jour de la liste des projets ;
7. remise à `null` du projet actif ;
8. retour vers Phases ;
9. affichage de l’état sans projet actif ;
10. absence de nouvel appel à `listByProjectId(A)` après suppression.

Vérifie que `window.confirm` est restauré correctement.

Détermine si le test devrait aussi vérifier que B reste disponible, ou si cela est déjà couvert ailleurs.

---

# 5. Qualité des tests renderer

Vérifie que les tests :

* utilisent des rôles et noms accessibles ;
* ne dépendent pas excessivement de la structure HTML ;
* attendent les changements asynchrones correctement ;
* n’utilisent pas de délai réel ;
* ne produisent pas de warning React `act(...)`;
* ne contiennent ni `.skip`, ni `.only`;
* ne réutilisent pas un DOM ou des mocks pollués entre les tests ;
* ne reconstruisent pas manuellement le comportement qu’ils prétendent tester ;
* vérifient les appels exacts et leur ordre lorsque cela est pertinent.

Recherche d’éventuels faux positifs :

* assertions trop faibles ;
* mock `listByProjectId` qui renvoie les mêmes données quel que soit l’id ;
* test qui passerait même si `activeProject` n’était pas partagé ;
* test qui passerait même si la navigation rendait directement une page isolée ;
* test qui ne vérifie pas réellement la disparition des données précédentes.

---

# 6. Review du test de cascade SQLite

Inspecte :

`src/main/database/repositories/projectsPhasesCascade.integration.test.ts`

## Base et migrations

Vérifie que :

* une vraie base `better-sqlite3` est utilisée ;
* les migrations réelles sont exécutées ;
* `PRAGMA foreign_keys = ON` est effectivement actif ;
* les vrais repositories sont instanciés ;
* aucun repository ou appel SQL métier n’est mocké ;
* la suppression passe réellement par `projectsRepository.remove`.

## Scénario cascade

Vérifie que le test crée réellement :

* deux projets distincts A et B ;
* plusieurs phases pour A ;
* au moins une phase pour B.

Puis vérifie que :

* les phases existent avant suppression ;
* A est supprimé ;
* A devient introuvable ;
* toutes les phases de A deviennent introuvables ;
* la liste de A est vide ;
* le comptage SQL direct est réellement égal à zéro ;
* B existe toujours ;
* la phase de B existe toujours ;
* les phases de B restent associées au bon projet.

Confirme que la cascade est assurée par SQLite et non simulée manuellement par le test ou par `projectsRepository.remove`.

Inspecte le repository projets afin de confirmer qu’il ne supprime pas explicitement les phases avant le projet.

## Valeur réelle du test

Détermine si le test échouerait réellement dans chacun des cas suivants :

* absence de `ON DELETE CASCADE`;
* `foreign_keys` désactivé ;
* suppression manuelle incomplète ;
* erreur de rattachement des phases ;
* suppression accidentelle des phases de B.

---

# 7. Review du test de persistance combinée

Vérifie que :

* un vrai fichier SQLite temporaire est utilisé ;
* le chemin est unique par test ;
* une première connexion crée le projet et les phases ;
* la première connexion est fermée ;
* une nouvelle connexion indépendante est ouverte sur le même fichier ;
* les migrations sont exécutées ou vérifiées selon le cycle normal du projet ;
* les données sont relues via de nouvelles instances des repositories ;
* l’ordre des phases est vérifié ;
* les propriétés importantes du projet et des phases sont comparées ;
* aucune donnée n’est conservée uniquement en mémoire dans une ancienne instance.

## Nettoyage

Vérifie que :

* toutes les connexions sont fermées, même en cas d’échec ;
* le répertoire temporaire est supprimé ;
* les fichiers `.sqlite`, `-wal` et `-shm` sont inclus dans le nettoyage ;
* le test ne peut pas laisser de fichier parasite ;
* plusieurs exécutions ou tests parallèles ne peuvent pas utiliser le même chemin.

Vérifie les blocs `beforeEach`, `afterEach`, `try/finally` ou mécanismes équivalents.

## Idempotence et migrations

Le rapport indique que ce test ne cherche pas à dupliquer les tests complets d’idempotence.

Vérifie néanmoins que la réouverture suit un cycle cohérent avec l’application réelle :

* ouverture ;
* migrations ;
* repositories ;
* fermeture ;
* réouverture ;
* migrations ou contrôle ;
* lecture.

Signale si le test contourne une étape essentielle du cycle réel.

---

# 8. Couverture et non-redondance

Compare les nouveaux tests avec :

* `database.test.ts`
* `projectsRepository.test.ts`
* `phasesRepository.test.ts`
* les tests d’intégration IPC
* les tests renderer de pages

Vérifie que les quatre nouveaux tests apportent réellement une valeur nouvelle.

Confirme ou infirme les affirmations du rapport selon lesquelles :

* la persistance d’un projet seul était déjà couverte ;
* la persistance des phases avec leur projet ne l’était pas ;
* la cascade réelle ne l’était pas ;
* le câblage réel `App.tsx` ne l’était pas ;
* l’ordre des phases était déjà suffisamment couvert.

Signale toute duplication importante ou, au contraire, toute lacune encore non couverte.

---

# 9. Validation de l’ordre des phases

Vérifie que le test de persistance contrôle réellement l’ordre des phases après réouverture.

Compare avec la règle du repository :

* `position ASC`;
* éventuelles clés secondaires.

Vérifie que les données créées rendent le test pertinent :

* positions distinctes ;
* ordre d’insertion pouvant être différent de l’ordre attendu, si cela est nécessaire pour démontrer le tri ;
* assertions sur les identifiants ou noms dans l’ordre exact.

Si le test crée déjà les phases dans le même ordre que celui attendu, évalue si l’assertion démontre réellement le tri ou seulement la persistance.

Ne classe pas cela comme défaut important si le tri est déjà démontré dans d’autres tests, mais documente honnêtement la portée de ce test précis.

---

# 10. Validation automatisée indépendante

Exécute sans modifier le code :

```bash
npm run typecheck
npm run test
npm run build
```

Reporte les résultats exacts :

* nombre de fichiers de tests ;
* nombre total de tests ;
* warnings éventuels ;
* résultat du build ;
* hash et taille renderer si pertinents.

Le résultat annoncé est :

* 21 fichiers de tests ;
* 352 tests réussis ;
* typecheck réussi ;
* build réussi.

Signale toute différence.

Tu peux également exécuter séparément les deux nouveaux fichiers de tests si la configuration le permet, afin de confirmer leur résultat isolé.

---

# 11. Inspection Git

Exécute :

```bash
git status --short
git diff --stat
git diff --check
git diff
```

Comme les nouveaux fichiers ne sont pas encore suivis, inspecte-les directement et ne te limite pas à `git diff`.

Vérifie :

* la présence exacte des deux nouveaux fichiers de tests ;
* la présence du prompt et du rapport de Phase 3.8 ;
* l’absence de fichier `.txt` parasite ;
* l’absence de fichier SQLite temporaire ;
* l’absence de dossier temporaire ;
* l’absence de snapshot ou fichier généré ;
* l’absence de modification de dépendance ;
* l’absence de modification applicative ;
* l’absence d’erreur d’espacement.

Vérifie également que `workflow/reports/RAPPORT_PHASE_3.8.md` apparaît bien dans l’état Git réel.

---

# 12. Vérification du rapport

Compare chaque affirmation importante de :

`workflow/reports/RAPPORT_PHASE_3.8.md`

avec le code et les résultats réels.

Vérifie notamment :

* 2 nouveaux fichiers ;
* 4 nouveaux tests ;
* total 352 ;
* absence de correction applicative ;
* absence de modification de code existant ;
* test réel de `App.tsx`;
* cascade réelle ;
* persistance sur fichier réel ;
* nettoyage des ressources ;
* build inchangé ;
* état Git annoncé.

Signale les erreurs documentaires même si elles sont mineures.

---

# 13. Validation manuelle

La validation manuelle n’a pas encore été effectuée.

Ne considère pas les nouveaux tests comme un remplacement complet de la validation interactive.

Prépare une checklist finale compacte couvrant :

* création de projets A et B ;
* sélection du projet actif ;
* création et modification de phases pour A ;
* changement vers B ;
* absence de fuite des phases de A ;
* création d’une phase pour B ;
* suppression de A ;
* cascade visible ;
* conservation de B ;
* fermeture et redémarrage ;
* persistance de B et de ses phases ;
* absence d’erreurs main et renderer.

Le verdict devra distinguer :

* validation technique ;
* validation manuelle encore nécessaire.

---

# 14. Classification des constats

Classe chaque constat en :

* **Bloquant** : invalide la Phase 3.8 ou révèle un faux test majeur ;
* **Important** : correction requise avant validation manuelle ou commit ;
* **Mineur** : amélioration ou correction documentaire non bloquante ;
* **Observation** : information sans action immédiate.

Pour chaque défaut, indique :

* fichier ;
* test ou zone ;
* problème précis ;
* scénario ;
* impact ;
* correction minimale recommandée.

Ne propose pas de refonte.

---

# 15. Verdict final

Termine par un verdict unique :

## Verdict A — VALIDÉE TECHNIQUEMENT, VALIDATION MANUELLE REQUISE

À utiliser si :

* aucun défaut bloquant ou important n’est présent ;
* les quatre nouveaux tests sont fiables ;
* typecheck, tests et build réussissent ;
* seule la validation interactive utilisateur reste à effectuer.

## Verdict B — CORRECTIONS REQUISES

À utiliser si au moins un défaut important ou bloquant est identifié.

## Verdict C — REVIEW IMPOSSIBLE

À utiliser uniquement si des fichiers indispensables sont absents.

Indique explicitement :

* si une correction applicative ou de test est requise ;
* si une correction documentaire est requise ;
* si la validation manuelle peut commencer ;
* si le commit doit attendre.

---

# 16. Rapport obligatoire

Créer uniquement :

`workflow/reports/REVIEW_PHASE_3.8.md`

Le rapport doit contenir :

* périmètre inspecté ;
* analyse de `App.test.tsx`;
* analyse de la cascade ;
* analyse de la persistance ;
* analyse du nettoyage ;
* comparaison avec la couverture existante ;
* résultats des validations ;
* inspection Git ;
* vérification du rapport de Phase 3.8 ;
* constats classés ;
* checklist manuelle ;
* verdict ;
* décision concernant le commit.

Ne modifie aucun autre fichier.

Ne crée aucun commit.

À la fin, affiche :

```bash
git status --short
git diff --stat
git diff --check
```

Puis fournis une synthèse contenant :

1. le verdict ;
2. les éventuels défauts bloquants ou importants ;
3. les constats mineurs ;
4. le résultat des quatre nouveaux tests ;
5. le résultat exact de la suite complète ;
6. la checklist manuelle restante ;
7. le chemin du rapport de review ;
8. la décision concernant le commit ;
9. la confirmation qu’aucun commit n’a été créé.

Ne commence pas la Phase 4.
