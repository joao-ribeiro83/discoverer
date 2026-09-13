# Signaler une erreur : l'identifiant de corrélation

Une véritable erreur (un panneau **rouge** — voir [Exécution des cartes](../user-guide/executing-maps.md) ;
un panneau ambre de refus est différent, voir [Pourquoi une feuille de calcul a été refusée](refusals.md))
comporte désormais un `correlationId` accompagnant son message :

```json
{
  "error": "The query could not be completed.",
  "statusCode": 500,
  "kind": "QUERY",
  "correlationId": "8f14e45f-ceea-467e-a4d6-f8c9d1e2b3a4"
}
```

Le message affiché est délibérément générique — pour un échec d'exécution de carte, il ne contient jamais le texte d'erreur propre à la base de données (un message `ORA-` d'Oracle peut décrire des détails internes du schéma ou des données qui ne devraient pas atteindre chaque utilisateur pouvant exécuter une carte). Le détail complet — l'erreur réelle du pilote, le SQL, la pile d'appels — est conservé côté serveur, marqué avec le même identifiant.

**Lors du signalement d'une erreur, indiquez le `correlationId`.** Un administrateur peut retrouver la ligne de journal correspondante sur le serveur (ou, pour une exécution de carte asynchrone, l'identifiant du job lui-même sert aussi d'identifiant de corrélation) sans avoir besoin que le texte brut lui soit répété.

`kind` regroupe l'erreur selon sa nature (`CONFIG`, `CONNECT`, `TIMEOUT`, `QUERY`, `CANCELLED`, `FORBIDDEN`) — utile pour le tri du support avant même d'ouvrir un journal.
