# Votre rôle en une page

Vous avez le rôle **USER**. Une **carte** est un rapport. Un **domaine d'activité** est un groupe de données liées.

| Vous pouvez | Vous ne pouvez pas |
|---|---|
| Voir vos cartes, les cartes publiques et les cartes partagées | Voir les cartes privées des autres |
| Exécuter des cartes, et les exporter ou les planifier quand le niveau de partage le permet | Exporter une carte partagée en **Peut consulter** |
| Copier une carte et modifier votre copie | Modifier des cartes qui ne vous appartiennent pas, sauf si elles sont partagées en **Peut modifier** |
| Créer des cartes là où vous avez le droit de création | Créer des cartes dans d'autres domaines d'activité |
| Partager et supprimer vos propres cartes | Partager ou supprimer les cartes des autres |
| Changer votre langue et votre thème | Ouvrir les pages d'administration |

Niveaux de partage : **Peut consulter** = exécuter seulement. **Peut exporter** = exécuter, exporter, planifier. **Peut modifier** = tout cela plus la modification de la carte.

Connectez-vous avec **E-mail** et **Mot de passe**, puis **Se connecter**. Un mot de passe temporaire doit d'abord être changé (au moins 12 caractères). Pour quitter, cliquez sur votre nom, puis sur **Se déconnecter**.

![La page de connexion avec E-mail, Mot de passe, Rester connecté et le bouton Se connecter.](shots/fr-FR/common/01-login.png)

---

# Tableau de bord

Première page après la connexion. Elle est en lecture seule.

![Le tableau de bord avec les cartes de synthèse et la liste Cartes récentes.](shots/fr-FR/user/45-dashboard.png)

1. Lisez **Nombre total de cartes** et **Nombre total d'exécutions** pour un résumé.
2. Lisez **Cartes planifiées** et **Résultats planifiés** pour vos planifications. Cliquez sur **Voir les planifications** pour les ouvrir.
3. Cliquez sur une carte dans **Cartes récentes** (vos 5 dernières) pour l'ouvrir dans le créateur.

---

# Cartes

La liste de vos rapports. Onglets : **Mes cartes**, **Partagées avec moi**, **Tous**.

![La liste Cartes, onglet Mes cartes, affichant les icônes d'action sur la ligne de la carte.](shots/fr-FR/user/03-maps-mine.png)

1. Recherchez par nom ou choisissez un **Domaine Métier**.
2. Cliquez sur l'icône en forme d'œil pour ouvrir la visionneuse.
3. Cliquez sur l'icône Copier pour en faire votre propre copie.
4. Cliquez sur l'icône Partager (vos propres cartes) pour donner accès.
5. Cliquez sur **Créer une carte** pour en construire une nouvelle.

| Icône | Utilisation |
|---|---|
| Œil | Ouvrir et exécuter |
| Crayon | Modifier (vos cartes ou **Peut modifier**) |
| Copier | Votre propre copie |
| Partager | Définir **Peut consulter**, **Peut exporter**, **Peut modifier**, ou **✕** pour retirer |
| Calendrier | Planifier (vos cartes, **Peut exporter**, **Peut modifier**) |
| Corbeille | Supprimer (vos cartes seulement, seul un administrateur peut restaurer) |

---

# Exécuter et exporter

La visionneuse exécute une carte et affiche les lignes.

![La visionneuse de cartes après une exécution terminée, avec la grille de résultats et les boutons d'exportation.](shots/fr-FR/user/25-viewer-results.png)

1. Ouvrez la carte avec l'icône en forme d'œil.
2. Cliquez sur **Exécuter**. Remplissez **Paramètres d'exécution** si on vous le demande.
3. Lisez les résultats. Cliquez sur un en-tête pour trier, double-cliquez sur une ligne pour **Explorer le détail**.
4. Cliquez sur **Excel**, **CSV** ou **PDF** pour exporter.
5. Cliquez sur **Exécuter à nouveau** pour des données fraîches. Un résultat reste valable 24 heures.

| Choix | Ligne |
|---|---|
| Boîte de dialogue **PDF** | Choisissez le **Format du papier** (A4, A3, Lettre), l'**Orientation** et les colonnes |
| **Exécution non autorisée** | Vous n'avez pas accès aux données. Demandez à votre administrateur |
| **Forbidden** à l'exportation | La carte est en **Peut consulter** seulement. Demandez **Peut exporter** |

---

# Créer et modifier une carte

Créez une carte à partir d'éléments d'un seul domaine d'activité. Seulement là où vous avez le droit de création.

![Le créateur de cartes avec l'arborescence Domaines d'activité, la zone Colonnes et le panneau Propriétés.](shots/fr-FR/user/05-builder-overview.png)

1. Cliquez sur **Créer une carte**.
2. Faites glisser des éléments de l'arborescence **Domaines d'activité** vers **Colonnes**. Le premier élément fixe le domaine d'activité.
3. Définissez les filtres dans **Conditions**, le tri dans **Tri**, les invites dans **Paramètres**.
4. Saisissez un nom et cliquez sur **Enregistrer**. Rien ne s'enregistre automatiquement.
5. Cliquez sur **Exécuter** pour tester.

| Onglet | Utilisation |
|---|---|
| **Propriétés** | Description et case **Public** (visible par tous les utilisateurs) |
| **Conditions** | Filtres, fixes ou **Demander à l'exécution** |
| **Tri** | Niveaux de tri |
| **Paramètres** | Valeurs demandées à l'exécution |
| **Champs calculés** | Nouvelle colonne à partir d'une formule |

**Mise en forme** colore les cellules qui respectent une règle. Elle exige une carte enregistrée.

---

# Exécutions et exportations

**Exécutions** liste vos exécutions. **Exportations** liste vos fichiers.

![La page Exécutions avec les filtres et le tableau des exécutions et de leurs boutons d'exportation.](shots/fr-FR/user/41-runs.png)

1. Ouvrez **Exécutions** pour voir le statut, les lignes et **Expire dans**.
2. Cliquez sur **Ouvrir** pour voir un résultat stocké, ou sur **Exécuter à nouveau**.
3. Cliquez sur **XLSX**, **CSV** ou **PDF** pour télécharger un résultat.
4. Ouvrez **Exportations** et cliquez sur **Télécharger** pour un fichier terminé.

| Choix | Ligne |
|---|---|
| **Annuler** | Uniquement pour une exécution en file d'attente |
| **Supprimer** | Supprime l'exécution définitivement |
| Fichiers | Conservés 7 jours |

![La page Exportations listant les exportations avec un bouton Télécharger sur celles qui sont terminées.](shots/fr-FR/user/44-exports.png)

---

# Planifications

Exécute une carte automatiquement et stocke le résultat sur le serveur. Rien n'est envoyé par e-mail.

![La boîte de dialogue Nouvelle planification avec carte, nom, fréquence, fuseau horaire et format de sortie.](shots/fr-FR/user/32-schedule-new-dialog.png)

1. Cliquez sur **Nouvelle planification**, ou sur l'icône Calendrier dans **Cartes**.
2. Choisissez la **Carte** (la vôtre, ou partagée en **Peut exporter** ou **Peut modifier**).
3. Saisissez un **Nom**.
4. Choisissez la **Fréquence**, le **Fuseau horaire** et le **Format de sortie**.
5. Remplissez **Préréglages de paramètres**, puis cliquez sur **Enregistrer**.
6. Utilisez **Exécuter maintenant**, **Suspendre**, **Historique** pour la gérer.

| Choix | Ligne |
|---|---|
| **Fréquence** | **Tous les jours (minuit)**, **Toutes les semaines (dimanche, minuit)**, **Tous les mois (le 1er, minuit)**, **Personnalisé** (cron, par ex. `0 9 * * 1-5`) |
| **Format de sortie** | **Excel (.xlsx)** ou **CSV** |
| Carte publique | Ne peut pas être planifiée |

---

# Paramètres

Ouvrez **Paramètres** depuis la barre latérale.

![La page Paramètres avec les cartes Langue, Thème et Palette de couleurs.](shots/fr-FR/common/04-settings.png)

1. Choisissez une **Langue d'affichage**.
2. Choisissez **Clair**, **Sombre** ou **Contraste élevé**.
3. Choisissez une **Palette** (impossible avec **Contraste élevé**).
4. Cliquez sur **Enregistrer**. Sans cela, votre choix reste sur ce navigateur uniquement.
