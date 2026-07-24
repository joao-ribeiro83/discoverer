# Journalisation d'audit

Découvrez la piste d'audit de Discoverer Neo et comment examiner les activités du système.

## Qu'est-ce que la journalisation d'audit ?

La **journalisation d'audit** enregistre toutes les activités importantes du système — modifications de métadonnées, exécutions de cartes, connexions/déconnexions des utilisateurs, octrois/révocations d'autorisations et tâches d'exportation.

Chaque événement d'audit comprend :
- **Horodatage** — Quand l'activité s'est produite
- **Utilisateur** — Qui a effectué l'action
- **Action** — Ce qui s'est passé (CREATE, UPDATE, DELETE, EXECUTE)
- **Entité** — Ce qui a été affecté (MAP, BUSINESS_AREA, USER, etc.)
- **Modifications** — Détails de ce qui a changé (pour les mises à jour)

## Accéder aux journaux d'audit

### Consulter le journal d'audit

1. Panneau d'administration → **Journal d'audit**
2. Consultez la liste paginée des événements récents (les plus récents en premier)
3. Filtrez par :
   - **Plage de dates** — Date de début et de fin
   - **Utilisateur** — Filtrer par auteur de l'action
   - **Type d'entité** — Filtrer par élément affecté
   - **Action** — CREATE, UPDATE, DELETE, EXECUTE, GRANT, etc.
4. Cliquez sur un événement pour afficher tous les détails

### Détails d'un événement

Cliquer sur un événement affiche :

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-07-19T12:15:30Z",
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "userEmail": "alice@example.com",
  "action": "CREATE",
  "entityType": "MAP",
  "entityId": "550e8400-e29b-41d4-a716-446655440100",
  "entityName": "Q3 Sales Report",
  "changes": {
    "name": "Q3 Sales Report",
    "mapType": "TABLE",
    "businessAreaId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

## Types d'événement

### Modifications de métadonnées

| Entité | Actions |
|--------|---------|
| BUSINESS_AREA | CREATE, UPDATE, DELETE |
| FOLDER | CREATE, UPDATE, DELETE |
| ITEM | CREATE, UPDATE, DELETE |
| JOIN | CREATE, UPDATE, DELETE |
| HIERARCHY | CREATE, UPDATE, DELETE |
| CUSTOM_FUNCTION | CREATE, UPDATE, DELETE |

### Cycle de vie des cartes

| Entité | Actions |
|--------|---------|
| MAP | CREATE, UPDATE, DELETE, DUPLICATE |
| MAP_EXECUTION | EXECUTE, CANCEL |
| MAP_SHARE | GRANT, REVOKE |

### Gestion des utilisateurs et des autorisations

| Entité | Actions |
|--------|---------|
| USER | CREATE, UPDATE, DELETE |
| BUSINESS_AREA_GRANT | GRANT, REVOKE, UPDATE |
| SECURITY_POLICY | CREATE, UPDATE, DELETE |

### Données et tâches

| Entité | Actions |
|--------|---------|
| EXPORT | CREATE, START, COMPLETE, FAIL, DELETE |
| SCHEDULE | CREATE, UPDATE, DELETE, EXECUTE |

### Authentification

| Entité | Actions |
|--------|---------|
| LOGIN | LOGIN, LOGOUT |
| TOKEN | REFRESH, BLACKLIST |

## Requêtes courantes

### Qui a modifié cette carte ?

1. Filtrez par type d'entité : MAP
2. Recherchez par nom ou ID de carte
3. Consultez les événements CREATE → UPDATE

### Suivre les modifications d'autorisations

1. Filtrez par type d'entité : BUSINESS_AREA_GRANT
2. Filtrez par utilisateur si nécessaire
3. Consultez qui a accordé/révoqué des autorisations et quand

### Trouver les exportations en échec

1. Filtrez par type d'entité : EXPORT
2. Recherchez les actions FAIL
3. Consultez les détails de l'erreur

### Historique d'exécution

Pour les exécutions d'une carte spécifique :

1. Ouvrez la carte → onglet **Historique** (sur la page de la carte, pas dans le journal d'audit)
2. Consultez les durées d'exécution, le nombre de lignes et l'état

(Le journal d'audit affiche les CREATE/UPDATE sur les cartes ; l'historique d'exécution affiche les événements EXECUTE.)

### Utilisateurs créés sur une plage de dates

1. Filtrez par type d'entité : USER
2. Filtrez par action : CREATE
3. Filtrez par plage de dates
4. Consultez tous les nouveaux comptes créés

## Conservation des audits

Les journaux d'audit sont conservés indéfiniment (dans la base de données PostgreSQL).

**Sauvegarde :** les journaux d'audit sont inclus dans les sauvegardes de la base de données (voir le [Guide de sauvegarde](../../deployment/backup.md)).

**Exportation :** pour exporter les journaux d'audit à des fins d'analyse :

```bash
# Use API to fetch logs
curl -X GET "http://localhost:3000/api/audit?limit=10000" \
  -H "Authorization: Bearer $TOKEN" > audit-logs.json

# Parse with jq or import to Excel
jq '.data[] | {timestamp, user: .userEmail, action, entity: .entityType}' audit-logs.json
```

## Considérations de sécurité

### Contrôle d'accès

Seuls les utilisateurs **ADMIN** peuvent consulter les journaux d'audit. Les non-administrateurs ne peuvent pas accéder à cette fonctionnalité.

### Manipulation du journal d'audit

Les journaux d'audit sont en ajout seul ; les événements ne peuvent pas être supprimés ni modifiés (hormis la suppression de l'intégralité de la base de données, ce qui n'est pas envisageable en production).

### Données sensibles

Les journaux d'audit contiennent :
- Les adresses e-mail et noms des utilisateurs
- Les définitions de cartes (requêtes)
- Les noms/valeurs de paramètres (peuvent inclure des dates, des régions)
- Mais PAS : les mots de passe de base de données (stockés chiffrés, non journalisés)

Soyez prudent avec les journaux d'audit contenant des données métier sensibles.

## Cas d'usage

### Audit de conformité

Suivez qui a accédé à quelles données et quand :

1. Filtrez les événements EXECUTION
2. Consultez quels utilisateurs ont exécuté quelles cartes
3. Exportez vers une base de données de conformité

### Investigation d'incidents

« Cette carte a cessé de fonctionner le 15 juillet » :

1. Examinez les mises à jour MAP autour du 15 juillet
2. Consultez qui l'a modifiée et ce qui a changé
3. Comprenez l'impact

### Surveillance de l'activité des utilisateurs

« Suivre les connexions et déconnexions des utilisateurs » :

1. Filtrez par type d'entité : LOGIN
2. Consultez les événements d'authentification avec horodatage
3. Identifiez les schémas d'activité inhabituels

### Audits d'autorisations

« Qui dispose de l'autorisation CREATE dans le domaine Finance ? » :

1. Filtrez par type d'entité : BUSINESS_AREA_GRANT
2. Filtrez par nom de BUSINESS_AREA : Finance
3. Consultez tous les octrois d'accès et leurs bénéficiaires

## Bonnes pratiques

1. **Révision régulière** — Vérifiez les journaux d'audit chaque semaine pour détecter les anomalies
2. **Sauvegardez les journaux d'audit** — Incluez-les dans les sauvegardes de la base de données
3. **Alertez sur les actions critiques** — Mettez en place une surveillance des opérations sensibles
4. **Archivez les anciens journaux** — Exportez les journaux de plus d'un an pour archivage
5. **Limitez l'accès** — Seuls les administrateurs doivent accéder aux journaux d'audit
6. **Documentez les stratégies** — Consignez votre processus de révision d'audit

## Performances

La journalisation d'audit a un impact minimal sur les performances :
- Les événements sont écrits de manière asynchrone
- Indexés par horodatage et utilisateur pour des requêtes rapides
- Ne bloque pas les opérations des utilisateurs

Les requêtes volumineuses sur le journal d'audit (> 100 000 événements) peuvent être lentes. Utilisez des filtres de plage de dates.

## Dépannage

### Événements d'audit manquants

Si vous attendez un événement mais ne le voyez pas :

- Vérifiez le filtre de plage de dates
- Vérifiez l'orthographe de l'e-mail de l'utilisateur
- Confirmez le nom du type d'entité
- Vérifiez que l'événement s'est bien produit (actualisez la page)

### Journal d'audit lent

Pour les très grandes tables d'audit (des millions d'événements) :

1. Archivez les anciens événements :
   ```bash
   curl -X GET "http://localhost:3000/api/audit?startDate=2026-01-01&endDate=2026-06-30&limit=100000" \
     -H "Authorization: Bearer $TOKEN" > archive.json
   ```

2. Demandez au DBA d'analyser les statistiques de la table

## Intégration

Exportez les événements d'audit vers des systèmes externes :

```bash
# Fetch audit events as JSON
curl -X GET "http://localhost:3000/api/audit?limit=1000" \
  -H "Authorization: Bearer $TOKEN" | \
  jq '.data[] | {timestamp, userEmail, action, entityType, entityName}' | \
  # Pipe to your logging system (ELK, Splunk, etc.)
```

## Et ensuite ?

- **[Gestion des utilisateurs](user-management.md)** — Gérer les comptes utilisateurs
- **[Stratégies de sécurité](security.md)** — Définir le contrôle d'accès
- **[Surveillance](../../deployment/monitoring.md)** — Santé et performances du système

---

**Voir aussi :** [Guide de l'administrateur](../admin-guide/), [Référence de l'API - Audit](../../api/endpoints.md#audit-logs)
