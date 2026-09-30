# Votre rôle en un coup d'œil

Vous êtes **Manager**. Vous voyez toutes les cartes de Discoverer Neo, vous les exécutez, les exportez, les planifiez et les partagez. Vous veillez à qui peut ouvrir quoi, et vous gérez les comptes Manager, User et Viewer. Vous ne modifiez pas le modèle de données, les fonctions personnalisées ni les sources de données. C'est le travail d'un administrateur.

Une **carte** est un rapport (dans Oracle Discoverer, c'était une feuille de calcul). Un **classeur** est un groupe de cartes. Un **domaine d'activité** est un groupe de données liées. Un **dossier** est une table ou une vue d'un domaine d'activité, et un **élément** est une colonne d'un dossier.

## Ce que vous pouvez / ne pouvez pas faire

| Vous pouvez | Vous ne pouvez pas |
|---|---|
| Voir toutes les cartes, y compris les cartes privées | Modifier une carte qui ne vous appartient pas, sauf si elle est partagée avec vous en **Peut modifier** |
| Exécuter, exporter et planifier toutes les cartes (les règles de données ci-dessous s'appliquent toujours) | Supprimer une carte qui ne vous appartient pas |
| Partager n'importe quelle carte, et modifier ou retirer n'importe quel partage | Voir le texte SQL ou le plan de base de données d'une exécution |
| Copier n'importe quelle carte pour créer votre propre version | Modifier les domaines d'activité, leurs accès, dossiers, éléments, jointures ou hiérarchies, quel que soit votre accès |
| Transmettre une carte à un autre propriétaire | Créer ou supprimer des utilisateurs, ni donner à quiconque le rôle ADMIN |
| Voir les comptes Manager, User et Viewer, et quelles cartes chaque personne peut ouvrir | Voir ou modifier les comptes d'administrateur |
| Modifier, activer et désactiver les comptes Manager, User et Viewer | Voir les exécutions, exportations ou planifications des autres |
| Créer des cartes sur les domaines d'activité où vous avez un accès | Utiliser Fonctions personnalisées, Sources de données, Sécurité, Journal d'audit ou Migration (administrateurs uniquement) |

> **Remarque :** **Domaines d'activité**, **Dossiers**, **Éléments**, **Jointures**, **Hiérarchies**, **Fonctions personnalisées**, **Sources de données**, **Sécurité**, **Journal d'audit** et **Migration** sont réservés aux administrateurs. Ils ne figurent pas dans votre barre latérale.

## D'où viennent vos accès

Trois éléments décident de ce que vous pouvez faire.

- **Votre rôle.** En tant que Manager, vous pouvez voir, exécuter, exporter, planifier et partager toutes les cartes. Cela ne dépend pas des partages.
- **Les partages.** Vous ne pouvez modifier une carte que si elle vous appartient ou si quelqu'un l'a partagée avec vous en **Peut modifier**. Être Manager n'ajoute pas ce droit.
- **Les accès aux domaines d'activité.** Un administrateur vous donne un accès sur un domaine d'activité. Un accès a un niveau. Chaque niveau inclut les précédents.

| Niveau d'accès | Ce qu'il vous permet de faire dans ce domaine d'activité |
|---|---|
| VIEW | Lire ses données. Utiliser ses dossiers et éléments dans le créateur de cartes. |
| EXPORT | Identique à VIEW. Les droits d'exportation et de planification d'une carte dépendent de la façon dont la carte est partagée. |
| SCHEDULE | Identique à VIEW. Les droits d'exportation et de planification d'une carte dépendent de la façon dont la carte est partagée. |
| CREATE | Tout ce qui est dans VIEW, plus la création de nouvelles cartes. |
| EDIT | Identique à CREATE pour vous. Les droits supplémentaires sur le modèle de ce niveau sont réservés aux administrateurs. |
| DELETE | Identique à CREATE pour vous. Les droits supplémentaires sur le modèle de ce niveau sont réservés aux administrateurs. |

Contrairement à un administrateur, vous n'avez aucun contournement. Deux règles en découlent.

- Vous pouvez voir et exécuter toutes les cartes, mais les données passent en second. Une exécution ou une exportation exige un accès à chaque dossier utilisé par la carte. Sans lui, l'exécution échoue avec **Exécution non autorisée**. Demandez l'accès à un administrateur.
- Un accès ne fait pas apparaître de cartes. Vous voyez déjà toutes les cartes parce que vous êtes Manager.

## Se connecter, changer de mot de passe et se déconnecter

1. Ouvrez l'adresse de Discoverer Neo dans votre navigateur.
2. Saisissez votre **E-mail** et votre **Mot de passe**.
3. Laissez **Rester connecté** coché pour rester connecté après la fermeture du navigateur. Décochez-le sur un ordinateur partagé. Vous serez alors déconnecté à la fermeture du navigateur.
4. Cliquez sur **Se connecter**. Vous arrivez sur le **Tableau de bord**.

![La page de connexion avec E-mail, Mot de passe, Rester connecté et le bouton Se connecter.](shots/fr-FR/common/01-login.png)

Si vous saisissez cinq fois un mot de passe erroné, le compte est verrouillé pendant 15 minutes. Patientez, puis réessayez. Il n'y a pas de lien « mot de passe oublié ». Demandez à un administrateur de le réinitialiser.

Si votre compte a un mot de passe temporaire, Discoverer Neo vous envoie vers **Modifier votre mot de passe** et rien d'autre ne fonctionne tant que vous n'avez pas terminé.

Pour changer votre mot de passe à tout moment, ouvrez l'adresse `/change-password` dans la même fenêtre de navigateur. Saisissez votre mot de passe actuel, puis le nouveau deux fois. Le nouveau doit comporter au moins 12 caractères et être différent de l'ancien.

Pour vous déconnecter, cliquez sur votre nom en haut à droite et choisissez **Se déconnecter**. Cela met fin à votre session. Pour utiliser de nouveau Discoverer Neo, reconnectez-vous.

![Le menu du compte ouvert, avec Paramètres et Se déconnecter.](shots/fr-FR/common/03-user-menu.png)

---

# Tableau de bord

Le **Tableau de bord** est la première page que vous voyez. Il ne donne que des chiffres. Rien n'y modifie les données.

![Le tableau de bord du Manager avec la barre latérale et les cartes de synthèse.](shots/fr-FR/manager/01-dashboard-sidebar.png)

| Carte | Ce qu'elle montre pour vous |
|---|---|
| **Nombre total de cartes** | Toutes les cartes actives du système. La ligne du dessous les répartit entre « à vous » et « partagées avec vous ». Pour vous, « partagées avec vous » désigne les cartes de tous les autres, y compris les cartes privées. |
| **Nombre total d'exécutions** | Toutes les exécutions enregistrées, par n'importe qui, des cartes que vous pouvez voir. |
| **Cartes planifiées** | Les cartes qui ont au moins une planification active créée par vous. |
| **Résultats planifiés** | Les résultats stockés créés par vos propres planifications. |
| **Cartes récentes** | Les cinq dernières cartes que vous avez créées. Cliquez sur l'une d'elles pour l'ouvrir dans le créateur. |

Le lien **Voir les planifications** sur deux cartes ouvre la page **Planifications**.

---

# Utilisateurs

Utilisez la page **Utilisateurs** pour gérer les comptes Manager, User et Viewer, savoir quelles cartes une personne peut ouvrir, et corriger qui possède ou partage une carte. Les comptes d'administrateur ne figurent pas dans votre liste.

![La liste Utilisateurs d'un Manager, sans administrateurs et sans les boutons Nouvel utilisateur ni Fichier d'identifiants.](shots/fr-FR/manager/06-users.png)

La liste affiche **Nom**, **E-mail**, **Rôle** et **Statut** (**Actif** ou **Inactif**).

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| Icône de ligne **Cartes que cet utilisateur peut ouvrir** | Ouvre les cartes de cette personne. Voir ci-dessous. |
| Icône de ligne **Modifier** | Change le nom, l'e-mail, le mot de passe ou le rôle. Le rôle peut être MANAGER, USER ou VIEWER. Laissez **Mot de passe** vide pour le conserver. |
| Icône de ligne **Désactiver** / **Activer** | Empêche la personne de se connecter, ou l'autorise à se connecter de nouveau. Vous ne pouvez pas vous désactiver vous-même. |

Vous ne pouvez pas créer ni supprimer d'utilisateurs, donner le rôle ADMIN, ni émettre de fichier d'identifiants. Demandez à un administrateur.

## Cartes d'une personne

Cliquez sur l'icône de ligne **Cartes que cet utilisateur peut ouvrir**. La boîte de dialogue **Cartes de {name}** liste chaque carte que cette personne voit.

![La boîte de dialogue Cartes d'un utilisateur, avec les listes de niveau de partage et les icônes de propriétaire et de retrait.](shots/fr-FR/manager/09-users-maps-dialog.png)

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| Nom de la carte | Ouvre la carte dans la visionneuse. |
| **Propriétaire: {name}** | Indique qui possède la carte. |
| Badge | Indique pourquoi la personne voit la carte. |
| Liste du niveau de partage | Change ce que la personne peut faire avec une carte partagée. |
| Icône de propriétaire | Ouvre la liste **Nouveau propriétaire**. |
| **Nouveau propriétaire** | Choisissez une personne à qui donner la carte. |
| Icône de retrait (X) | Retire la carte à cette personne. Sans confirmation. |

| Option (badge) | Signification |
|---|---|
| Propriétaire | La personne possède la carte. |
| Partagée | Quelqu'un a partagé la carte avec la personne. Vous pouvez le modifier ou le retirer. |
| Publique | La carte est publique. |
| Rôle de gestionnaire | La personne est manager et voit toutes les cartes. |

| Option (niveau de partage) | Signification / quand la choisir |
|---|---|
| Peut consulter | Peut ouvrir et exécuter la carte. Ne peut pas l'exporter, la planifier ni la modifier. |
| Peut exporter | Peut ouvrir et exécuter la carte, exporter son résultat et la mettre en planification. |
| Peut modifier | Peut faire tout ce qui précède, et aussi modifier la carte. |

## Exemple : donner une carte à un collègue qui prend le relais

1. Cliquez sur **Utilisateurs**, puis sur l'icône de ligne **Cartes que cet utilisateur peut ouvrir** du propriétaire actuel.
2. Trouvez la carte. Cliquez sur l'icône de propriétaire.
3. Dans **Nouveau propriétaire**, choisissez le collègue.
4. Attendez le message **Propriétaire modifié**.

> **Attention :** le nouveau propriétaire peut modifier, partager et supprimer la carte. Votre propre partage antérieur est supprimé. Vous ne devenez pas éditeur de la carte en la transmettant.

---

# Cartes

La page **Cartes** liste toutes les cartes du système. Vous voyez tout, y compris les cartes privées. Voir une carte ne signifie pas que vous pouvez lire ses données. Les règles de données du premier chapitre s'appliquent toujours.

![La liste Cartes, onglet Tous, avec les icônes Copier, Partager, Planifier et Exporter sur chaque ligne.](shots/fr-FR/manager/02-maps-all.png)

## Trouver une carte

| Contrôle | Ce qu'il fait |
|---|---|
| Onglet **Mes cartes** | Les cartes que vous avez créées. |
| Onglet **Partagées avec moi** | Les cartes que quelqu'un a partagées avec vous, à n'importe quel niveau. |
| Onglet **Tous** | Toutes les cartes du système. |
| **Rechercher des cartes par nom…** | Filtre par nom. |
| Filtre **Domaine Métier** | Affiche un seul domaine d'activité. Choisissez **Tous les domaines métier** pour réinitialiser. |
| **Trier par** | **Récemment modifiés** ou **Nom (A–Z)**. |
| **Effacer** | Réinitialise la recherche et le filtre. |

La section **Classeurs** en haut regroupe les cartes par classeur. Cliquez sur un classeur pour voir ses cartes. Cliquez sur une carte pour l'ouvrir.

## Ce que fait chaque icône

| Icône | Ce qu'elle fait |
|---|---|
| Œil | Ouvre la visionneuse pour que vous puissiez exécuter la carte. |
| Crayon | Ouvre le créateur. Affiché uniquement pour les cartes qui vous appartiennent, ou qui sont partagées avec vous en **Peut modifier**. |
| Copier | Crée votre propre copie, que vous pouvez ensuite modifier. Fonctionne pour toute carte. |
| Partager | Ouvre **Partager la carte**. Fonctionne pour toute carte. |
| Calendrier | Ouvre **Planifications** avec cette carte choisie. |
| Télécharger | Ouvre la visionneuse, où vous exportez. |
| Corbeille | Supprime la carte. Affichée uniquement pour vos propres cartes. |

La ligne d'un classeur a ses propres icônes. Copier crée une copie privée de chaque carte du classeur. Partager donne à quelqu'un chaque carte du classeur. La corbeille ne supprime un classeur que si vous possédez toutes ses cartes.

> **Attention :** une carte supprimée ne peut être récupérée que par un administrateur.

## Copier une carte pour créer la vôtre

1. Trouvez la carte et cliquez sur l'icône Copier.
2. Pour un classeur, saisissez un nom dans **Nom du nouveau classeur** et cliquez sur **Copier**.
3. La copie s'ouvre dans le créateur. Elle est privée pour vous.

Exemple : copiez **GD_M.M10_V01.DIS**, puis ajoutez une colonne à votre copie. L'original ne change pas.

## Partager une carte

1. Cliquez sur l'icône Partager de la carte.
2. Recherchez une personne par nom ou e-mail.
3. Cliquez sur un niveau à côté de son nom : **Peut consulter**, **Peut exporter** ou **Peut modifier**. Le bouton foncé est ce qu'elle détient actuellement.
4. Pour retirer l'accès, cliquez sur le X à côté de son nom.

![La boîte de dialogue Partager la carte avec une zone de recherche et les boutons Peut consulter, Peut exporter et Peut modifier.](shots/fr-FR/manager/03-share-dialog.png)

La boîte de dialogue affiche aussi un avis quand la carte est publique, avec **Copier le lien**. Toute personne disposant du lien peut la consulter. Cette boîte de dialogue ne fait pas passer une carte de publique à privée. Ce basculement se trouve dans l'onglet **Propriétés** de la carte, et seule une personne qui peut modifier la carte peut l'enregistrer.

Pour un classeur, la même boîte de dialogue répartit un partage sur toutes les cartes du classeur que vous pouvez voir. Elle vous indique quelles cartes n'ont pas pu être partagées.

---

# Créateur de cartes

Utilisez le créateur pour créer une carte ou en modifier une. Vous y accédez avec **Créer une carte**, l'icône Crayon, ou en copiant une carte.

![Le créateur de cartes avec l'arborescence Domaines d'activité, la zone Colonnes et le panneau Propriétés.](shots/fr-FR/user/05-builder-overview.png)

## Ce que vous pouvez enregistrer

| Situation | Pouvez-vous enregistrer ? |
|---|---|
| Une nouvelle carte | Oui, si vous avez un accès CREATE ou supérieur sur le domaine d'activité. |
| Une carte qui vous appartient | Oui. |
| Une carte partagée avec vous en **Peut modifier** | Oui. |
| Toute autre carte | Non. L'enregistrement échoue avec « Forbidden ». Copiez d'abord la carte, puis modifiez votre copie. |

Le créateur s'ouvre pour toutes les cartes, même une carte que vous ne pouvez pas enregistrer. Vous ne le découvrez qu'en cliquant sur **Enregistrer**.

## La barre d'outils

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Retour** | Revient à la page d'où vous venez. Les modifications non enregistrées sont perdues sans avertissement. |
| Zone du nom de la carte | Définit le nom de la carte. |
| Liste du type de carte | **Tableau**, **Tableau croisé**, **Page-Détail** ou **Graphique**. Seul **Tableau croisé** change l'aspect du résultat. Les autres s'affichent comme un tableau simple. |
| **● Non enregistré** | Vous rappelle que des modifications ne sont pas enregistrées. |
| **Exécuter** | Enregistre la carte si elle est nouvelle ou modifiée, puis l'exécute. |
| **Enregistrer** | Enregistre vos modifications. Rien ne s'enregistre automatiquement. |
| **Exporter** > **Définition de la carte (.xml)** | Télécharge la définition de la carte. Elle ne contient aucune ligne de données. Exige une carte enregistrée. |
| **Planifier** | Ouvre **Planifications** avec cette carte choisie. Exige une carte enregistrée. |
| **Mise en forme** | Ouvre la mise en forme conditionnelle. Exige une carte enregistrée. |
| **Partager** | Ouvre **Partager la carte**. Exige une carte enregistrée. |

## Créer une carte

1. Dans l'arborescence **Domaines d'activité** à gauche, ouvrez un domaine d'activité et un dossier. Seuls les domaines où vous avez un accès sont listés.
2. Faites glisser des éléments vers la zone **Colonnes**, ou cliquez sur le bouton plus à côté d'un élément. Les mesures ont une icône sigma, les dimensions une icône d'étiquette.
3. Chaque colonne d'une carte doit provenir d'un seul domaine d'activité. La première colonne que vous ajoutez décide lequel.
4. Cliquez sur une colonne pour ouvrir **Configurer la colonne**. Modifiez ce dont vous avez besoin, puis cliquez sur **Enregistrer** dans cette boîte de dialogue.
5. Ajoutez des conditions, un tri et des paramètres dans les onglets de droite.
6. Cliquez sur **Enregistrer** dans la barre d'outils. Puis cliquez sur **Exécuter**.

Utilisez **Filtrer les éléments…** au-dessus de l'arborescence pour trouver un élément par son nom.

## Configurer la colonne

| Champ | Ce qu'il fait |
|---|---|
| **Nom d'affichage** | Titre de la colonne. Vide, il reprend le nom de l'élément. |
| **Agrégation** | Total de cette colonne. |
| **Sens du tri** | **Aucun**, **Croissant** ou **Décroissant**. |
| **Masque de format** | L'aspect des nombres et des dates. **Préréglages** le remplit pour vous. |
| **Ordre de tri** | Position de cette colonne quand vous triez selon plusieurs. |
| **Largeur de colonne (px)** | Largeur en pixels. |
| **Placement** | Voir ci-dessous. |
| **Bord du tableau croisé** | L'emplacement d'une colonne d'axe dans un tableau croisé. |
| **Grouper et rompre** | Masque les valeurs répétées et démarre un sous-total quand la valeur change. |
| **Requête seulement, ne pas afficher** | La requête utilise la colonne, mais le résultat la masque. |

| Option (**Placement**) | Signification |
|---|---|
| Aucun | Aucun rôle particulier. |
| Grouper par (axe) | La colonne regroupe les lignes. |
| Mesure | La colonne contient une valeur qui est totalisée. |
| Élément de page | La colonne devient un filtre de page. |

| Option (**Bord du tableau croisé**) | Signification |
|---|---|
| Aucun | Non utilisé dans un tableau croisé. |
| Sur le côté | Les valeurs descendent sur le côté gauche. |
| En haut | Les valeurs s'étendent en haut. |

| Option (**Préréglages**) | Ce qu'elle remplit |
|---|---|
| Nombre (1 234) | 999,999,999 |
| Décimal (1 234,00) | 999,999,999.00 |
| Devise (1 234,00 €) | $999,999,999.00 |
| Pourcentage (12,3 %) | 990.0% |
| Date (DD-MON-YYYY) | DD-MON-YYYY |
| Date (YYYY-MM-DD) | YYYY-MM-DD |

## Les cinq onglets de paramètres

| Onglet | À quoi il sert |
|---|---|
| **Propriétés** | La **Description** imprimée au-dessus des résultats et sur chaque exportation, la case **Public (visible par tous dans le domaine d'activité)**, et des compteurs. **Insérer une variable** ajoute des valeurs comme la date d'exécution. |
| **Conditions** | Filtres. |
| **Tri** | Niveaux de tri. |
| **Paramètres** | Questions posées quand la carte s'exécute. |
| **Champs calculés** | Nouvelles colonnes à partir d'une formule. |

> **Attention :** **Public** rend la carte consultable et exportable par toute personne connectée, pas seulement par les personnes du domaine d'activité. Leurs droits sur les données s'appliquent toujours.

**Conditions.** Cliquez sur **Ajouter une condition**. Choisissez l'**Élément**, un **Opérateur** et une valeur. Choisissez **Valeur statique** pour une valeur fixe, ou **Demander à l'exécution** pour poser la question à chaque fois. Pour une invite, donnez au paramètre un nom que vous avez défini dans l'onglet **Paramètres**. Sélectionnez deux conditions ou plus et cliquez sur **Grouper** pour les relier par OR. Utilisez **Dégrouper** pour annuler.

| Option (**Opérateur**) | Signification |
|---|---|
| = | Égal à. |
| <> | Différent de. |
| < et > | Inférieur à, supérieur à. |
| <= et >= | Inférieur ou égal, supérieur ou égal. |
| LIKE | Correspond à un motif avec % et _. |
| IN | Correspond à l'un des éléments d'une liste, séparés par des virgules. |
| BETWEEN | Entre deux valeurs, la plus basse puis la plus haute. |
| IS NULL | La valeur est vide. |

**Tri.** Choisissez une colonne, cliquez sur **Ajouter un tri**, puis choisissez **Croissant** ou **Décroissant**. Faites glisser un niveau pour changer sa priorité.

**Paramètres.** Cliquez sur **Ajouter un paramètre**. Donnez-lui un nom unique, un type et, si vous le souhaitez, une valeur par défaut. Cochez **Obligatoire** pour refuser une réponse vide. Si chaque paramètre a une valeur par défaut, **Exécuter** saute la question.

| Option (type de paramètre) | Signification |
|---|---|
| STRING | Du texte. |
| NUMBER | Un nombre. |
| DATE | Une date. |
| LIST | Plusieurs valeurs séparées par des virgules. |

**Champs calculés.** Cliquez sur **Ajouter un champ calculé**, nommez-le, puis cliquez sur le bouton de formule. Dans l'**Éditeur de formules**, saisissez une formule ou cliquez sur les boutons de fonctions et de colonnes pour les insérer. **Tester la formule** l'exécute sur les cinq premières lignes d'une carte enregistrée. Elle exige un accès aux données.

## Mise en forme conditionnelle

Cliquez sur **Mise en forme** pour colorer des cellules ou des lignes entières selon une règle, par exemple en rouge quand une valeur est inférieure à zéro. Les règles sont enregistrées immédiatement et ne font pas partie de **Enregistrer**. Vous devez posséder la carte ou avoir **Peut modifier** dessus pour ajouter ou supprimer des règles. Sinon, le système refuse avec « Forbidden ».

| Champ | Signification |
|---|---|
| **Colonne** | La colonne à tester. |
| **Appliquer à** | **Cellule** ou **Ligne**. |
| **Opérateur** | **Égal à**, **Différent de**, **Supérieur à**, **Inférieur à**, **Supérieur ou égal à**, **Inférieur ou égal à**, **Contient (jokers % et _)**, **Dans la liste**, **Entre** ou **Est vide**. |
| **Valeur** | Ce à quoi comparer. Masquée pour **Est vide**. |
| **Couleur de fond**, **Couleur du texte** | Couleurs. **Effacer** en supprime une. |
| **Gras**, **Italique**, **Souligné** | Style du texte. |

## Cartes refusées

Certaines formes de cartes sont refusées avant l'exécution, par exemple des dossiers sans jointure, ou des totaux qui seraient comptés deux fois. Une zone orange explique pourquoi et ce qu'il faut changer. Ajoutez une jointure, retirez des colonnes, ou scindez la carte en deux.

---

# Visionneuse de cartes

La visionneuse exécute une carte et affiche ses lignes. Elle ne modifie jamais la carte. Vous y accédez avec l'icône en forme d'œil, ou depuis **Exécutions** et **Exportations**.

![Une exécution terminée avec les boutons Excel, CSV et PDF au-dessus de la grille de résultats.](shots/fr-FR/viewer/06-viewer-results.png)

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Exécuter** | Exécute la carte. Si un paramètre n'a pas de valeur par défaut, **Paramètres d'exécution** s'ouvre d'abord. |
| **Exécuter à nouveau** | Après une exécution terminée, demande une nouvelle exécution avec les mêmes valeurs. |
| **Annuler** | Annule une exécution qui attend encore dans la file d'attente. Une exécution déjà en cours ne peut pas être annulée ici. |
| **Gestion des planifications** | Ouvre **Planifications**. |
| **Excel**, **CSV**, **PDF** | Exportent le résultat terminé. |
| **Charger plus** | Charge les 500 lignes suivantes. |
| Clic sur un en-tête | Trie selon cette colonne. |
| **Filtrer…** sous un en-tête | Filtre les lignes déjà chargées. |
| Double-clic sur une ligne | Ouvre **Explorer le détail**, les lignes brutes derrière cette ligne. |

La ligne d'état sous **Exécuter** indique si le résultat est récent ou a été réutilisé. Un résultat reste valable 24 heures. Si vous exécutez de nouveau la même carte avec les mêmes valeurs pendant ce délai, vous obtenez le résultat stocké. Utilisez **Exécuter à nouveau** pour en forcer un nouveau.

**Exécuter** et **Exporter** exigent un accès à chaque dossier de la carte. Sans lui, une zone rouge **Exécution non autorisée** apparaît. Demandez l'accès à un administrateur.

Vous ne voyez pas les boutons **SQL** et **Plan**. Ils sont réservés aux administrateurs.

La boîte de dialogue **Paramètres d'exécution** pose une question par paramètre. Une étoile rouge marque un paramètre obligatoire. Quand le paramètre alimente un filtre sur un élément, un sélecteur suggère les valeurs réelles. Il exige un accès à ce domaine.

## Exporter en PDF

Cliquez sur **PDF** pour ouvrir **Exporter en PDF**.

| Champ | Signification |
|---|---|
| **Format du papier** | **A4**, **A3** ou **Lettre**. |
| **Orientation** | **Portrait** ou **Paysage**. |
| **Colonnes** | Cochez les colonnes à imprimer. **Tout sélectionner** et **Effacer** les basculent toutes. |

Cliquez sur **Exporter**. La description de la carte est imprimée en haut de la première page.

## Exemple : exécuter et exporter GD_M.M10_V01.DIS

1. Ouvrez **Cartes**, trouvez **GD_M.M10_V01.DIS** et cliquez sur l'icône en forme d'œil.
2. Cliquez sur **Exécuter**. Répondez aux questions s'il y en a.
3. Quand les lignes apparaissent, cliquez sur **Excel**.
4. Ouvrez **Exportations** pour télécharger le fichier.

---

# Planifications

Une planification exécute une carte automatiquement selon un calendrier et stocke le résultat. Vous ne voyez que vos propres planifications, même si vous pouvez planifier n'importe quelle carte.

![La page Planifications avec une planification en pause et ses icônes d'action.](shots/fr-FR/user/38-schedules-list.png)

Pour planifier une carte qui ne vous appartient pas, utilisez l'icône Calendrier de la page **Cartes**. La liste des cartes de la boîte de dialogue **Nouvelle planification** ne contient que vos propres cartes et les cartes partagées avec vous.

Une planification s'exécute sous votre identité. Vos accès aux domaines d'activité décident si elle peut lire les données.

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Nouvelle planification** | Ouvre la boîte de dialogue. |
| Icône de ligne **Exécuter maintenant** | L'exécute immédiatement. Indisponible en pause. |
| Icône de ligne **Suspendre** ou **Activer** | Désactive ou active la planification. |
| Icône de ligne **Historique** | Ouvre **Historique d'exécution**. |
| Icône de ligne **Modifier** | Modifie la planification. Vous ne pouvez pas changer sa carte. |
| Icône de ligne **Supprimer** | Supprime la planification et son historique après confirmation. Irréversible. |

La colonne **Statut** affiche **Actif** ou **En pause**. La colonne **Planificateur** est remplie par la migration. Vous ne pouvez pas la modifier.

| Champ de la boîte de dialogue | Signification |
|---|---|
| **Carte** | La carte à exécuter. |
| **Nom** | Le nom de la planification. |
| **Fréquence** | Voir ci-dessous. |
| **Fuseau horaire** | L'horloge utilisée par les heures. UTC par défaut. |
| **Expression cron** | Affichée pour **Personnalisé**. Cinq champs : minute, heure, jour du mois, mois, jour de la semaine. |
| **Valide à partir de** et **Valide jusqu'au** | Dates facultatives. La planification ne s'exécute qu'entre les deux. |
| **Format de sortie** | Voir ci-dessous. |
| **Préréglages de paramètres** | La valeur utilisée à chaque fois pour chaque paramètre de la carte. |
| **Activé** | Désactivé, elle ne s'exécute jamais toute seule. |

| Option (**Fréquence**) | Signification |
|---|---|
| Tous les jours (minuit) | Tous les jours à 00:00. |
| Toutes les semaines (dimanche, minuit) | Tous les dimanches à 00:00. |
| Tous les mois (le 1er, minuit) | Le premier de chaque mois à 00:00. |
| Personnalisé | Vous écrivez l'expression cron. Exemple : `0 9 * * 1-5` correspond à 09:00 les jours ouvrés. |

| Option (**Format de sortie**) | Signification |
|---|---|
| Excel (.xlsx) | Une feuille de calcul. |
| CSV | Un tableau en texte brut. La valeur par défaut. |

**Historique d'exécution** liste les 50 derniers résultats avec **Exécuté**, **Statut**, **Lignes** et **Durée**. Chacun a des boutons **XLSX**, **CSV** et **PDF** et une icône **Ouvrir**. Les résultats sont conservés 30 jours. Ensuite, les boutons d'exportation disparaissent.

## Exemple : planifier une exécution hebdomadaire

1. Dans **Cartes**, cliquez sur l'icône Calendrier de la carte.
2. Saisissez un **Nom**. Réglez **Fréquence** sur **Toutes les semaines (dimanche, minuit)**.
3. Choisissez votre **Fuseau horaire** et votre **Format de sortie**.
4. Cliquez sur **Enregistrer**.
5. Cliquez sur l'icône **Exécuter maintenant** pour vérifier que cela fonctionne. Puis ouvrez **Historique**.

---

# Exécutions

**Exécutions** liste chaque exécution que vous avez demandée, qu'elle soit en attente, en cours ou terminée. Elle n'affiche que vos propres exécutions, pas celles des autres.

![La page Exécutions avec les filtres Carte, Statut et Type et la liste des exécutions.](shots/fr-FR/manager/08-runs.png)

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| Filtres **Carte**, **Statut**, **Type** | Réduisent la liste. **Type** est **En direct** ou **Programmée**. |
| Nom de la carte | Ouvre la visionneuse. |
| Icône **Ouvrir** | Ouvre le résultat stocké de cette exécution. |
| Icône **Exécuter à nouveau** | Demande de nouveau la même exécution. |
| **XLSX**, **CSV**, **PDF** | Exportent une exécution terminée qui n'a pas expiré. |
| Icône **Annuler** | Annule une exécution encore en file d'attente. |
| Icône **Supprimer** | Supprime une exécution terminée et ses lignes stockées. Irréversible. |

La colonne **Expire dans** indique combien de temps le résultat est conservé. La case **Afficher les exécutions de tous les utilisateurs** est réservée aux administrateurs, vous ne la voyez donc pas. Une exécution d'une carte que vous ne pouvez plus ouvrir disparaît de votre liste.

---

# Exportations

**Exportations** liste les fichiers que vous avez demandés. Vous ne voyez que les vôtres.

![La page Exportations listant les exportations avec un bouton Télécharger sur celles qui sont terminées.](shots/fr-FR/user/44-exports.png)

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| Icône **Télécharger** | Télécharge un fichier terminé. |

L'**État** affiche **En file d'attente**, **En cours**, **Terminée** ou **Échouée**. Pointez un état d'échec pour lire la raison. Les fichiers sont conservés 7 jours. Ensuite, le téléchargement échoue. Exportez de nouveau à partir d'une nouvelle exécution.

---

# Paramètres

Ouvrez **Paramètres** depuis la barre latérale ou depuis le menu de votre nom. Les choix sont conservés pour votre compte sur tous les ordinateurs, mais seulement après un clic sur **Enregistrer**.

![La page Paramètres avec les cartes Langue, Thème et Palette de couleurs.](shots/fr-FR/common/04-settings.png)

| Contrôle | Ce qu'il fait |
|---|---|
| **Langue d'affichage** | **English**, **Português (Portugal)**, **Français (France)** ou **Español (España)**. |
| **Apparence** | **Clair**, **Sombre** ou **Contraste élevé**. |
| **Palette** | **Classique**, **Bleu marine**, **Forêt**, **Vin**, **Océan** ou **Ocre**. Désactivée quand **Contraste élevé** est actif. |
| **Enregistrer** | Conserve vos choix. |

Si vous partez sans enregistrer, ce navigateur affiche le nouveau choix, mais votre compte conserve l'ancien.

---

# Questions fréquentes

**Pourquoi vois-je une carte alors que l'exécution indique « Exécution non autorisée » ?**
Vous voyez toutes les cartes en tant que Manager. Ses données exigent un accès de domaine d'activité sur chaque dossier qu'elle utilise. Demandez à un administrateur.

**Pourquoi n'y a-t-il pas d'icône Crayon sur une carte ?**
Vous ne pouvez modifier que vos propres cartes et les cartes partagées avec vous en **Peut modifier**. Cliquez sur l'icône Copier, puis modifiez votre copie. Ou demandez au propriétaire de la partager avec vous en **Peut modifier**.

**Où sont Domaines d'activité, Dossiers, Éléments, Jointures et Hiérarchies ?**
Modifier le modèle de données est réservé aux administrateurs, donc ces pages ne figurent pas dans votre barre latérale. Si un dossier ou un élément est faux ou manquant, demandez à un administrateur.

**J'ai cliqué sur quelque chose et j'ai obtenu « Forbidden » ou « Échec de l'enregistrement ».**
L'écran le proposait, mais votre rôle ou votre accès ne le permet pas. Le cas le plus courant est l'enregistrement d'une carte qui ne vous appartient pas.

**Je ne vois pas les exécutions, exportations ou planifications d'une autre personne.**
Les exécutions, exportations et planifications appartiennent à la personne qui les a créées. Personne d'autre qu'elle ne les voit dans la liste, et il en va de même pour vous.

**Un collègue est parti. Comment conserver ses cartes ?**
Ouvrez **Utilisateurs**, cliquez sur **Cartes que cet utilisateur peut ouvrir**, puis utilisez l'icône de propriétaire de chaque carte pour la donner à quelqu'un d'autre.

**Une planification que j'ai créée ne s'exécute pas.**
Vérifiez que son **Statut** est **Actif**, que les dates de **Valide à partir de** et **Valide jusqu'au** couvrent aujourd'hui, et que vous avez toujours un accès aux données. Une planification s'exécute sous votre identité.

**Le téléchargement de mon exportation indique un échec.**
Les fichiers sont conservés 7 jours. Exécutez de nouveau la carte et exportez le nouveau résultat.

**Je ne peux pas changer mon mot de passe si je l'oublie.**
Il n'y a pas de lien de réinitialisation. Demandez à un administrateur.

---

# Glossaire

| Terme | Signification |
|---|---|
| Carte | Un rapport. Dans Oracle Discoverer, c'était une feuille de calcul. |
| Classeur | Un groupe de cartes. |
| Domaine d'activité | Un groupe de données liées. |
| Dossier | Une table, une vue ou une requête d'un domaine d'activité. |
| Élément | Une colonne d'un dossier. Une dimension regroupe les lignes. Une mesure contient des valeurs qui sont totalisées. |
| Jointure | La règle qui relie deux dossiers. |
| Hiérarchie | Une liste ordonnée d'éléments pour l'exploration par niveaux. |
| Accès | L'accès à un domaine d'activité donné par un administrateur, à un niveau. |
| Partage | L'accès à une carte donné à une personne, à un niveau : **Peut consulter**, **Peut exporter** ou **Peut modifier**. |
| Carte publique | Une carte que toute personne connectée peut consulter et exporter. Ses droits sur les données s'appliquent toujours. |
| Exécution | Un lancement d'une carte. Ses lignes sont stockées 24 heures. |
| Exportation | Un fichier (Excel, CSV ou PDF) créé à partir d'une exécution terminée. |
| Planification | Un calendrier qui exécute une carte automatiquement et stocke le résultat. |
