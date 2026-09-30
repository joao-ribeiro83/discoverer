# Votre rôle en une page

Vous êtes **Manager**. Vous voyez, exécutez, exportez, planifiez et partagez toutes les cartes. Vous ne modifiez pas le modèle de données. C'est le travail d'un administrateur.

| Vous pouvez | Vous ne pouvez pas |
|---|---|
| Voir, exécuter, exporter et planifier toutes les cartes | Modifier ou supprimer une carte qui ne vous appartient pas (sauf si elle est partagée avec vous en **Peut modifier**) |
| Partager n'importe quelle carte et modifier n'importe quel partage | Voir le SQL ou le plan de la base de données |
| Copier n'importe quelle carte pour créer la vôtre | Créer des utilisateurs, des sources de données ou des domaines d'activité, ni donner des accès |
| Donner une carte à un nouveau propriétaire | Voir les exécutions, exportations ou planifications des autres |
| Gérer les fonctions personnalisées | Utiliser Sécurité, Journal d'audit ou Migration |
| Lire, tester et introspecter les sources de données | Importer des tables depuis une source de données |
| Créer des cartes sur les domaines d'activité où vous avez un accès | Modifier les domaines d'activité, dossiers, éléments, jointures ou hiérarchies |

> **Remarque :** **Domaines d'activité**, **Dossiers**, **Éléments**, **Jointures**, **Hiérarchies**, **Sécurité**, **Journal d'audit** et **Migration** sont réservés aux administrateurs. Ils ne figurent pas dans votre barre latérale.

Voir une carte ne donne pas accès à ses données. Une exécution exige un accès au domaine d'activité pour chaque dossier utilisé par la carte. Sans cet accès, vous obtenez **Exécution non autorisée**.

Connectez-vous avec votre **E-mail** et votre **Mot de passe**, puis cliquez sur **Se connecter**. Pour vous déconnecter, utilisez **Se déconnecter** dans le menu de votre nom.

---

# Cartes

La page **Cartes** liste toutes les cartes. Une carte est un rapport (une feuille de calcul dans Oracle Discoverer).

![La liste Cartes, onglet Tous, avec les icônes Copier, Partager, Planifier et Exporter sur chaque ligne.](shots/fr-FR/manager/02-maps-all.png)

1. Choisissez un onglet : **Mes cartes**, **Partagées avec moi** ou **Tous**.
2. Réduisez la liste avec **Rechercher des cartes par nom…** ou le filtre **Domaine Métier**.
3. Cliquez sur l'icône en forme d'œil pour ouvrir une carte et l'exécuter.
4. Cliquez sur l'icône Copier pour en faire votre propre copie. Elle reste privée.
5. Cliquez sur l'icône Partager pour donner accès à quelqu'un.

| Icône | Fonction |
|---|---|
| Crayon | Modifier la carte. Uniquement vos cartes ou les partages **Peut modifier**. |
| Corbeille | Supprimer. Uniquement vos cartes. Un administrateur doit la restaurer. |
| Calendrier | Planifier cette carte. |

---

# Partager une carte

Le partage décide de ce qu'une autre personne peut faire avec une carte.

![La boîte de dialogue Partager la carte avec une zone de recherche et les boutons Peut consulter, Peut exporter et Peut modifier.](shots/fr-FR/manager/03-share-dialog.png)

1. Cliquez sur l'icône Partager de la carte.
2. Recherchez une personne par nom ou e-mail.
3. Cliquez sur un niveau à côté de son nom. Le bouton foncé est son niveau actuel.
4. Cliquez sur le X à côté d'un nom pour retirer l'accès.

| Niveau | Signification |
|---|---|
| **Peut consulter** | Ouvrir et exécuter seulement. |
| **Peut exporter** | Exporter et planifier également. |
| **Peut modifier** | Modifier aussi la carte. |

---

# Consulter, exécuter et exporter

La visionneuse exécute une carte et affiche ses lignes. Elle ne modifie jamais la carte.

![Une exécution terminée avec les boutons Excel, CSV et PDF au-dessus de la grille de résultats.](shots/fr-FR/viewer/06-viewer-results.png)

1. Ouvrez la carte avec l'icône en forme d'œil.
2. Cliquez sur **Exécuter**. Répondez aux questions de **Paramètres d'exécution** si elles apparaissent.
3. Lisez les lignes. Cliquez sur un en-tête pour trier. Double-cliquez sur une ligne pour voir ses lignes brutes.
4. Cliquez sur **Excel**, **CSV** ou **PDF** pour exporter.
5. Retrouvez le fichier plus tard dans **Exportations**. Les fichiers sont conservés 7 jours.

Un résultat reste valable 24 heures. **Exécuter à nouveau** force une nouvelle exécution.

---

# Créateur de cartes

Utilisez le créateur pour créer ou modifier une carte. Vous ne pouvez enregistrer une nouvelle carte qu'avec un accès CREATE sur son domaine d'activité. Vous ne pouvez enregistrer une carte existante que si elle vous appartient ou si vous avez **Peut modifier**. Pour modifier la carte de quelqu'un d'autre, copiez-la d'abord.

![Le créateur de cartes avec l'arborescence Domaines d'activité, la zone Colonnes et le panneau Propriétés.](shots/fr-FR/user/05-builder-overview.png)

1. Cliquez sur **Créer une carte**, ou sur l'icône Crayon de votre propre carte.
2. Faites glisser des éléments de l'arborescence **Domaines d'activité** vers **Colonnes**. Toutes les colonnes doivent provenir d'un seul domaine d'activité.
3. Cliquez sur une colonne pour définir son **Agrégation**, son **Sens du tri** ou son **Masque de format**.
4. Utilisez si besoin les onglets **Conditions**, **Tri**, **Paramètres** et **Champs calculés**.
5. Cliquez sur **Enregistrer**, puis sur **Exécuter**. Rien ne s'enregistre automatiquement.

---

# Planifications

Une planification exécute une carte selon un calendrier et stocke le résultat. Vous ne voyez que vos propres planifications.

![La page Planifications avec une planification en pause et ses icônes d'action.](shots/fr-FR/user/38-schedules-list.png)

1. Dans **Cartes**, cliquez sur l'icône Calendrier de la carte. Pour planifier la carte de quelqu'un d'autre, utilisez cette icône.
2. Saisissez un **Nom**.
3. Choisissez la **Fréquence**, le **Fuseau horaire** et le **Format de sortie**.
4. Cliquez sur **Enregistrer**.
5. Cliquez sur **Exécuter maintenant** pour tester. Ouvrez **Historique** pour voir les résultats.

| Choix | Signification |
|---|---|
| **Tous les jours (minuit)**, **Toutes les semaines (dimanche, minuit)**, **Tous les mois (le 1er, minuit)** | Calendriers prêts à l'emploi. |
| **Personnalisé** | Votre propre expression cron à cinq champs. |
| **Excel (.xlsx)**, **CSV** | Format du résultat stocké. |

La planification s'exécute sous votre identité : vos accès décident donc des données qu'elle lit.

---

# Exécutions et exportations

**Exécutions** liste vos propres exécutions. **Exportations** liste vos propres fichiers d'exportation. Vous ne voyez pas ceux des autres.

![La page Exécutions avec les filtres Carte, Statut et Type et la liste des exécutions.](shots/fr-FR/manager/10-runs.png)

1. Cliquez sur **Exécutions** pour voir les exécutions en attente, en cours et terminées.
2. Cliquez sur l'icône **Ouvrir** pour voir un résultat stocké. Utilisez **Exécuter à nouveau** pour le refaire.
3. Cliquez sur **Annuler** sur une exécution en file d'attente pour l'arrêter.
4. Cliquez sur **Exportations**, puis sur l'icône **Télécharger** d'une ligne **Terminée**.

---

# Utilisateurs

La page **Utilisateurs** est en lecture seule pour vous. Vous pouvez lister les comptes et corriger l'accès aux cartes.

![La boîte de dialogue Cartes d'un utilisateur, avec les listes de niveau de partage et les icônes de propriétaire et de retrait.](shots/fr-FR/manager/11-users-maps-dialog.png)

1. Cliquez sur l'icône de ligne **Cartes que cet utilisateur peut ouvrir**.
2. Pour modifier une carte partagée, utilisez la liste de niveaux à côté d'elle.
3. Pour retirer une carte partagée, cliquez sur le X.
4. Pour transmettre une carte, cliquez sur l'icône de propriétaire et choisissez le **Nouveau propriétaire**.

> **Attention :** le nouveau propriétaire peut modifier, partager et supprimer la carte.

Créer, modifier et supprimer des utilisateurs est réservé aux administrateurs.

---

# Fonctions personnalisées et sources de données

Les **Fonctions personnalisées** sont des fonctions de base de données que les éléments calculés peuvent appeler. Vous avez tous les droits dessus. Les **Sources de données** sont des connexions enregistrées à une base de données. Vous pouvez seulement les consulter et les tester.

![La page Fonctions personnalisées avec la liste, Tout actualiser et Nouvelle fonction.](shots/fr-FR/manager/08-custom-functions.png)

1. Dans **Fonctions personnalisées**, cliquez sur **Nouvelle fonction**.
2. Choisissez une **Source de données**, saisissez une partie d'un nom dans **Rechercher une fonction**, cliquez sur **Rechercher**.
3. Cliquez sur un résultat pour remplir la boîte de dialogue, puis cliquez sur **Enregistrer**.
4. Utilisez **Tout actualiser** pour relire toutes les fonctions depuis Oracle.
5. Dans **Sources de données**, cliquez sur **Tester la connexion** pour vérifier une connexion.

**Nouvelle source de données**, **Modifier**, **Supprimer** et **Importer** sur une source de données sont réservés aux administrateurs. Le système les refuse.

---

# Paramètres

Ouvrez **Paramètres** depuis la barre latérale ou le menu de votre nom.

![La page Paramètres avec les cartes Langue, Thème et Palette de couleurs.](shots/fr-FR/common/04-settings.png)

1. Choisissez votre **Langue d'affichage**, votre **Apparence** et votre **Palette**.
2. Cliquez sur **Enregistrer**. Sans cela, votre choix ne vous suit pas sur d'autres ordinateurs.

Pour changer votre mot de passe, ouvrez `/change-password`. Il faut au moins 12 caractères. Il n'existe pas de lien de réinitialisation. Si vous l'oubliez, demandez à un administrateur.
