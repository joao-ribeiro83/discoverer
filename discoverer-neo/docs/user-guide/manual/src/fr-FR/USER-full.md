# Votre rôle en un coup d'œil

Discoverer Neo remplace Oracle Discoverer. Une **carte** est un rapport (dans Oracle Discoverer, c'était une feuille de calcul). Un **classeur** est un groupe de cartes. Un **domaine d'activité** est un groupe de données liées. Vous avez le rôle **USER**. Il vous permet d'ouvrir et d'exécuter des cartes, de les exporter et de les planifier, et de créer vos propres cartes.

| Vous pouvez | Vous ne pouvez pas |
|---|---|
| Voir vos propres cartes, les cartes publiques et les cartes partagées avec vous | Voir les cartes privées que personne n'a partagées avec vous |
| Exécuter une carte et consulter ses résultats | Exécuter une carte sur des données auxquelles vous n'avez pas accès |
| Exporter les résultats vers Excel, CSV ou PDF, si le niveau de partage de la carte le permet | Exporter une carte partagée avec vous en **Peut consulter** seulement |
| Planifier une carte, si elle vous appartient ou si elle est partagée avec vous en **Peut exporter** ou **Peut modifier** | Planifier une carte publique qui ne vous appartient pas |
| Copier toute carte que vous pouvez voir et modifier votre copie | Modifier une carte qui ne vous appartient pas, sauf si elle est partagée avec vous en **Peut modifier** |
| Créer une nouvelle carte, mais seulement dans un domaine d'activité où votre administrateur vous a donné le droit de création | Créer des cartes dans d'autres domaines d'activité |
| Partager et supprimer les cartes qui vous appartiennent | Partager ou supprimer les cartes d'une autre personne |
| Voir vos propres exécutions, exportations et planifications | Voir les exécutions, exportations ou planifications des autres |
| Choisir votre langue, votre thème et vos couleurs | Ouvrir les pages d'administration (elles ne figurent pas dans votre menu) |

## D'où viennent vos accès

Trois éléments décident de ce que vous pouvez faire. Votre rôle n'est que le premier.

- **La carte.** Vous voyez une carte si vous l'avez créée, si son propriétaire l'a rendue **Public**, ou si quelqu'un l'a partagée avec vous. Un accès sur un domaine d'activité ne vous montre **pas** de cartes.
- **Le niveau de partage.** Pour une carte qui ne vous appartient pas, le niveau de partage indique ce que vous pouvez faire. Voir le tableau ci-dessous.
- **Vos accès aux domaines d'activité.** Votre administrateur vous donne des droits sur des domaines d'activité. Pour lire les données d'une carte, vous avez besoin d'un accès aux données qu'elle utilise. Pour créer une nouvelle carte, vous avez besoin du droit de **création** dans ce domaine d'activité. Sans lui, les exécutions de la carte échouent avec « Exécution non autorisée », ou l'enregistrement d'une nouvelle carte échoue.

| Situation | Ouvrir et exécuter | Exporter | Planifier | Modifier la carte |
|---|---|---|---|---|
| La carte vous appartient | Oui | Oui | Oui | Oui |
| Partagée avec vous : **Peut consulter** | Oui | Non | Non | Non |
| Partagée avec vous : **Peut exporter** | Oui | Oui | Oui | Non |
| Partagée avec vous : **Peut modifier** | Oui | Oui | Oui | Oui |
| Carte publique qui ne vous appartient pas | Oui | Oui | Non | Non |

> **Remarque :** seul le propriétaire peut partager ou supprimer une carte. Une personne qui a **Peut modifier** ne peut pas la partager plus loin.

Si une carte dont vous avez besoin est absente, demandez à son propriétaire de la partager avec vous.

## Se connecter, changer de mot de passe, se déconnecter

1. Ouvrez l'adresse que votre administrateur vous a donnée.
2. Saisissez votre **E-mail** et votre **Mot de passe**.
3. Laissez **Rester connecté** coché si vous voulez rester connecté après la fermeture du navigateur. Décochez-le sur un ordinateur partagé.
4. Cliquez sur **Se connecter**.

![La page de connexion avec E-mail, Mot de passe, Rester connecté et le bouton Se connecter.](shots/fr-FR/common/01-login.png)

Si votre compte a été créé avec un mot de passe temporaire, la page **Modifier votre mot de passe** s'ouvre en premier. Vous ne pouvez pas utiliser le reste de l'application tant que vous ne l'avez pas changé.

| Champ | Ce qu'il faut saisir |
|---|---|
| **Mot de passe temporaire** (ou **Mot de passe actuel**) | Le mot de passe que vous utilisez actuellement |
| **Nouveau mot de passe** | Au moins 12 caractères. Il doit être différent de l'actuel |
| **Confirmer le nouveau mot de passe** | Le même nouveau mot de passe, une seconde fois |

Cliquez sur **Modifier le mot de passe**. Le tableau de bord s'ouvre.

Si vous oubliez votre mot de passe, demandez à votre administrateur de le réinitialiser. Il n'existe pas de réinitialisation en libre-service.

Pour vous déconnecter, cliquez sur votre nom en haut à droite, puis sur **Se déconnecter**. Cela met fin à votre session. Pour utiliser de nouveau Discoverer Neo, reconnectez-vous.

> **Remarque :** après 5 mots de passe erronés à la suite, votre compte est verrouillé pendant 15 minutes. Patientez, puis réessayez.

---

# Tableau de bord

Le **Tableau de bord** est la première page après la connexion. Il donne un résumé rapide. Il est en lecture seule. Vous l'utilisez pour voir combien vous avez d'éléments et pour accéder à vos dernières cartes.

![Le tableau de bord avec les cartes de synthèse et la liste Cartes récentes.](shots/fr-FR/user/45-dashboard.png)

| Carte | Ce qu'elle montre |
|---|---|
| **Nombre total de cartes** | Les cartes que vous pouvez ouvrir. La ligne du dessous indique combien sont à vous et combien sont partagées avec vous (les cartes publiques y sont comptées aussi) |
| **Nombre total d'exécutions** | Les exécutions des cartes que vous pouvez voir, par n'importe qui |
| **Cartes planifiées** | Les cartes pour lesquelles vous avez au moins une planification active |
| **Résultats planifiés** | Les résultats stockés par vos planifications |
| **Cartes récentes** | Vos 5 dernières cartes créées, la plus récente en premier. Cliquez sur l'une d'elles pour l'ouvrir dans le créateur de cartes |
| **Voir les planifications** (lien sur deux cartes) | Ouvre la page **Planifications** |

Si vous n'avez créé aucune carte, **Cartes récentes** indique qu'aucune n'est à vous.

---

# Cartes

La page **Cartes** est votre liste de rapports. Vous l'utilisez pour trouver une carte, l'exécuter, la copier, la partager ou la supprimer.

![La liste Cartes, onglet Mes cartes, affichant les icônes d'action sur la ligne de la carte.](shots/fr-FR/user/03-maps-mine.png)

## Onglets, recherche et filtres

| Contrôle | Ce qu'il fait |
|---|---|
| **Mes cartes** | Les cartes que vous avez créées |
| **Partagées avec moi** | Les cartes que d'autres ont partagées avec vous, à n'importe quel niveau |
| **Tous** | Tout ce que vous pouvez voir : vos cartes, les cartes publiques et les cartes partagées |
| **Rechercher des cartes par nom…** | Filtre la liste par nom pendant la saisie |
| Filtre **Domaine Métier** | Affiche seulement les cartes d'un domaine d'activité. **Tous les domaines métier** supprime le filtre |
| **Trier par** | **Récemment modifiés** ou **Nom (A–Z)** |
| **Effacer** | Réinitialise la recherche et le domaine d'activité. N'apparaît que si un filtre est actif |
| **Créer une carte** | Ouvre le créateur de cartes pour une nouvelle carte |

Le tableau affiche **Nom**, **Classeur**, **Propriétaire**, **Domaine Métier**, **Type**, **Mis à jour le** et **Actions**. Si aucune carte ne vous appartient, la page s'ouvre sur **Tous**.

## Actions de ligne

Chaque ligne comporte des icônes. Survolez une icône pour lire son infobulle.

| Icône | Ce qu'elle fait |
|---|---|
| Nom de la carte | Ouvre la carte dans le créateur si vous pouvez la modifier, sinon dans la visionneuse |
| Œil | Ouvre la visionneuse, où vous exécutez la carte et voyez les lignes |
| Crayon | Ouvre le créateur de cartes. Uniquement pour vos cartes et les cartes partagées avec vous en **Peut modifier** |
| Copier | Crée votre propre copie privée et l'ouvre. Vous en devenez le propriétaire |
| Partager | Ouvre la boîte de dialogue **Partager la carte**. Uniquement pour les cartes qui vous appartiennent |
| Calendrier | Ouvre **Planifications** avec cette carte choisie. Uniquement pour les cartes qui vous appartiennent ou qui sont partagées en **Peut exporter** ou **Peut modifier** |
| Télécharger | Ouvre la visionneuse, où vous exportez |
| Corbeille | Supprime la carte. Uniquement pour vos propres cartes |

> **Remarque :** les icônes Calendrier et Télécharger des cartes partagées apparaissent dans l'onglet **Partagées avec moi**. Dans l'onglet **Tous**, ouvrez plutôt la carte dans la visionneuse.

> **Attention :** seul un administrateur peut récupérer une carte supprimée. **Supprimer la carte ?** vous demande de confirmer avec **Supprimer**.

## Classeurs

Au-dessus du tableau, une section **Classeurs** apparaît quand certaines de vos cartes appartiennent à un classeur.

| Contrôle | Ce qu'il fait |
|---|---|
| **Rechercher des classeurs ou des feuilles...** | Filtre par nom de classeur ou de feuille |
| Ligne de classeur | Cliquez pour ouvrir la liste de ses feuilles. Cliquez sur une feuille pour ouvrir la visionneuse |
| Crayon sur une feuille | Modifier. Uniquement pour les feuilles que vous avez créées |
| Copier | **Copier le classeur** : crée un nouveau classeur avec une copie privée de chaque feuille |
| Corbeille | **Supprimer le classeur** : supprime le classeur et toutes ses feuilles. Uniquement si vous possédez chaque feuille |

Le bouton **Partager le classeur** n'est pas pour votre rôle. Partagez chaque carte qui vous appartient avec sa propre icône **Partager**.

![La boîte de dialogue Copier le classeur avec le champ du nom du nouveau classeur.](shots/fr-FR/user/02-workbook-copy-dialog.png)

Exemple : pour copier la carte de démonstration, trouvez **GD_M.M10_V01.DIS**, cliquez sur l'icône Copier et confirmez. Votre copie s'ouvre dans le créateur, et vous pouvez la modifier librement. L'original reste inchangé.

## Copier une carte

1. Trouvez la carte dans la liste.
2. Cliquez sur l'icône Copier.
3. La copie s'ouvre dans le créateur avec le message « Carte copiée. Vous modifiez maintenant votre copie. »
4. Modifiez ce dont vous avez besoin et cliquez sur **Enregistrer**.

Exécuter la copie exige toujours un accès aux données. La copie ne vous le donne pas.

## Partager une carte qui vous appartient

1. Cliquez sur l'icône Partager de votre carte.
2. Recherchez une personne par nom ou e-mail.
3. Cliquez sur un niveau à côté de son nom. Le bouton foncé est le niveau qu'elle a actuellement.
4. Pour retirer l'accès, cliquez sur le **✕** à côté de son nom.

![La boîte de dialogue Partager la carte avec une personne correspondante et les boutons Peut consulter, Peut exporter et Peut modifier.](shots/fr-FR/user/29-share-dialog-search.png)

| Option | Signification / quand la choisir |
|---|---|
| **Peut consulter** | La personne peut ouvrir et exécuter la carte. Elle ne peut ni l'exporter, ni la planifier, ni la modifier |
| **Peut exporter** | Comme ci-dessus, et elle peut exporter le résultat et mettre la carte en planification |
| **Peut modifier** | Tout ce qui précède, et elle peut aussi modifier la carte. Elle ne peut toujours pas la partager ni la supprimer |
| **✕** | Retire son accès |

Si la carte est publique, la boîte de dialogue indique « Cette carte est publique — toute personne disposant du lien peut la consulter. » et affiche **Copier le lien**. Utilisez-le pour envoyer l'adresse à un collègue.

---

# La visionneuse de cartes

La visionneuse s'ouvre quand vous cliquez sur le nom d'une carte (pour une carte que vous ne pouvez pas modifier) ou sur l'icône en forme d'œil. Vous l'utilisez pour exécuter une carte et lire ses résultats.

![La visionneuse de cartes après une exécution terminée, avec la grille de résultats et les boutons d'exportation.](shots/fr-FR/user/25-viewer-results.png)

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Retour** | Revient à la page d'où vous venez |
| **Exécuter** | Exécute la carte. Si la carte demande des valeurs (paramètres), une boîte de dialogue s'ouvre d'abord |
| **Exécuter à nouveau** | Exécute de nouveau la carte avec les mêmes valeurs et ignore le résultat enregistré. Il apparaît une fois l'exécution terminée |
| **Annuler** | Arrête une exécution qui attend encore dans la file d'attente. Il n'est plus proposé une fois l'exécution démarrée |
| **Gestion des planifications** | Ouvre la page **Planifications** |

Pendant une exécution, une ligne sous les boutons affiche **En attente** ou **En cours…**. Quand elle est terminée, elle affiche l'heure et la durée de validité du résultat (24 heures). Si vous avez exécuté la même carte avec les mêmes valeurs récemment, vous pouvez voir « Affichage d'un résultat en cache ». Utilisez **Exécuter à nouveau** pour obtenir des données fraîches.

Si une carte n'a aucune colonne, la visionneuse vous indique qu'il n'y a rien à exécuter.

## Paramètres d'exécution

Certaines cartes vous demandent des valeurs, comme une date ou une région. La boîte de dialogue **Paramètres d'exécution** affiche un champ par paramètre. Un * rouge signifie que la valeur est obligatoire. Pour certaines valeurs, la boîte de dialogue suggère les valeurs réelles issues des données. Cliquez sur **Exécuter** pour démarrer, ou sur **Annuler** pour fermer.

![La boîte de dialogue Paramètres d'exécution avec les deux valeurs obligatoires renseignées.](shots/fr-FR/user/24-viewer-params-filled.png)

## Lire les résultats

| Élément | Signification |
|---|---|
| En-tête **Résultats** avec badges de lignes et de ms | Combien de lignes sont revenues et combien de temps cela a pris |
| **Lignes supplémentaires disponibles** | Le résultat a été tronqué. Seule une partie des lignes a été renvoyée |
| En-tête de colonne (clic) | Trie selon cette colonne : croissant, décroissant, aucun |
| Zone **Filtrer…** sous un en-tête | Filtre les lignes que vous avez chargées |
| Badge **Groupe**, **Total pour …**, **Total général** | La carte groupe les lignes et affiche des sous-totaux. Un tri ou un filtre les met en pause |
| Double-clic sur une ligne | **Explorer le détail** : affiche les lignes brutes derrière cette ligne |
| **Charger plus** | Charge les 500 lignes suivantes |
| Cellules colorées | Règles définies par le propriétaire de la carte (mise en forme conditionnelle) |

Une carte de type tableau croisé affiche un tableau croisé dynamique quand une colonne est placée **En haut**.

## Exporter les résultats

Sous les résultats, utilisez ces boutons. Ils apparaissent une fois l'exécution terminée.

| Bouton | Ce qu'il fait |
|---|---|
| **Excel** | Télécharge un fichier Excel |
| **CSV** | Télécharge un fichier CSV |
| **PDF** | Ouvre **Exporter en PDF**, où vous choisissez le papier et les colonnes |

![La boîte de dialogue d'exportation PDF avec les options d'orientation, de format du papier, de titre et de police.](shots/fr-FR/user/17-builder-pdf-dialog.png)

| Option dans **Exporter en PDF** | Signification / quand la choisir |
|---|---|
| **Format du papier** : A4, A3, Lettre | A4 est la valeur par défaut. Choisissez A3 pour les tableaux larges, Lettre pour le papier américain |
| **Orientation** : Portrait, Paysage | Paysage contient plus de colonnes |
| **Colonnes** | Cochez les colonnes à imprimer. **Tout sélectionner** et **Effacer** les basculent toutes |

Cliquez sur **Exporter**. Le fichier est créé en arrière-plan. Retrouvez-le plus tard dans la page **Exportations**.

> **Remarque :** les boutons d'exportation s'affichent pour toutes les cartes. Si votre accès à la carte est **Peut consulter** seulement, l'exportation échoue avec « Forbidden ». Demandez **Peut exporter** au propriétaire.

Exemple : ouvrez **GD_M.M10_V01.DIS**, cliquez sur **Exécuter**, puis sur **Excel**.

---

# Créer et modifier des cartes

Vous ne pouvez créer une nouvelle carte que dans un domaine d'activité où votre administrateur vous a donné le droit de **création**. Vous pouvez modifier une carte existante si elle vous appartient ou si elle est partagée avec vous en **Peut modifier**. Le créateur s'ouvre depuis **Créer une carte**, depuis l'icône en forme de crayon ou depuis **Cartes récentes**.

![Le créateur de cartes avec l'arborescence Domaines d'activité, la zone Colonnes et le panneau Propriétés.](shots/fr-FR/user/05-builder-overview.png)

Le créateur comporte une barre d'outils en haut, une arborescence **Domaines d'activité** à gauche, la zone **Colonnes** au milieu, et un panneau de paramètres à cinq onglets à droite. Vous pouvez faire glisser les bords pour redimensionner les panneaux.

> **Attention :** le créateur n'enregistre jamais tout seul. Cliquez sur **Enregistrer**. Si vous quittez la page, les modifications non enregistrées sont perdues.

## Barre d'outils

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Retour** | Revient à la page précédente |
| Zone du nom de la carte | Le nom de la carte |
| Liste du type de carte | **Tableau**, **Tableau croisé**, **Page-Détail** ou **Graphique**. Seul **Tableau croisé** change l'aspect des résultats. Les trois autres affichent un tableau simple |
| **● Non enregistré** | Indique que vous avez des modifications non enregistrées |
| **Exécuter** | Enregistre la carte si elle est nouvelle ou modifiée, puis l'exécute |
| **Enregistrer** | Enregistre la carte. Exige au moins une colonne |
| **Exporter** | Menu avec **Définition de la carte (.xml)**, qui télécharge la conception de la carte, pas les données. L'exportation des données se trouve sous les résultats |
| **Planifier** | Ouvre **Planifications** avec cette carte choisie. Exige une carte enregistrée |
| **Mise en forme** | Ouvre **Mise en forme conditionnelle**. Exige une carte enregistrée |
| **Partager** | Ouvre **Partager la carte**. Exige une carte enregistrée. Seul le propriétaire peut modifier les partages |
| **Réduire le panneau** / **Développer le panneau** | Masque ou affiche le panneau de droite |

## Ajouter des colonnes

1. Dans l'arborescence **Domaines d'activité** à gauche, ouvrez un domaine d'activité, puis un dossier. Un dossier contient des éléments (un dossier ressemble à une table).
2. Faites glisser un élément vers la zone **Colonnes**, ou cliquez sur le **+** à côté. Une icône sigma marque une mesure (un nombre que l'on additionne). Une icône d'étiquette marque une dimension (un libellé).
3. Toutes les colonnes d'une carte doivent provenir du même domaine d'activité. La première colonne ajoutée le fixe. Vous ne pouvez pas choisir le domaine vous-même.
4. Utilisez la zone **Filtrer les éléments…** pour trouver un élément par son nom.
5. Faites glisser la poignée d'une colonne pour la réordonner. Cliquez sur **X** pour la retirer. Cliquez sur la pastille de la colonne pour la configurer.

Si vous voyez « Aucun domaine d'activité. », vous n'avez encore accès à aucun domaine d'activité. Demandez à votre administrateur.

> **Remarque :** l'arborescence affiche chaque domaine d'activité sur lequel vous avez un droit quelconque. Vous pouvez construire une carte avec de simples droits de consultation, mais **Enregistrer** échoue pour une nouvelle carte sans le droit de création.

## Configurer une colonne

Cliquez sur la pastille d'une colonne. Les modifications s'appliquent au brouillon. Cliquez sur **Enregistrer** dans la boîte de dialogue, puis sur **Enregistrer** pour la carte.

| Champ | Ce qu'il fait |
|---|---|
| **Nom d'affichage** | Titre de la colonne. Vide, il reprend le nom de l'élément |
| **Agrégation** | **NONE**, **SUM**, **COUNT**, **AVG**, **MIN** ou **MAX** |
| **Sens du tri** | **Aucun**, **Croissant**, **Décroissant** |
| **Masque de format** et **Préréglages** | Un format de nombre ou de date. Préréglages : **Nombre (1 234)**, **Décimal (1 234,00)**, **Devise (1 234,00 €)**, **Pourcentage (12,3 %)**, **Date (DD-MON-YYYY)**, **Date (YYYY-MM-DD)** |
| **Ordre de tri** | Position de cette colonne quand vous triez selon plusieurs |
| **Largeur de colonne (px)** | Largeur de la colonne |
| **Placement** | **Aucun**, **Grouper par (axe)**, **Mesure** ou **Élément de page** |
| **Bord du tableau croisé** | **Sur le côté** ou **En haut**. Uniquement pour les tableaux croisés |
| **Grouper et rompre** | Masque les valeurs répétées et ajoute un sous-total chaque fois que la valeur change |
| **Requête seulement, ne pas afficher** | La colonne sert aux filtres et aux totaux mais n'est pas affichée |

![La boîte de dialogue Configurer la colonne avec la liste Agrégation ouverte.](shots/fr-FR/user/08-builder-column-aggregation.png)

## Onglets du panneau de droite

| Onglet | À quoi il sert |
|---|---|
| **Propriétés** | **Description** (imprimée au-dessus des résultats et des exportations), **Insérer une variable** (**Date d'exécution**, **Heure d'exécution**, **Nom du classeur**, **Nom de la feuille**, ou un paramètre) et la case **Public** |
| **Conditions** | Filtres. **Ajouter une condition**, choisissez l'élément, l'opérateur (`=`, `<>`, `<`, `>`, `<=`, `>=`, `LIKE`, `IN`, `BETWEEN`, `IS NULL`) et la valeur. Choisissez **Valeur statique** ou **Demander à l'exécution**. Sélectionnez deux lignes ou plus et cliquez sur **Grouper** pour les relier par OR. Utilisez **Dégrouper** pour annuler |
| **Tri** | **Ajouter un tri** : choisissez une colonne et un sens. Faites glisser pour changer l'ordre |
| **Paramètres** | Valeurs demandées aux personnes à l'exécution. Chacun a un nom, un type (**STRING**, **NUMBER**, **DATE**, **LIST**), une valeur par défaut et une case **Obligatoire**. Si chaque paramètre a une valeur par défaut, l'invite est ignorée |
| **Champs calculés** | Une nouvelle colonne à partir d'une formule. Cliquez sur **Ajouter un champ calculé**, nommez-le, puis cliquez sur la formule pour ouvrir l'**Éditeur de formules** |

![L'onglet Conditions listant les conditions de la carte avec les contrôles d'opérateur et de valeur ou d'invite.](shots/fr-FR/user/09-builder-conditions.png)

> **Attention :** la case **Public** rend la carte visible et exportable pour tous les utilisateurs de l'application, pas seulement pour un domaine d'activité. Les règles d'accès aux données s'appliquent toujours aux données. Utilisez-la avec prudence.

L'**Éditeur de formules** propose des boutons de fonctions (par exemple **ROUND**, **UPPER**, **TO_CHAR**, **NVL**, **CASE**) et vos colonnes. **Tester la formule** l'exécute sur les 5 premières lignes. Il exige une carte enregistrée.

## Mise en forme conditionnelle

Cliquez sur **Mise en forme** pour colorer les cellules ou les lignes qui respectent une règle. Les règles sont enregistrées immédiatement. Elles ne font pas partie de l'**Enregistrer** de la carte. Vous ne pouvez ajouter ou supprimer des règles que sur les cartes qui vous appartiennent ou que vous pouvez modifier.

| Champ | Signification |
|---|---|
| **Colonne** | La colonne à tester |
| **Appliquer à** | **Cellule** ou **Ligne** |
| **Opérateur** | **Égal à**, **Différent de**, **Supérieur à**, **Inférieur à**, **Supérieur ou égal à**, **Inférieur ou égal à**, **Contient (jokers % et _)**, **Dans la liste**, **Entre**, **Est vide** |
| **Valeur** | Ce à quoi comparer. Utilisez `low,high` pour **Entre** |
| **Couleur de fond**, **Couleur du texte** | Couleurs. **Effacer** en supprime une |
| **Gras**, **Italique**, **Souligné** | Style du texte |

![La boîte de dialogue Mise en forme avec la liste des règles et les contrôles Ajouter une règle.](shots/fr-FR/user/19-builder-formatting-dialog.png)

## Exécuter depuis le créateur et exécutions refusées

**Exécuter** ouvre un panneau **Résultats** en bas. Il fonctionne comme la visionneuse. Si vous n'avez que des droits de consultation sur une carte, ne la modifiez pas d'abord : l'enregistrement automatique serait refusé.

Parfois, le planificateur refuse une carte. Une zone orange explique pourquoi et ce qu'il faut changer. Les causes typiques sont des dossiers qui ne sont pas reliés, ou des totaux issus de deux jeux de lignes de détail. Retirez la colonne à l'origine du problème, ou demandez à votre administrateur de définir la jointure manquante. Une bannière rouge **Exécution non autorisée** signifie que vous n'avez pas accès aux données de l'un des dossiers.

## Exemple : créer une petite carte

1. Cliquez sur **Créer une carte** dans la page **Cartes**.
2. Ouvrez un domaine d'activité et faites glisser deux éléments dans **Colonnes**.
3. Saisissez un nom dans la zone du nom de la carte.
4. Cliquez sur **Enregistrer**. La carte a maintenant sa propre adresse.
5. Cliquez sur **Exécuter**.
6. Cliquez sur **Partager** si un collègue doit la voir.

---

# Exécutions

La page **Exécutions** liste chaque exécution de carte que vous avez lancée, en attente, en cours ou terminée. Vous l'utilisez pour retrouver un résultat, ou pour l'exécuter de nouveau.

![La page Exécutions avec les filtres et le tableau des exécutions et de leurs boutons d'exportation.](shots/fr-FR/user/41-runs.png)

| Contrôle | Ce qu'il fait |
|---|---|
| Filtre **Carte** | Affiche une seule carte. **Toutes les cartes** les affiche toutes |
| Filtre **Statut** | **Tous les statuts**, **En attente**, **En cours**, **Terminée**, **Échec**, **Annulée** |
| Filtre **Type** | **Tous les types**, **En direct** (vous l'avez lancée) ou **Programmée** |
| Nom de la carte | Ouvre la visionneuse |
| Icône **Ouvrir** | Ouvre le résultat stocké |
| Icône **Exécuter à nouveau** | Lance une exécution avec les mêmes valeurs. Elle indique **Résultat réutilisé** si un résultat valide existe déjà |
| **XLSX**, **CSV**, **PDF** | Télécharge le résultat de l'exécution. Uniquement pour les résultats terminés et valides, et seulement si votre accès permet l'exportation |
| Icône **Annuler** | Annule une exécution en file d'attente. Non proposée pour une exécution en cours |
| Icône **Supprimer** | Supprime une exécution terminée, échouée ou annulée, ainsi que ses lignes. Irréversible |

Le tableau affiche **Carte**, **Type**, **Paramètres**, **Statut**, **Lignes**, **Durée**, **Exécutée le**, **Expire dans** et **Actions**. **Expire dans** indique combien de temps le résultat stocké est conservé : 24 heures pour une exécution en direct, plus longtemps pour les exécutions planifiées. Quand il indique **Expiré**, exécutez de nouveau la carte.

Vous ne voyez que vos propres exécutions. La page s'actualise toute seule pendant une exécution.

---

# Exportations

La page **Exportations** liste les fichiers que vous avez demandés. Vous l'utilisez pour télécharger de nouveau un fichier.

![La page Exportations listant les exportations avec un bouton Télécharger sur celles qui sont terminées.](shots/fr-FR/user/44-exports.png)

| Contrôle | Ce qu'il fait |
|---|---|
| Tableau | **Carte**, **Format** (XLSX, CSV, PDF), **État** (**En file d'attente**, **En cours**, **Terminée**, **Échouée**), **Lignes**, **Créée**. Survolez **Échouée** pour lire la raison |
| Icône **Télécharger** | Télécharge un fichier terminé |

> **Remarque :** les fichiers sont conservés 7 jours, pas indéfiniment. Si un téléchargement échoue, refaites l'exportation depuis la visionneuse. Le téléchargement échoue aussi si votre accès d'exportation à la carte a été retiré.

Vous ne pouvez pas créer d'exportations ici. Créez-les dans la visionneuse, dans **Exécutions** ou dans l'historique d'une planification.

---

# Planifications

La page **Planifications** exécute une carte automatiquement à des heures définies et stocke les résultats. Vous l'utilisez pour les rapports dont vous avez besoin chaque jour, semaine ou mois.

Vous pouvez planifier une carte qui vous appartient, ou qui est partagée avec vous en **Peut exporter** ou **Peut modifier**. Une carte publique ou un partage **Peut consulter** ne peut pas être planifié. Une planification s'exécute sous votre identité, avec vos accès aux données.

![La page Planifications avec une planification en pause et ses icônes d'action.](shots/fr-FR/user/38-schedules-list.png)

| Contrôle | Ce qu'il fait |
|---|---|
| **Nouvelle planification** | Ouvre la boîte de dialogue de création |
| Tableau | **Nom**, **Carte**, **Planification**, **Prochaine exécution**, **Format**, **Statut** (**Actif** ou **En pause**), **Planificateur** |
| Icône Lecture (**Exécuter maintenant**) | Lance une exécution immédiatement. Désactivée en pause |
| Icône **Suspendre** / **Activer** | Arrête ou relance la planification |
| Icône **Historique** | Affiche les 50 dernières exécutions |
| Icône **Modifier** | Ouvre **Modifier la planification**. La carte ne peut pas être changée |
| Icône **Supprimer** | Supprime la planification et son historique. Irréversible |

La colonne **Planificateur** est renseignée pour les planifications migrées depuis Oracle Discoverer. Elle indique si la planification migrée a pu être planifiée. Vous ne pouvez pas la modifier. **Non vérifié** signifie que rien n'a été enregistré.

## Nouvelle planification

1. Cliquez sur **Nouvelle planification**. Vous pouvez aussi cliquer sur l'icône Calendrier dans **Cartes** : la carte est alors déjà choisie.
2. Choisissez la **Carte**. La liste affiche vos cartes et les cartes partagées avec vous, marquées « (partagée) ». Une carte partagée avec vous en **Peut consulter** ne figure pas dans la liste, car ce niveau ne permet pas de planification.
3. Saisissez un **Nom**.
4. Choisissez une **Fréquence**, un **Fuseau horaire** et un **Format de sortie**.
5. Remplissez les **Préréglages de paramètres** si la carte a des paramètres.
6. Laissez **Activé** coché et cliquez sur **Enregistrer**.

![La boîte de dialogue Nouvelle planification remplie, avec une fréquence mensuelle et Activé décoché.](shots/fr-FR/user/37-schedule-filled.png)

| Champ | Signification / quand le choisir |
|---|---|
| **Fréquence** : **Tous les jours (minuit)** | Tous les jours à 00:00 dans le fuseau horaire choisi |
| **Fréquence** : **Toutes les semaines (dimanche, minuit)** | Tous les dimanches à 00:00 |
| **Fréquence** : **Tous les mois (le 1er, minuit)** | Le 1er de chaque mois à 00:00 |
| **Fréquence** : **Personnalisé** | Vous saisissez une **Expression cron**, cinq champs : minute, heure, jour du mois, mois, jour de la semaine. Par exemple `0 9 * * 1-5` correspond à 09:00 les jours ouvrés |
| **Fuseau horaire** | L'horloge utilisée par la planification. UTC est la valeur par défaut |
| **Valide à partir de (facultatif)**, **Valide jusqu'au (facultatif)** | La planification ne s'exécute pas avant ou après ces dates |
| **Format de sortie** : **Excel (.xlsx)** ou **CSV** | Le type de fichier du résultat stocké. CSV est la valeur par défaut |
| **Préréglages de paramètres** | Les valeurs utilisées pour chaque exécution. Les valeurs obligatoires sont marquées * |
| **Activé** | Si décoché, la planification attend que vous l'activiez |

## Historique

**Historique** affiche **Exécuté**, **Statut** (**SUCCESS**, **FAILED**, **TIMEOUT**), **Lignes** et **Durée**. Pour chaque résultat, **Ouvrir** l'affiche, et **XLSX**, **CSV** et **PDF** créent un fichier (si votre accès permet l'exportation). **Expire** indique combien de temps le résultat est conservé, 30 jours par défaut.

Les résultats restent sur le serveur. Rien n'est envoyé par e-mail.

---

# Paramètres

**Paramètres** modifie l'apparence de l'application pour vous. Ouvrez-les depuis la barre latérale ou depuis votre nom en haut à droite. Les paramètres appartiennent à votre compte et vous suivent sur d'autres ordinateurs.

![La page Paramètres avec les cartes Langue, Thème et Palette de couleurs.](shots/fr-FR/common/04-settings.png)

| Contrôle | Ce qu'il fait |
|---|---|
| **Langue d'affichage** | **English**, **Português (Portugal)**, **Français (France)**, **Español (España)** |
| **Apparence** | **Clair**, **Sombre**, **Contraste élevé** |
| **Palette** | **Classique**, **Bleu marine**, **Forêt**, **Vin**, **Océan**, **Ocre**. Indisponible avec **Contraste élevé** |
| **Enregistrer** | Conserve vos choix sur votre compte |

Vos choix s'affichent immédiatement. Ils ne sont conservés sur tous les appareils qu'après un clic sur **Enregistrer**.

---

# Questions fréquentes

**Je ne vois pas une carte qu'un collègue voit.** Les cartes sont visibles si elles vous appartiennent, si elles sont publiques ou si elles ont été partagées avec vous. Être dans le même domaine d'activité ne suffit pas. Demandez au propriétaire de la partager. Un manager ou un administrateur voit toutes les cartes : votre collègue a peut-être un autre rôle.

**J'ai ouvert une carte et l'exécution indique « Exécution non autorisée ».** Vous pouvez voir la carte, mais vous n'avez pas accès aux données de l'un de ses dossiers. Demandez à votre administrateur l'accès à ce domaine d'activité.

**J'ai cliqué sur Excel et j'ai obtenu « Échec de l'exportation » ou « Forbidden ».** La carte est partagée avec vous en **Peut consulter**. Demandez **Peut exporter** au propriétaire.

**Je ne peux pas enregistrer ma nouvelle carte.** L'enregistrement exige le droit de création dans le domaine d'activité de la carte. Demandez à votre administrateur.

**L'icône Modifier est absente.** Vous ne pouvez modifier que vos propres cartes et les cartes partagées en **Peut modifier**. Copiez la carte, puis modifiez votre copie.

**Je ne peux pas planifier une carte.** Vous devez en être le propriétaire, ou avoir **Peut exporter** ou **Peut modifier**. Les cartes publiques ne peuvent pas être planifiées.

**Mon résultat indique Expiré.** Les résultats en direct restent 24 heures. Exécutez de nouveau la carte.

**Je ne retrouve pas une ancienne exportation.** Les fichiers sont supprimés au bout de 7 jours. Exportez de nouveau.

**J'ai oublié mon mot de passe.** Demandez à votre administrateur de le réinitialiser.

**Je ne vois pas Domaines d'activité, Utilisateurs ou Migration.** Ces pages sont destinées à d'autres rôles.

---

# Glossaire

| Terme | Signification |
|---|---|
| Carte | Un rapport. Dans Oracle Discoverer, c'était une feuille de calcul |
| Classeur | Un groupe de cartes |
| Domaine d'activité | Un groupe de données liées. Votre administrateur vous donne des droits dessus |
| Dossier | Un ensemble d'éléments liés dans un domaine d'activité, comme une table |
| Élément | Un champ. Une dimension est un libellé, une mesure est un nombre que l'on additionne |
| Exécution | Un lancement d'une carte qui produit un résultat |
| Exportation | Un fichier (Excel, CSV ou PDF) créé à partir d'un résultat |
| Planification | Un calendrier qui exécute une carte automatiquement et stocke le résultat |
| Partage | Donner à un autre utilisateur l'accès à une carte qui vous appartient : **Peut consulter**, **Peut exporter** ou **Peut modifier** |
| Carte publique | Une carte que tout utilisateur peut ouvrir, exécuter et exporter. Elle ne peut pas être planifiée par d'autres |
| Paramètre | Une valeur que la carte demande quand vous l'exécutez |
| Expression cron | Cinq champs qui indiquent quand une planification s'exécute |
