# Gestion des sources de données

Découvrez comment ajouter et gérer les connexions aux sources de données Oracle et PostgreSQL.

## Qu'est-ce qu'une source de données ?

Une **source de données** est une connexion nommée à une base de données Oracle ou PostgreSQL. Les dossiers des domaines d'activité référencent des sources de données afin de savoir où récupérer les données.

## Créer une source de données

### Ajouter une connexion Oracle

1. Panneau d'administration → **Sources de données**
2. Cliquez sur **+ Nouvelle source de données**
3. Sélectionnez **Oracle** comme type de connexion
4. Saisissez :
   - **Nom** — Identifiant unique (p. ex. « Production ERP »)
   - **Description** — Notes (facultatif)
   - **Hôte** — Nom d'hôte ou adresse IP du serveur
   - **Port** — Port du listener (par défaut : 1521)
   - **Service Name** ou **SID** — Identifiant de la base de données
   - **Nom d'utilisateur** — Utilisateur de la base de données (p. ex. EUL5_US)
   - **Mot de passe** — Mot de passe de la base de données
5. Cliquez sur **Tester la connexion** pour vérifier
6. Cliquez sur **Créer**

### Ajouter une connexion PostgreSQL

1. Panneau d'administration → **Sources de données**
2. Cliquez sur **+ Nouvelle source de données**
3. Sélectionnez **PostgreSQL** comme type de connexion
4. Saisissez :
   - **Nom** — Identifiant unique
   - **Description** — Notes (facultatif)
   - **Hôte** — Nom d'hôte ou adresse IP du serveur
   - **Port** — Par défaut : 5432
   - **Base de données** — Nom de la base de données
   - **Nom d'utilisateur** — Utilisateur de la base de données
   - **Mot de passe** — Mot de passe de la base de données
5. Cliquez sur **Tester la connexion**
6. Cliquez sur **Créer**

## Détails de connexion Oracle

### Mode Thin (par défaut)

Le mode Thin se connecte sans Oracle Instant Client :

- **Avantages :** aucune installation de client, plus léger, Node.js pur
- **Inconvénients :** impossible de se connecter à des bases de données antérieures à la version 12.1
- **Idéal pour :** Oracle 12.1+ moderne

**Aucune configuration nécessaire.** Le mode Thin est le mode par défaut.

### Mode Thick (hérité)

Le mode Thick nécessite Oracle Instant Client pour les bases de données héritées :

- **Avantages :** prend en charge Oracle 11.2+, active le nommage LDAP et le chiffrement réseau
- **Inconvénients :** nécessite l'installation d'Instant Client, empreinte plus importante
- **Idéal pour :** bases de données Oracle 11.2–12.0 plus anciennes, nécessite sqlnet.ora

**Pour activer le mode Thick :**

1. Générez l'image Docker avec le client :
   ```bash
   docker compose build --build-arg INSTALL_ORACLE_CLIENT=true backend
   ```

2. Définissez la variable d'environnement :
   ```bash
   ORACLE_THICK_MODE=true
   ORACLE_CLIENT_PATH=/opt/oracle/instantclient
   ```

3. Le backend vérifie que le client est installé et refuse de démarrer s'il est introuvable

## Regroupement de connexions

Discoverer Neo maintient un pool de connexions par source de données :

**Configuration du pool** (variables d'environnement) :
- `ORACLE_POOL_MIN` — Nombre minimal de connexions inactives (par défaut : 2)
- `ORACLE_POOL_MAX` — Nombre maximal de connexions (par défaut : 10)
- `ORACLE_POOL_INCREMENT` — Nouvelles connexions par allocation (par défaut : 1)
- `ORACLE_POOL_IDLE_TIMEOUT_SECONDS` — Délai d'inactivité (par défaut : 300)

**Recommandations de dimensionnement du pool :**

Avec 4 sources de données Oracle, chacune configurée avec `ORACLE_POOL_MAX=10` :
- Un maximum de 40 connexions simultanées est possible
- Doit rester dans les limites `sessions`/`processes` de la base de données

Dimensionnez en fonction des **exécutions de cartes simultanées** attendues, et non des utilisateurs :
- Chaque exécution de carte mobilise 1 connexion pendant la durée de la requête
- Les exportations mobilisent 1 connexion pendant toute leur durée (plusieurs minutes)
- Déploiement typique : 2 à 10 au maximum par source

### Ajuster la taille du pool

Pour augmenter la limite de connexions (si la base de données le permet) :

1. Modifiez `.env` :
   ```bash
   ORACLE_POOL_MAX=20
   ```

2. Augmentez les limites de la base de données :
   ```sql
   ALTER SYSTEM SET processes=300;  # Default often 150
   ```

3. Redémarrez le backend :
   ```bash
   docker compose restart backend
   ```

## Tester la connexion

Après avoir créé une source de données, testez la connectivité :

1. Cliquez sur la source de données → **Tester la connexion**
2. État affiché :
   - ✓ **Connecté** — Connexion réussie
   - ✗ **Échec** — Message d'erreur affiché

**Erreurs courantes :**

- **Hôte inaccessible** — Vérifiez le réseau, le pare-feu, le nom d'hôte
- **Identifiants non valides** — Vérifiez le nom d'utilisateur/mot de passe
- **Base de données introuvable** — Vérifiez l'orthographe du service name/SID
- **Listener non démarré** — Redémarrez le listener Oracle

## Modifier une source de données

1. Cliquez sur la source de données → **Modifier**
2. Modifiez un champ quelconque (le mot de passe peut être laissé vide pour conserver l'existant)
3. Cliquez sur **Enregistrer**

**Remarque :** modifier les détails de connexion peut casser les dossiers existants s'ils ne peuvent plus accéder aux données. Testez avec prudence.

## Désactiver une source de données

Basculez **Actif** pour désactiver temporairement :

- **Désactivé** — Les dossiers ne peuvent pas récupérer de données depuis cette source
- **Activé** — Les dossiers peuvent récupérer normalement

Utile pour la maintenance sans supprimer la source.

## Supprimer une source de données

1. Cliquez sur la source de données → **Supprimer**
2. Confirmez

Tout dossier utilisant cette source ne peut plus s'exécuter. Les cartes deviennent inutilisables.

## Chiffrement des connexions

Les mots de passe sont chiffrés au repos à l'aide d'AES-256-GCM :

- **Clé :** variable d'environnement `ENCRYPTION_KEY` (32 caractères minimum)
- **Stockage :** chiffré dans la base de données PostgreSQL
- **Transmission :** utilisez toujours HTTPS en production

Changer la clé de chiffrement :

1. Définissez une nouvelle `ENCRYPTION_KEY` dans l'environnement
2. Redémarrez le backend
3. Le backend rechiffre automatiquement tous les mots de passe stockés

**Important :** si vous perdez la clé de chiffrement, les mots de passe stockés deviennent irrécupérables. Sauvegardez les clés de chiffrement de manière sécurisée.

## Surveiller l'état des connexions

Vérifiez l'état du pool de connexions dans la surveillance :

- **Métriques :** point de terminaison `/metrics`
- **Jauge :** `oracledb_pool_connections_active`, `oracledb_pool_connections_idle`
- **Utilisation :** surveillance Prometheus (voir [Guide de surveillance](../../deployment/monitoring.md))

## Importation en masse (migration)

Lors de la migration depuis Oracle Discoverer :

1. Utilisez l'interface en ligne de commande `dn-migrate` pour importer les métadonnées de l'EUL
2. Créez des sources de données pour toutes les sources référencées
3. Importez les domaines d'activité, dossiers et éléments à l'aide de l'outil de migration

Consultez le [Guide de migration](../../migration/).

## Connectivité réseau

### Règles de pare-feu

Assurez la connectivité réseau :
- Backend → Oracle : port 1521 (Oracle par défaut)
- Backend → PostgreSQL : port 5432 (PostgreSQL par défaut)

### Résolution DNS

Si vous utilisez des noms d'hôte, vérifiez le DNS :
```bash
# Test from backend container
docker compose exec backend nslookup oracle.example.com
```

### Tunnellisation SSH

Pour des connexions sécurisées via SSH :

1. Établissez un tunnel entre le backend et l'hôte de la base de données :
   ```bash
   ssh -L 1521:oracle-internal:1521 bastion-host
   ```

2. Utilisez `localhost:1521` dans la chaîne de connexion

3. Maintenez le tunnel actif (une politique de redémarrage peut être nécessaire)

## Sauvegarde et restauration

Les sources de données sont stockées dans PostgreSQL. Consultez le [Guide de sauvegarde](../../deployment/backup.md).

Pour restaurer :
1. Restaurez la base de données PostgreSQL
2. Les sources de données sont automatiquement récupérées
3. Les tests de connexion fonctionnent si le réseau vers les sources est disponible

## Dépannage

### Pool de connexions épuisé

**Erreur :** « Connection timeout waiting for a connection »

**Causes :**
- Trop de requêtes ou d'exportations simultanées
- Taille de pool trop petite
- Limite de connexions de la base de données atteinte

**Solution :**
1. Augmentez `ORACLE_POOL_MAX` (et les `sessions` de la base de données)
2. Réduisez le nombre de tâches d'exportation simultanées (`EXPORT_WORKER_CONCURRENCY`)
3. Optimisez les requêtes lentes

### Connexions obsolètes

**Erreur :** « Connection reset by peer »

**Cause :** la base de données a fermé des connexions inactives ; le pool ne l'a pas détecté

**Solution :**
- Réduisez `ORACLE_POOL_IDLE_TIMEOUT_SECONDS`
- Redémarrez le backend (recycle le pool)

## Et ensuite ?

- **[Introspection Oracle](oracle-introspection.md)** — Importer automatiquement des tables
- **[Gestion des métadonnées](metadata-management.md)** — Organiser les dossiers et les éléments
- **[Stratégies de sécurité](security.md)** — Définir la sécurité au niveau des lignes

---

**Voir aussi :** [Guide de l'administrateur](../admin-guide/), [Configuration du déploiement](../../deployment/configuration.md)
