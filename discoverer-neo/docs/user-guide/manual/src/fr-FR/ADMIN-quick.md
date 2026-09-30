# Votre rôle en une page

Vous êtes **administrateur**. Vous pouvez utiliser toutes les pages. Une **carte** est un rapport (dans Oracle Discoverer, une feuille de calcul). Un **domaine d'activité** est un groupe de données liées.

| Vous pouvez | Vous ne pouvez pas |
|---|---|
| Ouvrir, modifier, partager, copier et supprimer toutes les cartes | Supprimer ou désactiver votre propre compte |
| Créer des cartes partout, sans droit d'accès | Télécharger l'exportation d'un autre utilisateur |
| Voir le SQL et le plan d'une carte | Voir les planifications des autres utilisateurs dans la liste |
| Voir les exécutions de tous les utilisateurs | |
| Configurer les domaines d'activité, dossiers, éléments, jointures, hiérarchies, fonctions et sources de données | |
| Gérer les utilisateurs, les accès et les stratégies de sécurité | |
| Consulter le journal d'audit et lancer des migrations | |

**Connexion :** saisissez **E-mail** et **Mot de passe**, puis cliquez sur **Se connecter**. Pour vous déconnecter, utilisez **Se déconnecter** dans le menu de votre nom. Dans **Paramètres** (langue, thème, palette), cliquez sur **Enregistrer** pour conserver vos choix.

![La page de connexion avec E-mail, Mot de passe, Rester connecté et le bouton Se connecter.](shots/fr-FR/common/01-login.png)

---

# Tableau de bord et cartes

Le **Tableau de bord** compte les cartes, les exécutions et vos planifications. **Cartes** liste toutes les cartes du système.

![La liste Cartes, onglet Tous, avec toutes les icônes de ligne et la section Classeurs au-dessus.](shots/fr-FR/admin/02-maps-all.png)

1. Ouvrez **Cartes**. Utilisez les onglets **Mes cartes**, **Partagées avec moi**, **Tous**.
2. Trouvez une carte avec la zone de recherche ou le filtre **Domaine Métier**.
3. Cliquez sur l'icône en forme d'œil pour l'exécuter, sur le crayon pour la modifier.
4. Cliquez sur l'icône Partager pour donner un accès.
5. Cliquez sur l'icône de corbeille pour supprimer (seul un administrateur peut restaurer).

| Choix | Signification |
|---|---|
| **Peut consulter** | Ouvrir et exécuter seulement. |
| **Peut exporter** | Exporter et planifier également. |
| **Peut modifier** | Modifier aussi la carte. Ne peut pas la repartager. |
| Icône Copier | Votre propre copie privée. |

---

# Créateur de cartes et visionneuse

Le créateur fabrique une carte. La visionneuse l'exécute.

![Les résultats d'exécution avec les boutons SQL et Plan à côté des boutons Excel, CSV et PDF.](shots/fr-FR/admin/03-viewer-results.png)

1. Cliquez sur **Créer une carte**.
2. Faites glisser des éléments de l'arborescence **Domaines d'activité** vers la zone de travail. Le premier élément fixe le domaine d'activité.
3. Cliquez sur une colonne pour définir l'**Agrégation**, le tri ou le format.
4. Ajoutez des **Conditions**, des **Paramètres** ou des **Champs calculés** dans les onglets de droite si besoin.
5. Cliquez sur **Enregistrer**, puis sur **Exécuter**.
6. Exportez avec **Excel**, **CSV** ou **PDF**. Vous voyez aussi **SQL** et **Plan**.

| Choix | Signification |
|---|---|
| **Public** (Propriétés) | Tout utilisateur connecté peut l'ouvrir et l'exporter. |
| **Agrégation** | NONE, SUM, COUNT, AVG, MIN, MAX. |
| **Exécuter à nouveau** (visionneuse) | Nouvelle exécution, sans utiliser le résultat stocké. |
| **PDF** | Choisissez le papier (A4, A3, Lettre) et l'orientation. |

---

# Exécutions, exportations et planifications

Une **exécution** est un lancement d'une carte (conservée 24 heures). Une **exportation** est un fichier créé à partir d'une exécution (conservé 7 jours). Une **planification** lance une carte automatiquement.

![La page Exécutions avec les exécutions de tous les utilisateurs affichées.](shots/fr-FR/admin/04-runs-every-user.png)

1. Dans **Exécutions**, cochez **Afficher les exécutions de tous les utilisateurs** pour voir celles de tout le monde.
2. Cliquez sur **Ouvrir** pour voir un résultat, ou sur **XLSX**, **CSV**, **PDF** pour l'exporter.
3. Dans **Exportations**, cliquez sur l'icône Télécharger. Vous ne voyez que vos propres fichiers.
4. Dans **Planifications**, cliquez sur **Nouvelle planification**. Choisissez la carte, la **Fréquence**, le **Fuseau horaire** et le **Format de sortie**. Cliquez sur **Enregistrer**.
5. Utilisez **Historique** pour ouvrir ou exporter d'anciens résultats.

| Choix | Signification |
|---|---|
| **Fréquence** | **Tous les jours (minuit)**, **Toutes les semaines (dimanche, minuit)**, **Tous les mois (le 1er, minuit)**, **Personnalisé** (cron). |
| **Format de sortie** | **Excel (.xlsx)** ou **CSV**. |
| **Exécuter maintenant** | Lance une planification immédiatement. |

---

# Domaines d'activité et accès

Un domaine d'activité regroupe des dossiers. Un **accès** donne à une personne le droit d'utiliser ses données. Un accès n'affiche jamais une carte.

![La boîte de dialogue Gérer les accès avec la liste Autorisation ouverte.](shots/fr-FR/admin/09-business-areas-grants-permission.png)

1. Ouvrez **Domaines d'activité**. Cliquez sur **Nouveau domaine d'activité**, saisissez un **Nom**, cliquez sur **Enregistrer**.
2. Cliquez sur l'icône **Gérer les accès**.
3. Cochez les personnes. Choisissez l'**Autorisation**. Cliquez sur **Ajouter**.
4. Cliquez sur **Révoquer** pour retirer un accès.

| Niveau | Signification |
|---|---|
| VIEW | Lire les données, exécuter les cartes partagées. |
| EXPORT, SCHEDULE | Identique à VIEW. Les droits dépendent du partage de la carte. |
| CREATE | Créer aussi des cartes, dossiers, éléments, jointures, hiérarchies. |
| EDIT | Modifier aussi le domaine et ses objets. |
| DELETE | Supprimer aussi ces objets. |

Un Manager ne modifie jamais le modèle. Pour un Manager, CREATE et au-dessus lui permettent seulement de créer des cartes.

---

# Dossiers, éléments, jointures, hiérarchies

Un **dossier** est une table ou une vue. Un **élément** est une colonne. Une **jointure** relie deux dossiers. Une **hiérarchie** est une liste d'exploration par niveaux.

![La boîte de dialogue Nouveau dossier après Découvrir les tables, listant les tables trouvées.](shots/fr-FR/admin/14-folders-discovered.png)

1. Choisissez un domaine d'activité dans **Dossiers**. Cliquez sur **Nouveau dossier**.
2. Choisissez la **Source de données**, cliquez sur **Découvrir les tables**, cliquez sur une table.
3. Cochez les colonnes à créer comme éléments. Cliquez sur **Enregistrer**.
4. Dans **Jointures**, cliquez sur **Nouvelle jointure**. Choisissez deux dossiers, cliquez sur **Suggérer des jointures**, choisissez un **Type de jointure**. Cliquez sur **Enregistrer**.
5. Dans **Hiérarchies**, cliquez sur **Nouvelle hiérarchie**, ajoutez les niveaux de haut en bas. Cliquez sur **Enregistrer**.
6. Utilisez **Tout actualiser** pour relire les tables après un changement de la base de données.

| Choix | Signification |
|---|---|
| **Type de dossier** | TABLE, VIEW, DERIVED, COMPLEX, JOIN, SUMMARY. |
| **Type de jointure** | INNER, LEFT, RIGHT. |
| **Type d'élément** | Élément de base de données (CO), Élément créé (CI), Élément calculé (CU), Élément de jointure (JI), Élément de hiérarchie (HI), Agrégation (AG), Fonction (FU). |

---

# Fonctions personnalisées et sources de données

Une **source de données** est une connexion enregistrée à une base de données. Une **fonction personnalisée** est une fonction Oracle que les éléments calculés peuvent appeler.

![La page Sources de données avec un tableau de connexions et cinq icônes de ligne.](shots/fr-FR/admin/30-data-sources.png)

1. Dans **Sources de données**, cliquez sur **Nouvelle source de données**. Remplissez **Nom**, **Type de connexion**, **Hôte**, **Port**, **Nom d'utilisateur**, **Mot de passe**. Cliquez sur **Enregistrer**.
2. Cliquez sur **Tester la connexion**.
3. Cliquez sur **Importer des tables** pour créer de nombreux dossiers d'un coup.
4. Dans **Fonctions personnalisées**, cliquez sur **Nouvelle fonction**. Choisissez la source de données, recherchez dans Oracle, cliquez sur un résultat. Cliquez sur **Enregistrer**.

| Choix | Signification |
|---|---|
| **Type de connexion** | **Oracle** ou **PostgreSQL**. |
| **Type de fonction** | SQL, PLSQL, PACKAGE. |
| **Tout actualiser** | Relit les fonctions depuis Oracle. |

---

# Utilisateurs

Ajoutez des personnes, définissez des rôles, désactivez des comptes, confiez des cartes à d'autres.

![La page Utilisateurs avec les boutons Fichier d'identifiants et Nouvel utilisateur et les icônes de ligne.](shots/fr-FR/admin/35-users.png)

1. Cliquez sur **Nouvel utilisateur**. Saisissez **Nom**, **E-mail**, **Mot de passe** (8 caractères ou plus), choisissez le **Rôle**. Cliquez sur **Enregistrer**.
2. Cliquez sur **Fichier d'identifiants** pour remettre des mots de passe temporaires aux comptes migrés. Ne remettez à chaque personne que sa propre ligne.
3. Cliquez sur l'icône **Cartes que cet utilisateur peut ouvrir** pour voir ce qu'il voit. Modifiez un niveau de partage ou donnez une carte à un **Nouveau propriétaire**.
4. Pour bloquer l'accès, cliquez sur **Désactiver**. Cliquez sur **Activer** pour annuler.

| Choix | Signification |
|---|---|
| ADMIN | Tous les droits. |
| MANAGER | Voit, exécute, exporte, planifie et partage toutes les cartes. Modifie les comptes MANAGER, USER et VIEWER. Ne modifie jamais le modèle de données, les fonctions personnalisées ni les sources de données. |
| USER | Ses cartes, les cartes publiques et les cartes partagées. |
| VIEWER | Comme USER, mais ne peut pas copier de cartes. |
| **Désactiver** | Conserve le compte. Réversible. |
| **Supprimer** | Supprime le compte définitivement. Irréversible. |

---

# Stratégies de sécurité et journal d'audit

Une **stratégie** filtre les lignes que les personnes voient. Le **Journal d'audit** montre qui a fait quoi.

![La boîte de dialogue Nouvelle stratégie avec un nom, une description et une règle.](shots/fr-FR/admin/44-security-new-dialog.png)

1. Dans **Sécurité**, cliquez sur **Nouvelle stratégie**. Saisissez un **Nom**.
2. Choisissez **S'applique à** (**Domaine d'activité** ou **Dossier**) et la cible.
3. Saisissez le **Prédicat SQL**, par exemple `{alias}.REGION = 'NORTH'`. Cliquez sur **Valider**. Cliquez sur **Enregistrer**.
4. Cliquez sur l'icône **Attributions**. Choisissez **Utilisateur** ou **Rôle**. Cliquez sur **Attribuer**.
5. Dans **Journal d'audit**, filtrez par **Utilisateur**, **Action** ou **De**/**À**. Cliquez sur une icône **Afficher les détails** pour voir l'entrée complète.

> **Attention :** un dossier sans stratégie suit un réglage de l'installation. En mode **fermé** (par défaut), personne ne voit ses lignes, vous compris. En mode **ouvert**, tous ceux qui ont un accès voient toutes les lignes.

---

# Migration

La **Migration** importe un EUL Oracle Discoverer (ses domaines d'activité, dossiers, classeurs et utilisateurs stockés). Elle écrit beaucoup de données dans cette base.

![La page Migration avec la carte Source, ses boutons et son texte d'aide.](shots/fr-FR/admin/50-migration.png)

1. Enregistrez la connexion Oracle dans **Sources de données**.
2. Dans **Migration**, choisissez la **Source de données Oracle**. Cliquez sur **Détecter la version**, puis sur **Analyser**.
3. Laissez **Simulation** cochée. Cliquez sur **Lancer une simulation**. Lisez le rapport et le journal.
4. Décochez **Simulation** et cliquez sur **Lancer la migration**.
5. Dans **Utilisateurs**, cliquez sur **Fichier d'identifiants** pour que les personnes migrées puissent se connecter.
6. Déplacez les cartes de « Migrated Workbooks » vers le bon domaine d'activité.

| Choix | Signification |
|---|---|
| **Réimporter les cartes** | Reconstruit uniquement les cartes. Remplace toutes les cartes de « Migrated Workbooks ». Les modifications, planifications et partages de ces cartes sont perdus. |
| **Tout réimporter** | Réécrit ce qui diffère. Ne supprime rien. Conserve les identifiants, planifications et partages. |
| **Compiler les champs calculés** | À utiliser si une carte indique qu'un champ « n'a pas été compilé ». |

> **Attention :** faites toujours une simulation d'abord.
