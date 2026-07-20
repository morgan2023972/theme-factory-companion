# Orchestrateur local V1 — Matrice de sécurité

Statut : documentaire uniquement (ORCH-0.2). Cette matrice est la traduction opérationnelle et compacte de `ORCHESTRATOR_V1_SAFETY_RULES.md` ; en cas de divergence apparente, le document `ORCHESTRATOR_V1_SAFETY_RULES.md` fait foi.

Statuts utilisés : **autorisé**, **autorisé sous conditions**, **interdit**, **hors périmètre V1**.

| Action | Catégorie | Autorisation V1 | Approbation humaine | Conditions | Comportement en cas d'échec |
|---|---|---|---|---|---|
| Lire un fichier dans le dépôt | Lecture fichier | autorisé | non | chemin résolu et validé dans le dépôt déclaré | erreur bloquante, étape non terminée |
| Lire un fichier hors dépôt | Lecture fichier | interdit | non | — | rejet immédiat, aucune lecture effectuée |
| Créer un prompt | Écriture fichier | autorisé sous conditions | oui (prompt approuvé) | chemin dans le dépôt, encodage UTF-8, fichier inexistant | erreur bloquante si chemin invalide ou fichier déjà présent sans confirmation |
| Écraser un prompt | Écriture fichier | interdit | non, aucune approbation ne rend l'écrasement possible | interdiction stricte en V1, sans exception | rejet immédiat ; une nouvelle version doit être créée sous un nouveau chemin |
| Lire un rapport | Lecture fichier | autorisé | non | chemin attendu connu à l'avance | étape non terminée si absent |
| Accepter un rapport vide | Validation artefact | interdit | non | contenu non vide obligatoire | rapport considéré invalide, étape bloquée |
| Lancer Claude Code | Exécution commande | autorisé sous conditions | oui (prompt approuvé) | dépôt validé, aucune exécution concurrente sur le même projet | échec consigné (code de sortie, stdout, stderr), relance manuelle possible |
| Lancer deux exécutions sur le même dépôt | Concurrence | interdit | non | verrou par projet actif | rejet immédiat de la seconde exécution |
| `npm run typecheck` | Validation automatique | autorisé | non | commande définie par le profil | commande bloquante en échec arrête la progression |
| `npm run test` | Validation automatique | autorisé | non | commande définie par le profil | commande bloquante en échec arrête la progression |
| `npm run build` | Validation automatique | autorisé | non | commande définie par le profil (uniquement les commandes de validation du projet) | commande bloquante en échec arrête la progression |
| Commande absente du profil (validation) ou de la liste blanche interne (Git, Claude Code) | Exécution commande | interdit | non | seules les commandes de validation viennent du profil ; les commandes internes (Git, Claude Code) viennent d'une liste blanche interne fermée, jamais du profil ni d'une entrée libre | rejet immédiat, aucune exécution |
| `shell: true` | Exécution commande | interdit | non | `shell: false` obligatoire par défaut | rejet de la configuration d'exécution |
| `Invoke-Expression` | Exécution commande | interdit | non | commande explicitement bannie | rejet immédiat |
| Commande contenant `;`, `&&`, `\|\|`, pipe ou redirection | Exécution commande | interdit | non | commande et arguments doivent rester séparés, sans composition shell | rejet immédiat |
| `git status --short` | Lecture Git | autorisé | non | — | erreur consignée si Git indisponible |
| `git diff --check` | Lecture Git | autorisé | non | — | erreur consignée si Git indisponible |
| `git add .` | Staging Git | interdit | non | staging explicite obligatoire | rejet immédiat |
| Ajout explicite d'un fichier | Staging Git | autorisé sous conditions | oui (validation de la liste proposée) | fichier listé, non sensible (section 13 des règles) | rejet si fichier sensible détecté ou hors périmètre |
| Commit | Écriture Git | autorisé sous conditions | oui, approbation dédiée | liste de fichiers et message approuvés | aucune commande de commit exécutée si refusé |
| Amend | Écriture Git | interdit | non | chaque commit approuvé est un nouveau commit | rejet immédiat |
| Push | Écriture Git | autorisé sous conditions | oui, approbation séparée du commit | branche, remote et commit affichés avant décision | workflow reste en état commité non poussé si refusé |
| Force push | Écriture Git | interdit | non | `--force` et `--force-with-lease` bannis | rejet immédiat |
| Rebase | Écriture Git | hors périmètre V1 | — | gestion avancée des branches exclue de la V1 | non applicable |
| Merge | Écriture Git | hors périmètre V1 | — | gestion avancée des branches exclue de la V1 | non applicable |
| Reset hard | Écriture Git | interdit | non | commande explicitement bannie | rejet immédiat |
| Clean (`-fd`, `-fdx`) | Écriture Git | interdit | non | commande explicitement bannie | rejet immédiat |
| Tag | Écriture Git | hors périmètre V1 | — | création automatique de tags exclue de la V1 | non applicable |
| Changement de branche | Écriture Git | interdit | non | aucun changement de branche automatique | rejet immédiat |
| Stockage d'une clé API en base | Secrets | interdit | non | SQLite ne stocke aucun secret | rejet de l'écriture, erreur bloquante |
| Journalisation d'un secret | Secrets | interdit | non | filtrage des motifs sensibles avant journalisation | valeur masquée dans le journal |
| Reprise automatique d'une commande interrompue | Reprise | interdit | non | l'état réel doit être vérifié avant toute reprise | aucune reprise tant que la vérification n'est pas faite |
| Libération automatique d'un verrou retrouvé après redémarrage | Reprise / Concurrence | interdit | non | vérification obligatoire des processus, de Git et des artefacts avant toute libération | verrou maintenu tant que la vérification n'est pas faite |
| Annulation | Contrôle d'exécution | autorisé | non (initiée par l'utilisateur) | exécution en cours uniquement ; arrêt propre puis délai de grâce puis arrêt forcé si nécessaire | exécution marquée interrompue, sorties partielles conservées, non assimilée à un succès |
| Relance d'une commande échouée | Contrôle d'exécution | autorisé sous conditions | oui, décision explicite de relance | état réel vérifié avant relance | nouvelle exécution journalisée comme tentative distincte |
| Modification du profil pendant un workflow actif | Configuration | interdit | non | empreinte du profil capturée au démarrage ; toute modification détectée bloque la suite et invalide les approbations concernées | workflow bloqué jusqu'à revalidation complète du profil et nouvelles approbations |
| Dépassement de la taille maximale configurée pour stdout/stderr | Affichage / sorties | autorisé sous conditions | non | troncature explicite avec indicateur visible, jamais silencieuse | sortie tronquée conservée et signalée comme telle |
| Affichage de sorties stdout/stderr non échappées ou interprétées comme HTML | Affichage / sorties | interdit | non | sorties toujours échappées et affichées comme texte brut | rejet du mode d'affichage non conforme |
| Suppression d'un artefact | Gestion des artefacts | interdit | non | aucun artefact historisé n'est supprimé automatiquement | rejet immédiat de toute suppression automatique |
| Clôture d'un workflow commité mais non poussé | Clôture de workflow | autorisé | non (état déjà validé par le refus de push) | push refusé explicitement par l'utilisateur | workflow clôturé dans un état stable, non considéré comme un échec |
