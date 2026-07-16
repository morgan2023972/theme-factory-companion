# Review indépendante — Phase 3.4 : Interface CRUD des projets

Review stricte de l'implémentation réelle (code source), pas du rapport d'implémentation `RAPPORT_PHASE_3.4.md` seul. Toutes les affirmations de ce rapport ont été vérifiées par lecture complète des fichiers créés/modifiés.

## Commandes exécutées en préalable

```powershell
git status --short
git diff --stat
git diff
git ls-files --others --exclude-standard
```

Tous les fichiers non suivis retournés par `git ls-files --others --exclude-standard` ont été lus intégralement (ils n'apparaissent pas dans `git diff`) :

- `src/renderer/src/pages/ProjectsPage.tsx`
- `src/renderer/src/pages/ProjectsPage.test.tsx`
- `src/renderer/src/components/projects/ProjectForm.tsx`
- `src/renderer/src/components/projects/ProjectCard.tsx`
- `src/renderer/src/components/projects/projectStatusLabels.ts`
- `src/renderer/src/utils/getErrorMessage.ts`
- `vitest.setup.ts`
- `workflow/prompts/PHASE_3.4_PROMPT.md`
- `workflow/reports/RAPPORT_PHASE_3.4.md`

Ainsi que le diff complet des fichiers modifiés suivis : `src/renderer/src/App.tsx`, `src/renderer/src/styles.css`, `tsconfig.node.json`, `tsconfig.web.json`, `vitest.config.ts`, `package.json`.

---

## Constats

### 1. BLOQUANT — Formulaire non remonté lors du changement de cible d'édition → risque de corruption de données

**Fichier** : `src/renderer/src/pages/ProjectsPage.tsx:172-181` (rendu de `<ProjectForm>`) et `src/renderer/src/components/projects/ProjectCard.tsx:46-48` (bouton « Modifier » jamais désactivé pendant qu'un autre formulaire est ouvert).

**Problème** : `<ProjectForm mode={formState.mode} initialProject={...} .../>` n'a pas de prop `key`. Le bouton « Modifier » d'une carte reste cliquable même quand le formulaire d'édition/création d'un *autre* projet est déjà ouvert (seul le bouton « Nouveau projet » de la barre d'outils est désactivé via `formState.mode !== 'closed'`). Si l'utilisateur clique « Modifier » sur le projet A, puis — sans fermer — clique « Modifier » sur le projet B (ou ouvre « Nouveau projet » puis clique « Modifier » sur un projet existant), React ne démonte pas `ProjectForm` (même type, même position, pas de `key` différenciant) : les champs internes (`useState(initialProject?.name ?? '')`, etc.) ne sont initialisés qu'au montage et gardent donc les valeurs du projet A affichées à l'écran, alors que `formState.project` pointe désormais vers B.

**Risque concret** : en soumettant, `handleSubmitForm` cible bien l'identifiant de B (`currentFormState.project.id`) mais avec les valeurs de champs de A (ou vides, si on venait d'un formulaire de création). Résultat : `window.themeFactoryApi.projects.update(B.id, valeursDeA)` écrase silencieusement les données de B avec celles de A, persisté en SQLite. Aucun message d'erreur, aucune confirmation — corruption de données silencieuse et reproductible en usage normal (deux clics « Modifier » successifs sur deux cartes différentes).

**Correction recommandée** : ajouter une `key` stable et dépendante de la cible au `<ProjectForm>`, par ex. `key={formState.mode === 'edit' ? `edit-${formState.project.id}` : 'create'}`, pour forcer un remontage propre à chaque changement de cible. En complément, désactiver les boutons « Modifier »/« Sélectionner »/« Supprimer » des autres cartes tant qu'un formulaire est ouvert (cohérent avec la désactivation déjà appliquée au bouton « Nouveau projet »).

---

### 2. IMPORTANT — Échec silencieux si le projet édité a été supprimé entre-temps

**Fichier** : `src/renderer/src/pages/ProjectsPage.tsx:90-98`

```ts
} else {
  const updated = await window.themeFactoryApi.projects.update(currentFormState.project.id, values)
  if (!isMountedRef.current) return
  if (updated) {
    setProjects((current) => current.map((project) => (project.id === updated.id ? updated : project)))
  }
  setFormState({ mode: 'closed' })   // <- appelé même si updated === null
}
```

**Problème** : `repository.update`/le handler IPC retournent `null` quand l'identifiant n'existe plus (contrat déjà établi en phases 3.2/3.3). Ce cas n'est traité que pour éviter de modifier la liste (`if (updated)`), mais `setFormState({ mode: 'closed' })` s'exécute quand même sans condition : le formulaire se ferme comme en cas de succès, sans aucun message d'erreur.

**Risque concret** : scénario réaliste avec l'architecture actuelle (voir constat n°1) — un utilisateur ouvre l'édition du projet A, supprime A depuis sa carte (le bouton « Supprimer » de la carte A reste cliquable pendant que son formulaire est ouvert, rien ne l'en empêche), puis soumet le formulaire resté ouvert. L'utilisateur voit le formulaire se fermer normalement et croit sa modification enregistrée, alors que rien n'a été sauvegardé.

**Correction recommandée** : quand `updated === null`, afficher un message d'erreur explicite (« Ce projet n'existe plus, il a peut-être été supprimé. ») via `setFormErrorMessage(...)` et ne pas fermer le formulaire silencieusement comme un succès.

---

### 3. IMPORTANT — Clic mort sur « Supprimer » d'une autre carte pendant une suppression en cours

**Fichier** : `src/renderer/src/pages/ProjectsPage.tsx:115-118`

```ts
function handleDelete(project: Project): void {
  if (deletingProjectId !== null) {
    return
  }
  ...
```

**Problème** : le garde-fou est global (un seul `deletingProjectId` à la fois), mais seule la carte *concernée* affiche un état désactivé (`isDeleting={deletingProjectId === project.id}` dans `ProjectCard`). Les autres cartes restent visuellement actives et cliquables.

**Risque concret** : pendant la suppression du projet A, cliquer « Supprimer » sur le projet B (carte non désactivée) ne déclenche ni confirmation, ni erreur, ni aucun retour visuel — l'action est silencieusement ignorée. Contredit d'ailleurs l'affirmation du rapport (« sans bloquer les autres cartes ») : les autres cartes ne sont pas bloquées visuellement, mais leur action l'est fonctionnellement, ce qui est pire (clic mort non expliqué).

**Correction recommandée** : soit autoriser des suppressions concurrentes réelles (remplacer `deletingProjectId: string | null` par un `Set<string>` d'identifiants en cours de suppression), soit désactiver visuellement *toutes* les actions de suppression pendant qu'une suppression est en cours, pour que le comportement affiché corresponde au comportement réel.

---

### 4. IMPORTANT — Affirmation du rapport non vérifiée : aucun test ne couvre l'échec de création

**Fichier** : `src/renderer/src/pages/ProjectsPage.test.tsx` (describe `ProjectsPage — création`, lignes 112-147) ; rapport `workflow/reports/RAPPORT_PHASE_3.4.md`, section Tests, scénario 10.

**Problème** : le rapport affirme que l'erreur de création est « implicitement couverte ». Après lecture complète du fichier de test, **aucun test n'appelle jamais `projectsApi.create.mockRejectedValueOnce(...)`** ni ne vérifie un message d'erreur, la persistance du formulaire ouvert, la conservation des valeurs saisies, ou la réinitialisation de l'état de soumission pour le chemin de création. Seuls le chargement et la suppression ont un test d'erreur explicite. C'est une lacune de couverture réelle, pas seulement documentaire : le code de gestion d'erreur de `create` (dans le même bloc `try/catch/finally` que `update`) n'a jamais été exécuté par un test.

**Correction recommandée** — ajouter un test dédié, par exemple :

```ts
it('affiche une erreur si la création échoue et conserve les valeurs saisies', async () => {
  projectsApi.list.mockResolvedValue([])
  projectsApi.create.mockRejectedValueOnce(new Error('Création impossible'))

  const user = userEvent.setup()
  render(<ProjectsPage />)

  await screen.findByText('Aucun projet enregistré pour le moment.')
  await user.click(screen.getByRole('button', { name: 'Nouveau projet' }))
  await user.type(screen.getByLabelText('Nom'), 'Projet en échec')
  await user.click(screen.getByRole('button', { name: 'Créer le projet' }))

  expect(await screen.findByText('Création impossible')).toBeTruthy()
  expect(screen.getByLabelText('Nom')).toHaveValue('Projet en échec')
  expect(screen.getByRole('button', { name: 'Créer le projet' })).not.toBeDisabled()
  expect(projectsApi.create).toHaveBeenCalledTimes(1)
})
```

Ce test couvrirait les 5 points explicitement demandés : rejet de `create`, message affiché, formulaire toujours ouvert, valeurs conservées, état de soumission réinitialisé.

---

### 5. MINEUR — Test de réinitialisation de sélection active peu discriminant

**Fichier** : `src/renderer/src/pages/ProjectsPage.test.tsx:249-265`

**Problème** : le test ne place qu'un seul projet dans la liste ; après suppression, la liste devient vide et l'état vide s'affiche. Cela ne prouve pas réellement que `activeProjectId` a été remis à `null` — seulement qu'il n'y a plus de carte du tout. Un bug où l'identifiant actif resterait « collé » en mémoire sans jamais se réinitialiser ne serait pas détecté par ce test tant qu'aucun autre projet n'est présent.

**Correction recommandée** : inclure un second projet non supprimé dans la liste et vérifier explicitement qu'après la suppression du projet actif, aucune carte restante n'affiche le bouton « Actif ».

---

### 6. MINEUR — Association accessible incomplète pour l'erreur de nom

**Fichier** : `src/renderer/src/components/projects/ProjectForm.tsx:96-108`

**Problème** : `nameError` est affiché comme un `<p role="alert">` séparé, mais le `<input id={`${formId}-name`}>` ne porte ni `aria-invalid` ni `aria-describedby` vers ce message. Un lecteur d'écran annoncera l'alerte au moment où elle apparaît, mais l'association durable champ ↔ erreur (utile en navigation ultérieure) est absente.

**Correction recommandée** : ajouter `aria-invalid={nameError ? 'true' : undefined}` et `aria-describedby` pointant vers l'id du message d'erreur sur le champ nom.

---

### 7. MINEUR — Libellé « Nouveau projet » dupliqué (bouton + titre du formulaire)

**Fichier** : `src/renderer/src/pages/ProjectsPage.tsx:162` et `src/renderer/src/components/projects/ProjectForm.tsx:91`

**Problème** : le bouton de la barre d'outils et le titre `<h2>` du formulaire de création portent exactement le même texte « Nouveau projet ». Sans requêtes scoping par rôle (comme le fait heureusement le fichier de test), une recherche par texte serait ambiguë.

**Correction recommandée** : renommer le titre du formulaire, par exemple « Créer un projet ».

---

### 8. MINEUR — `isMountedRef` ne protège pas totalement contre le double effet de `React.StrictMode`

**Fichier** : `src/renderer/src/pages/ProjectsPage.tsx:21-51`, `src/renderer/src/main.tsx` (StrictMode activé)

**Problème** : en développement, `StrictMode` monte/démonte/remonte l'effet ; `isMountedRef.current` repasse à `true` après le remontage synthétique, donc le premier appel `list()` (déclenché avant le « démontage » synthétique) peut tout de même appliquer son résultat après coup, en plus du second appel. Effet inoffensif (mêmes données, appel réseau local redondant) mais le garde-fou ne fait pas ce que son nom suggère dans ce cas précis. Comportement absent en production (StrictMode double-invoke est un outil de diagnostic dev-only).

**Correction recommandée** : aucune action requise à ce stade ; à mentionner si un vrai bug de « double écriture » apparaissait plus tard avec des effets non idempotents.

---

### 9. SUGGESTION — Focus non déplacé à l'ouverture du formulaire

**Fichier** : `src/renderer/src/components/projects/ProjectForm.tsx`

Aucun `autoFocus`/focus programmatique sur le premier champ à l'ouverture. Non bloquant (le focus clavier visible existe déjà globalement via `:focus-visible`), mais améliorerait l'expérience clavier/lecteur d'écran.

### 10. SUGGESTION — Format de date dépendant de la locale runtime

**Fichier** : `src/renderer/src/components/projects/ProjectCard.tsx:38-39`

`toLocaleString()` sans locale explicite ; à figer si un affichage cohérent entre environnements est souhaité plus tard.

---

## Vérification des points demandés explicitement

- **Signatures `window.themeFactoryApi.projects`** : conformes au contrat (`list()`, `getById(id)`, `create(input)`, `update(id, input)`, `remove(id)`), tous typés et appelés correctement.
- **Conformité aux schémas Zod** : les valeurs texte vides sont converties en `null` (jamais chaîne vide) via `toOptionalText`, `status` toujours une valeur valide de l'enum — conforme.
- **Accès direct Electron/Node/IPC/SQLite** : aucun trouvé (`grep` négatif, confirmé par lecture complète des fichiers).
- **Dépendances de test** : ajout justifié et minimal (`@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`), cohérent avec l'absence totale d'infrastructure de test React préexistante.
- **Configuration Vitest/TypeScript** : `vitest.config.ts` (plugin React + setupFiles), `vitest.setup.ts`, et les deux `tsconfig*.json` sont cohérents entre eux et fonctionnels (tests exécutés avec succès).
- **12 scénarios / 11 tests** : confirmé que 11 tests existent et couvrent bien 11 des 12 scénarios listés dans le prompt ; le 12ᵉ concerne l'erreur de création, non couverte malgré l'affirmation du rapport (voir constat n°4).

## Verdict

**Corrections nécessaires avant validation manuelle.**

Le constat n°1 (formulaire non remonté lors d'un changement de cible d'édition) est un défaut de corruption de données silencieuse déclenchable en usage normal et doit être corrigé avant toute validation manuelle par l'utilisateur — un test manuel de « modifier deux projets successivement sans fermer le formulaire » écraserait réellement des données. Les constats n°2, 3 et 4 devraient également être traités avant validation (silences trompeurs et couverture de test surestimée), les autres points sont mineurs/suggestions et peuvent être traités séparément.
