# Votre rôle en un coup d'œil

Discoverer Neo remplace Oracle Discoverer. Une **carte** est un rapport (dans Oracle Discoverer, c'était une feuille de calcul). Un **classeur** est un groupe de cartes. Un **domaine d'activité** est un groupe de données liées. Vous avez le rôle **VIEWER**. Votre tâche principale est d'ouvrir des cartes, de les exécuter et de lire les résultats.

| Vous pouvez | Vous ne pouvez pas |
|---|---|
| Voir vos propres cartes, les cartes publiques et les cartes partagées avec vous | Voir les cartes privées que personne n'a partagées avec vous |
| Exécuter une carte et lire ses résultats, trier, filtrer et explorer le détail | Copier une carte ou un classeur |
| Exporter les résultats, si la carte est publique ou partagée avec vous en **Peut exporter** ou **Peut modifier** | Exporter une carte partagée avec vous en **Peut consulter** seulement |
| Voir vos propres exécutions et exportations | Voir les exécutions ou exportations des autres |
| Choisir votre langue, votre thème et vos couleurs | Ouvrir les pages d'administration (elles ne figurent pas dans votre menu) |

Le rôle VIEWER a une limite fixe : vous ne pouvez pas copier de cartes ni de classeurs. Tout le reste dépend de ce qui vous a été donné pour chaque carte et chaque domaine d'activité. Voir la section suivante.

## D'où viennent vos accès

Le rôle ne décide pas de ce que vous pouvez exécuter, exporter ou planifier. Ces trois éléments le font.

- **La carte.** Vous voyez une carte si vous l'avez créée, si son propriétaire l'a rendue **Public**, ou si quelqu'un l'a partagée avec vous. Un accès sur un domaine d'activité ne vous montre **pas** de cartes.
- **Le niveau de partage.** La plupart des cartes vous parviennent par un partage. Le niveau indique ce que vous pouvez faire.
- **Vos accès aux domaines d'activité.** Pour lire les données d'une carte, votre administrateur doit vous avoir donné accès aux domaines d'activité qu'elle utilise. Sans cela, l'exécution échoue avec « Exécution non autorisée ».

| Situation | Ouvrir et exécuter | Exporter | Planifier | Modifier la carte |
|---|---|---|---|---|
| Partagée avec vous : **Peut consulter** | Oui | Non | Non | Non |
| Partagée avec vous : **Peut exporter** | Oui | Oui | Oui | Non |
| Partagée avec vous : **Peut modifier** | Oui | Oui | Oui | Oui |
| Carte publique qui ne vous appartient pas | Oui | Oui | Non | Non |

Ce guide couvre ce que vous faites le plus souvent : trouver une carte, l'exécuter et la lire. L'exportation, la planification et la modification ne fonctionnent que si la carte est partagée avec vous au niveau requis. Ces parties sont courtes, à la fin de chaque chapitre.

Si une carte dont vous avez besoin est absente, demandez à son propriétaire de la partager avec vous.

## Se connecter, changer de mot de passe, se déconnecter

1. Ouvrez l'adresse que votre administrateur vous a donnée.
2. Saisissez votre **E-mail** et votre **Mot de passe**.
3. Laissez **Rester connecté** coché pour rester connecté après la fermeture du navigateur. Décochez-le sur un ordinateur partagé.
4. Cliquez sur **Se connecter**.

![La page de connexion avec E-mail, Mot de passe, Rester connecté et le bouton Se connecter.](shots/fr-FR/common/01-login.png)

Si votre compte a été créé avec un mot de passe temporaire, la page **Modifier votre mot de passe** s'ouvre en premier. Remplissez **Mot de passe temporaire**, **Nouveau mot de passe** (au moins 12 caractères, différent de l'ancien) et **Confirmer le nouveau mot de passe**, puis cliquez sur **Modifier le mot de passe**.

Si vous oubliez votre mot de passe, demandez à votre administrateur de le réinitialiser. Pour vous déconnecter, cliquez sur votre nom en haut à droite, puis sur **Se déconnecter**. Cela met fin à votre session. Pour utiliser de nouveau Discoverer Neo, reconnectez-vous.

---

# Tableau de bord

Le **Tableau de bord** est la première page après la connexion. C'est un résumé. Il est en lecture seule.

![Le tableau de bord du Viewer avec sa barre latérale réduite et les cartes de synthèse.](shots/fr-FR/viewer/01-dashboard.png)

| Carte | Ce qu'elle montre |
|---|---|
| **Nombre total de cartes** | Les cartes que vous pouvez ouvrir, avec le nombre de celles qui sont à vous et de celles qui sont partagées avec vous (les cartes publiques y sont comptées aussi) |
| **Nombre total d'exécutions** | Les exécutions des cartes que vous pouvez voir, par n'importe qui |
| **Cartes planifiées** et **Résultats planifiés** | Vos propres planifications. Elles sont généralement à zéro pour vous |
| **Cartes récentes** | Les cartes que vous avez créées. Généralement vide pour vous |

---

# Cartes

La page **Cartes** est votre liste de rapports. Utilisez-la pour trouver une carte et l'ouvrir.

![La liste Cartes, onglet Tous, où chaque carte n'a que l'icône Ouvrir.](shots/fr-FR/viewer/03-maps-all.png)

| Contrôle | Ce qu'il fait |
|---|---|
| **Mes cartes**, **Partagées avec moi**, **Tous** | Vos propres cartes, les cartes partagées avec vous, ou tout ce que vous pouvez voir. Si rien ne vous appartient, la page s'ouvre sur **Tous** |
| **Rechercher des cartes par nom…** | Filtre par nom pendant la saisie |
| Filtre **Domaine Métier** | Affiche un seul domaine d'activité. **Tous les domaines métier** supprime le filtre |
| **Trier par** | **Récemment modifiés** ou **Nom (A–Z)** |
| **Effacer** | Supprime la recherche et le filtre |
| Nom de la carte ou icône en forme d'œil | Ouvre la carte dans la visionneuse |

Le tableau affiche **Nom**, **Classeur**, **Propriétaire**, **Domaine Métier**, **Type**, **Mis à jour le** et **Actions**.

Vous ne voyez pas d'icône Copier, et il n'y a pas de bouton **Copier le classeur**. C'est voulu pour votre rôle.

Au-dessus du tableau, **Classeurs** liste les classeurs qui contiennent vos cartes. Saisissez dans **Rechercher des classeurs ou des feuilles...**, cliquez sur un classeur pour l'ouvrir, puis cliquez sur une feuille pour ouvrir la visionneuse.

![La liste Cartes, onglet Partagées avec moi, avec la carte Classeurs et seulement l'icône Ouvrir.](shots/fr-FR/viewer/02-maps-shared.png)

> **Remarque :** certaines icônes d'une ligne (par exemple le crayon, le calendrier ou la corbeille) ne fonctionnent que si la carte vous appartient ou si elle a été partagée avec vous à un niveau suffisant. Si vous cliquez sur l'une d'elles et que le serveur refuse, vous voyez « Forbidden ». Rien n'est modifié.

Exemple : pour trouver la carte de démonstration, saisissez **GD_M.M10_V01.DIS** dans la zone de recherche et cliquez sur son nom.

---

# La visionneuse de cartes

La visionneuse exécute une carte et affiche ses lignes. Vous passez la plupart de votre temps ici.

![Une exécution terminée avec les boutons Excel, CSV et PDF au-dessus de la grille de résultats.](shots/fr-FR/viewer/06-viewer-results.png)

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Retour** | Revient à la page précédente |
| **Exécuter** | Exécute la carte. Si la carte demande des valeurs, une boîte de dialogue s'ouvre d'abord |
| **Exécuter à nouveau** | Exécute de nouveau avec les mêmes valeurs et ignore le résultat enregistré. Il apparaît une fois l'exécution terminée |
| **Annuler** | Arrête une exécution qui attend encore dans la file d'attente |

Sous les boutons, une ligne d'état affiche **En attente**, **En cours…** ou l'heure du résultat et sa durée de validité (24 heures). « Affichage d'un résultat en cache » signifie que vous avez exécuté cette carte avec les mêmes valeurs récemment. Cliquez sur **Exécuter à nouveau** pour obtenir des données fraîches.

## Paramètres d'exécution

Certaines cartes demandent des valeurs, comme une date. Dans **Paramètres d'exécution**, remplissez chaque champ (un * rouge signifie obligatoire) et cliquez sur **Exécuter**. **Annuler** ferme la boîte de dialogue.

![La boîte de dialogue Paramètres d'exécution avec les deux valeurs obligatoires renseignées.](shots/fr-FR/viewer/05-viewer-params-filled.png)

## Lire les résultats

| Élément | Signification |
|---|---|
| **Résultats**, badges de lignes et de ms | Combien de lignes sont revenues et combien de temps cela a pris |
| **Lignes supplémentaires disponibles** | Le résultat a été tronqué. Seule une partie des lignes a été renvoyée |
| En-tête de colonne (clic) | Trie selon cette colonne : croissant, décroissant, aucun |
| Zone **Filtrer…** sous un en-tête | Filtre les lignes que vous avez chargées |
| Badge **Groupe**, **Total pour …**, **Total général** | Les lignes sont groupées et sous-totalisées. Un tri ou un filtre les met en pause |
| Double-clic sur une ligne | **Explorer le détail** : affiche les lignes brutes derrière cette ligne |
| **Charger plus** | Charge les 500 lignes suivantes |
| Cellules colorées | Règles définies par le propriétaire pour mettre des valeurs en évidence |

Une carte de type tableau croisé affiche un tableau croisé dynamique.

## Quand une exécution ne fonctionne pas

| Ce que vous voyez | Signification |
|---|---|
| **Exécution non autorisée** (rouge) | Vous pouvez voir la carte mais vous n'avez pas accès à ses données. Demandez à votre administrateur |
| **Demande refusée** ou **Feuille non exécutée** (orange) | La carte est construite d'une façon qui ne peut pas être exécutée en toute sécurité. La zone explique pourquoi. Prévenez le propriétaire de la carte |
| **Délai de la requête dépassé** | La requête a pris trop de temps. Réessayez plus tard ou prévenez le propriétaire |
| **Carte introuvable** | La carte a été supprimée ou n'est plus partagée avec vous |

## Exporter (seulement si votre accès le permet)

Les boutons **Excel**, **CSV** et **PDF** apparaissent sous les résultats après une exécution. Ils fonctionnent pour les cartes publiques et pour les cartes partagées avec vous en **Peut exporter** ou **Peut modifier**.

| Bouton | Ce qu'il fait |
|---|---|
| **Excel** | Télécharge un fichier Excel |
| **CSV** | Télécharge un fichier CSV |
| **PDF** | Ouvre **Exporter en PDF** : choisissez le **Format du papier** (A4, A3, Lettre), l'**Orientation** (Portrait, Paysage) et les colonnes, puis **Exporter** |

![La boîte de dialogue d'exportation PDF avec les options d'orientation, de format du papier, de titre et de police.](shots/fr-FR/user/17-builder-pdf-dialog.png)

> **Remarque :** si la carte est partagée avec vous en **Peut consulter** seulement, les boutons restent à l'écran, mais l'exportation échoue avec « Forbidden ». Demandez **Peut exporter** au propriétaire.

---

# Exécutions

La page **Exécutions** liste chaque exécution de carte que vous avez lancée. Utilisez-la pour retrouver un résultat sans exécuter la carte une seconde fois.

![La page Exécutions listant les propres exécutions du Viewer.](shots/fr-FR/viewer/07-runs.png)

| Contrôle | Ce qu'il fait |
|---|---|
| Filtres **Carte**, **Statut** et **Type** | Réduisent la liste. Le type est **En direct** (vous l'avez lancée) ou **Programmée** |
| Icône **Ouvrir** | Ouvre le résultat stocké |
| Icône **Exécuter à nouveau** | Lance une exécution avec les mêmes valeurs |
| **XLSX**, **CSV**, **PDF** | Télécharge un résultat, si votre accès permet l'exportation |
| Icône **Annuler** | Annule une exécution encore en attente |
| Icône **Supprimer** | Supprime définitivement une exécution terminée |

Le tableau affiche **Carte**, **Type**, **Paramètres**, **Statut**, **Lignes**, **Durée**, **Exécutée le**, **Expire dans** et **Actions**. Un résultat en direct reste 24 heures. Quand **Expire dans** indique **Expiré**, exécutez de nouveau la carte. Vous ne voyez que vos propres exécutions.

---

# Exportations

La page **Exportations** liste les fichiers que vous avez demandés.

![La page Exportations listant les exportations avec un bouton Télécharger sur celles qui sont terminées.](shots/fr-FR/user/44-exports.png)

Le tableau affiche **Carte**, **Format**, **État** (**En file d'attente**, **En cours**, **Terminée**, **Échouée**), **Lignes** et **Créée**. Cliquez sur l'icône **Télécharger** d'une ligne terminée. Les fichiers sont conservés 7 jours. Si le téléchargement échoue, exportez de nouveau depuis la visionneuse. Si vous n'exportez jamais, cette page reste vide.

---

# Planifications

La page **Planifications** liste les calendriers qui exécutent une carte automatiquement. Elle n'est utile que si vous possédez une carte ou avez **Peut exporter** ou **Peut modifier** sur une carte. Avec **Peut consulter** ou une carte publique, vous ne pouvez pas planifier. Ces cartes ne figurent pas dans la liste **Carte** de **Nouvelle planification**.

![La page Planifications avec le message Aucune planification pour le moment.](shots/fr-FR/viewer/09-schedules.png)

Si vous avez le bon niveau :

1. Cliquez sur **Nouvelle planification**, ou sur l'icône Calendrier dans **Cartes**.
2. Choisissez la **Carte** et saisissez un **Nom**.
3. Choisissez la **Fréquence** (**Quotidien**, **Hebdomadaire**, **Bimensuel (le 1er et le 16)**, **Mensuel**, tous les 2, 3, 4 ou 6 mois, **Annuel**, ou **Personnalisé (cron)**), son **Heure** et son jour, le **Fuseau horaire** et le **Format de sortie** (**Excel (.xlsx)** ou **CSV**). Un paramètre peut avoir une **Valeur fixe**, ou être **Relatif à la date d’exécution**, par exemple -1 **mois**, **dernier jour de ce mois**.
4. Cliquez sur **Enregistrer**.

Utilisez les icônes de chaque ligne pour **Exécuter maintenant**, **Suspendre** ou **Activer**, voir l'**Historique**, **Modifier** ou **Supprimer**. Les résultats restent sur le serveur. Rien n'est envoyé par e-mail.

---

# Paramètres

**Paramètres** modifie l'apparence de l'application pour vous. Ouvrez-les depuis la barre latérale ou depuis votre nom.

![La page Paramètres avec les cartes Langue, Thème et Palette de couleurs.](shots/fr-FR/common/04-settings.png)

| Contrôle | Ce qu'il fait |
|---|---|
| **Langue d'affichage** | **English**, **Português (Portugal)**, **Français (France)**, **Español (España)** |
| **Apparence** | **Clair**, **Sombre**, **Contraste élevé** |
| **Palette** | **Classique**, **Bleu marine**, **Forêt**, **Vin**, **Océan**, **Ocre**. Indisponible avec **Contraste élevé** |
| **Enregistrer** | Conserve vos choix sur votre compte |

Vos choix s'appliquent immédiatement. Cliquez sur **Enregistrer** pour les conserver sur tous vos appareils.

---

# Questions fréquentes

**Je ne vois pas une carte qu'un collègue voit.** Vous ne voyez que vos propres cartes, les cartes publiques et les cartes partagées. Demandez au propriétaire de la partager. Les managers et les administrateurs voient toutes les cartes.

**Pourquoi n'y a-t-il pas d'icône Copier ?** Le rôle VIEWER ne peut pas copier de cartes ni de classeurs. Demandez au propriétaire ou à votre administrateur.

**J'obtiens « Exécution non autorisée ».** Vous n'avez pas accès aux données de cette carte. Demandez à votre administrateur.

**Excel, CSV ou PDF affiche « Forbidden ».** La carte est partagée avec vous en **Peut consulter** seulement. Demandez **Peut exporter** au propriétaire.

**L'icône Modifier ou Planifier ne fait rien.** Elles exigent **Peut modifier** ou **Peut exporter** sur la carte, ou d'en être le propriétaire.

**Mon résultat indique Expiré.** Les résultats en direct restent 24 heures. Cliquez sur **Exécuter à nouveau**.

**Je ne retrouve pas une ancienne exportation.** Les fichiers sont supprimés au bout de 7 jours.

**J'ai oublié mon mot de passe.** Demandez à votre administrateur de le réinitialiser.

---

# Glossaire

| Terme | Signification |
|---|---|
| Carte | Un rapport. Dans Oracle Discoverer, c'était une feuille de calcul |
| Classeur | Un groupe de cartes |
| Domaine d'activité | Un groupe de données liées |
| Exécution | Un lancement d'une carte qui produit un résultat |
| Exportation | Un fichier (Excel, CSV ou PDF) créé à partir d'un résultat |
| Planification | Un calendrier qui exécute une carte automatiquement |
| Partage | Accès à une carte donné par son propriétaire : **Peut consulter**, **Peut exporter** ou **Peut modifier** |
| Carte publique | Une carte que tout utilisateur peut ouvrir, exécuter et exporter |
| Paramètre | Une valeur que la carte demande quand vous l'exécutez |
