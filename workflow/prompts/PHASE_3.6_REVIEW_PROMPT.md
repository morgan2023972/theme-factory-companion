Effectue maintenant la review indépendante de la **Phase 3.6 — IPC et API preload des phases**.

Lis intégralement et applique strictement :

`workflow/prompts/PHASE_3.6_REVIEW_PROMPT.md`

Consignes impératives :

- inspecte directement le code, les tests, le rapport de phase et l’état Git ;
- ne considère pas `workflow/reports/RAPPORT_PHASE_3.6.md` comme une preuve suffisante ;
- vérifie chaque affirmation importante dans les fichiers réels ;
- exécute les validations demandées ;
- ne corrige aucun fichier applicatif pendant cette première review ;
- crée uniquement le rapport :

`workflow/reports/REVIEW_PHASE_3.6.md`

- classe chaque constat en bloquant, important, mineur ou observation ;
- donne un verdict explicite parmi les quatre verdicts définis dans le prompt ;
- indique clairement si la Phase 3.6 est prête à être commitée ;
- ne commence pas la Phase 3.7 ;
- ne crée aucun commit Git.

À la fin, affiche :

```bash
git status --short
git diff --stat
```

Puis fournis une synthèse contenant :

1. le verdict final ;
2. les défauts bloquants ou importants ;
3. les observations mineures ;
4. les résultats exacts de `typecheck`, `test` et `build` ;
5. l’évaluation de la validation manuelle ;
6. le chemin du rapport de review ;
7. la confirmation qu’aucun commit n’a été créé.
