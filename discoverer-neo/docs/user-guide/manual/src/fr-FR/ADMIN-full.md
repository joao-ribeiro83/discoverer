# Votre rôle en un coup d'œil

Vous êtes **administrateur**. Vous pouvez utiliser toutes les pages de Discoverer Neo. Vous configurez les données sur lesquelles les cartes sont construites, vous décidez qui peut voir quoi, vous gérez les comptes utilisateurs et vous importez d'anciens travaux d'Oracle Discoverer.

Une **carte** est un rapport (dans Oracle Discoverer, c'était une feuille de calcul). Un **classeur** est un groupe de cartes. Un **domaine d'activité** est un groupe de données liées. Un **dossier** est une table ou une vue d'un domaine d'activité. Un **élément** est une colonne d'un dossier.

## Ce que vous pouvez / ne pouvez pas faire

| Vous pouvez | Vous ne pouvez pas |
|---|---|
| Ouvrir, exécuter, modifier, partager, copier et supprimer toutes les cartes | Supprimer ou désactiver votre propre compte |
| Créer des cartes dans n'importe quel domaine d'activité, sans accès | Télécharger l'exportation d'un autre utilisateur (les exportations sont toujours privées pour leur propriétaire) |
| Voir le SQL généré et le plan de base de données d'une carte | Voir les planifications d'un autre utilisateur dans la liste **Planifications** (vous voyez les vôtres) |
| Voir les exécutions de tous les utilisateurs (**Afficher les exécutions de tous les utilisateurs**) | |
| Créer, modifier et désactiver des domaines d'activité, dossiers, éléments, jointures, hiérarchies, fonctions personnalisées et sources de données | |
| Donner et retirer des accès aux domaines d'activité | |
| Créer, modifier, désactiver, supprimer et réactiver des utilisateurs | |
| Émettre un fichier d'identifiants avec des mots de passe temporaires | |
| Transférer une carte à un nouveau propriétaire | |
| Écrire des stratégies de sécurité au niveau des lignes | |
| Lire le journal d'audit | |
| Migrer un EUL Oracle Discoverer | |

## D'où viennent vos accès

Vos accès viennent de votre rôle. Ils ne dépendent ni des partages ni des accès.

- **Cartes.** Vous voyez toutes les cartes actives, quel qu'en soit le propriétaire. Vous pouvez modifier, partager et supprimer n'importe quelle carte.
- **Données.** Vous pouvez lire les données de chaque dossier sans accès au domaine d'activité. Chaque fois, le système écrit une note dans le journal d'audit.
- **Sécurité au niveau des lignes.** Les stratégies de sécurité au niveau des lignes s'appliquent toujours à vous (voir le chapitre **Stratégies de sécurité**).
- **Les autres personnes.** Les utilisateurs ordinaires ne voient que leurs propres cartes, les cartes publiques et les cartes partagées avec eux. Un accès à un domaine d'activité donne accès aux données. Il ne fait jamais apparaître une carte.

## Se connecter, changer de mot de passe et se déconnecter

1. Ouvrez l'adresse de Discoverer Neo dans votre navigateur.
2. Saisissez votre **E-mail** et votre **Mot de passe**.
3. Laissez **Rester connecté** coché pour rester connecté après la fermeture du navigateur. Décochez-le sur un ordinateur partagé. La session prend alors fin à la fermeture du navigateur.
4. Cliquez sur **Se connecter**.

![La page de connexion avec E-mail, Mot de passe, Rester connecté et le bouton Se connecter.](shots/fr-FR/common/01-login.png)

Après cinq mots de passe erronés, le compte est verrouillé pendant 15 minutes. Le message est **Trop de tentatives de connexion. Réessayez plus tard.** Si votre mot de passe est perdu, un autre administrateur doit vous en définir un nouveau. Il n'y a pas de lien « mot de passe oublié ».

La page **Modifier votre mot de passe** s'ouvre d'elle-même quand votre compte a un mot de passe temporaire. Saisissez le mot de passe actuel, puis le nouveau mot de passe deux fois. Le nouveau mot de passe doit comporter au moins 12 caractères et être différent de l'ancien. (Le mot de passe qu'un administrateur définit pour quelqu'un dans **Utilisateurs** n'exige que 8 caractères.)

Pour vous déconnecter, cliquez sur votre nom en haut à droite et choisissez **Se déconnecter**. Cela met fin à votre session. Pour utiliser de nouveau Discoverer Neo, reconnectez-vous.

![Le menu du compte ouvert, avec Paramètres et Se déconnecter.](shots/fr-FR/common/03-user-menu.png)

## La barre latérale

| Section | Pages |
|---|---|
| **Vue d'ensemble** | **Tableau de bord** |
| **Modélisation des données** | **Domaines d'activité**, **Dossiers**, **Éléments**, **Jointures**, **Hiérarchies**, **Fonctions personnalisées**, **Sources de données**, **Utilisateurs**, **Sécurité**, **Journal d'audit** |
| **Cartes** | **Cartes** |
| **Autres** | **Planifications**, **Exécutions**, **Exportations**, **Migration** |

**Paramètres** se trouve en bas de la barre latérale. Sur un écran étroit, la barre latérale se cache derrière le bouton de menu en haut à gauche (**Afficher/Masquer le menu**).

![La barre latérale complète de l'administrateur, avec Modélisation des données et Migration.](shots/fr-FR/admin/01-dashboard-sidebar.png)

---

# Paramètres

**Paramètres** contient vos propres choix. Ils suivent votre compte sur n'importe quel navigateur. Ouvrez-les depuis la barre latérale ou depuis le menu de votre nom.

![La page Paramètres avec les cartes Langue, Thème et Palette de couleurs.](shots/fr-FR/common/04-settings.png)

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Langue d'affichage** | Change immédiatement la langue des écrans dans ce navigateur. |
| **Apparence** | Change immédiatement le thème dans ce navigateur. |
| **Palette** | Change immédiatement les couleurs d'accentuation dans ce navigateur. |
| **Enregistrer** | Conserve vos choix sur votre compte, pour qu'ils s'appliquent sur tous vos appareils. |

**Langue d'affichage**

| Option | Signification / quand la choisir |
|---|---|
| English | Écrans en anglais. |
| Português (Portugal) | Écrans en portugais. C'est la valeur par défaut avant la connexion. |
| Français (France) | Écrans en français. |
| Español (España) | Écrans en espagnol. |

**Apparence**

| Option | Signification / quand la choisir |
|---|---|
| **Clair** | Fond clair. |
| **Sombre** | Fond sombre. Plus confortable dans une pièce peu éclairée. |
| **Contraste élevé** | Couleurs fixes et marquées pour une lecture plus facile. Les choix de **Palette** sont désactivés tant que cette option est sélectionnée. |

**Palette**

| Option | Signification / quand la choisir |
|---|---|
| **Classique**, **Bleu marine**, **Forêt**, **Vin**, **Océan**, **Ocre** | Six jeux de couleurs d'accentuation. Choisissez celui qui vous plaît. |

> **Attention :** un choix modifie l'écran immédiatement, mais il n'est conservé sur votre compte que si vous cliquez sur **Enregistrer**. Si vous partez sans enregistrer, la prochaine connexion rétablit les anciennes valeurs.

---

# Tableau de bord

Le **Tableau de bord** est la page que vous voyez après la connexion. Il donne un comptage rapide du travail dans le système. Vous ne pouvez rien y modifier.

![Le tableau de bord de l'administrateur avec les cartes de synthèse et la liste Cartes récentes.](shots/fr-FR/admin/01-dashboard-sidebar.png)

| Carte | Ce qu'elle montre |
|---|---|
| **Nombre total de cartes** | Toutes les cartes actives du système. En dessous : combien sont à vous et combien appartiennent à d'autres personnes (« N à vous, M partagées avec vous »). Pour vous, « partagées avec vous » désigne la carte de toute autre personne, cartes privées comprises. |
| **Nombre total d'exécutions** | Toutes les exécutions de toutes les cartes, par n'importe qui. |
| **Cartes planifiées** | Combien de cartes ont au moins une planification active que vous avez créée. |
| **Résultats planifiés** | Combien de résultats stockés vos planifications ont produits. |
| **Cartes récentes** | Les 5 dernières cartes que vous avez créées et modifiées. Cliquez sur l'une d'elles pour l'ouvrir dans le créateur. |

Le lien **Voir les planifications** sur deux cartes ouvre la page **Planifications**.

---

# Cartes

**Cartes** est la liste de toutes les cartes du système. Utilisez-la pour trouver une carte, l'exécuter, la modifier, la partager, la copier, la confier à quelqu'un d'autre ou la supprimer.

![La liste Cartes, onglet Tous, avec toutes les icônes de ligne et la section Classeurs au-dessus.](shots/fr-FR/admin/02-maps-all.png)

## La liste

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Créer une carte** | Ouvre le créateur de cartes avec une carte vide. |
| Onglets **Mes cartes**, **Partagées avec moi**, **Tous** | **Mes cartes** affiche les cartes que vous avez créées. **Partagées avec moi** affiche les cartes que d'autres personnes ont partagées avec vous. **Tous** affiche toutes les cartes du système. La page s'ouvre sur **Tous** si aucune carte ne vous appartient. |
| **Rechercher des cartes par nom…** | Filtre la liste par nom. |
| Filtre **Domaine Métier** | Affiche uniquement les cartes d'un domaine d'activité. |
| **Trier par** | **Récemment modifiés** ou **Nom (A–Z)**. |
| **Effacer** | Supprime la recherche et le filtre de domaine d'activité. Il ne s'affiche que lorsqu'un filtre est actif. |
| Nom de la carte | Ouvre la carte dans le créateur. |
| Icône en forme d'œil | Ouvre la carte dans la visionneuse, où vous l'exécutez et lisez les lignes. |
| Icône Crayon | Ouvre la carte dans le créateur pour modifier les colonnes, les conditions et la mise en page. |
| Icône Copier | Crée votre propre copie de la carte et l'ouvre pour modification. |
| Icône Partager | Ouvre la boîte de dialogue **Partager la carte**. |
| Icône Calendrier | Ouvre **Planifications** avec cette carte déjà choisie. |
| Icône Télécharger | Ouvre la visionneuse, où vous exportez vers Excel, CSV ou PDF. |
| Icône Corbeille | Supprime la carte après confirmation. |

Les colonnes sont **Nom**, **Classeur**, **Propriétaire**, **Domaine Métier**, **Type** et **Mis à jour le**.

Supprimer une carte la retire de toutes les listes. Seul un administrateur peut la récupérer. Ses exécutions et planifications restent liées à elle.

> **Attention :** en tant qu'administrateur, vous pouvez supprimer n'importe quelle carte. Vérifiez d'abord la colonne **Propriétaire**.

## Classeurs

La section **Classeurs** s'affiche en haut quand au moins une carte appartient à un classeur. Cliquez sur un classeur pour voir ses cartes. Utilisez **Rechercher des classeurs ou des feuilles...** pour en trouver un.

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| Icône Crayon sur une ligne de carte | Ouvre cette carte dans le créateur. |
| Icône Copier | Ouvre la boîte de dialogue **Copier**. Elle crée un nouveau classeur avec une copie privée de chaque carte. L'original ne change pas. Saisissez le **Nom du nouveau classeur** et cliquez sur **Copier**. |
| Icône Partager | Ouvre la boîte de dialogue de partage du classeur. Elle donne à une personne l'accès à toutes les cartes du classeur en une fois. |
| Icône Corbeille | Supprime le classeur et toutes ses cartes après confirmation. Seul un administrateur peut les récupérer. |

## Partager une carte

Le partage décide qui d'autre peut ouvrir une carte et ce qu'il peut en faire.

![La boîte de dialogue Partager la carte avec une zone de recherche et les boutons Peut consulter, Peut exporter et Peut modifier.](shots/fr-FR/manager/03-share-dialog.png)

1. Cliquez sur l'icône Partager de la ligne de la carte.
2. Saisissez dans **Rechercher par nom ou e-mail…** pour trouver la personne.
3. Cliquez sur un niveau à côté de la personne. Le niveau foncé est celui qu'elle a actuellement.
4. Pour retirer l'accès, cliquez sur le **✕** à côté de la personne.

| Option | Signification / quand la choisir |
|---|---|
| **Peut consulter** | La personne peut ouvrir et exécuter la carte. Elle ne peut ni l'exporter, ni la planifier, ni la modifier. |
| **Peut exporter** | La personne peut ouvrir et exécuter la carte, exporter le résultat et la mettre en planification. |
| **Peut modifier** | La personne peut faire tout ce qui précède et aussi modifier la carte. Elle ne peut pas la partager de nouveau. |

Si la carte est publique, la boîte de dialogue affiche **Cette carte est publique — toute personne disposant du lien peut la consulter.** et un bouton **Copier le lien**. Une carte publique peut être ouverte et exportée par tout utilisateur connecté. Vous rendez une carte publique dans le créateur (voir le chapitre **Créateur de cartes**).

Une personne a aussi besoin d'un accès au domaine d'activité pour les données de la carte. Sans lui, la personne peut ouvrir la carte mais l'exécution s'arrête avec **Exécution non autorisée**.

## Partager un classeur entier

Dans la boîte de dialogue de partage d'un classeur, les niveaux sont les mêmes : **Peut consulter**, **Peut exporter**, **Peut modifier**. Un clic partage toutes les cartes du classeur. La liste affiche « n feuilles sur m » pour chaque personne. Cliquez sur **✕** pour retirer l'accès.

## Copier une carte

Cliquez sur l'icône Copier. Vous obtenez une copie privée dont vous êtes propriétaire. Vous pouvez ensuite la modifier. L'original reste tel quel.

## Exemple : donner un accès en lecture à un collègue

Exemple : partager **GD_M.M10_V01.DIS** avec un collègue qui doit seulement la lire.

1. Dans **Cartes**, trouvez **GD_M.M10_V01.DIS**.
2. Cliquez sur l'icône Partager.
3. Recherchez le nom de votre collègue.
4. Cliquez sur **Peut consulter**.
5. Vérifiez que le collègue a un accès sur le domaine d'activité de la carte (voir **Domaines d'activité**). Sans lui, l'exécution est refusée.

---

# Créateur de cartes

Le créateur est l'endroit où vous créez et modifiez une carte. Ouvrez-le avec **Créer une carte**, ou avec l'icône Crayon ou le nom de la carte dans la liste. En tant qu'administrateur, vous pouvez modifier toutes les cartes.

![Le créateur de cartes avec l'arborescence Domaines d'activité, la zone Colonnes et le panneau Propriétés.](shots/fr-FR/user/05-builder-overview.png)

## L'écran

- **À gauche :** l'arborescence **Domaines d'activité**. Ouvrez un domaine d'activité, puis un dossier, puis faites glisser un élément.
- **Au milieu :** la zone **Colonnes**. Elle contient les colonnes de la carte. Les résultats apparaissent en dessous après une exécution.
- **À droite :** cinq onglets : **Propriétés**, **Conditions**, **Tri**, **Paramètres**, **Champs calculés**.

Vous pouvez faire glisser les barres entre les zones pour changer leur largeur. **Réduire le panneau** masque le côté droit.

## La barre d'outils

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Retour** | Revient à la page d'où vous venez. Le créateur ne vous avertit pas des modifications non enregistrées. |
| Zone du nom de la carte | Le nom de la carte. |
| Liste du type de carte | **Tableau**, **Tableau croisé**, **Page-Détail** ou **Graphique**. Seul **Tableau croisé** change l'aspect du résultat (voir ci-dessous). |
| **● Non enregistré** | Indique que la carte a des modifications non enregistrées. |
| **Exécuter** | Enregistre la carte si elle est nouvelle ou modifiée, puis l'exécute. |
| **Enregistrer** | Enregistre la carte. Il n'y a pas d'enregistrement automatique. Si rien n'a changé, le message **Aucune modification à enregistrer** s'affiche. |
| **Exporter** > **Définition de la carte (.xml)** | Télécharge la définition de la carte sous forme de fichier XML. Elle ne contient aucune ligne de données. Elle ne fonctionne qu'après l'enregistrement de la carte. |
| **Planifier** | Ouvre **Planifications** avec cette carte choisie. Fonctionne une fois la carte enregistrée. |
| **Mise en forme** | Ouvre la boîte de dialogue de mise en forme conditionnelle. Fonctionne une fois la carte enregistrée. |
| **Partager** | Ouvre la boîte de dialogue **Partager la carte**. Fonctionne une fois la carte enregistrée. |

| Option (type de carte) | Signification / quand la choisir |
|---|---|
| **Tableau** | Une grille simple de lignes. La valeur par défaut. |
| **Tableau croisé** | Une grille avec des valeurs en haut et sur le côté. Elle exige au moins une colonne réglée sur **En haut**. Sinon, le résultat s'affiche comme un tableau avec une note. |
| **Page-Détail** | Stocké avec la carte, mais le résultat s'affiche comme une grille simple. |
| **Graphique** | Stocké avec la carte, mais le résultat s'affiche comme une grille simple. |

## Créer une carte

1. Cliquez sur **Créer une carte**.
2. Dans l'arborescence **Domaines d'activité**, ouvrez un domaine d'activité et un dossier.
3. Faites glisser un élément sur la zone de travail, ou cliquez sur le **+** à côté. Répétez pour d'autres colonnes.
4. Cliquez sur **Enregistrer**.

La première colonne que vous ajoutez fixe le domaine d'activité de la carte. Toutes les autres colonnes doivent provenir du même domaine d'activité. Le système refuse une colonne d'un autre domaine avec **Domaine d'activité différent**. Une colonne ne peut figurer qu'une seule fois sur la zone de travail. Il n'y a pas de sélecteur de domaine d'activité.

Exemple : construisez une petite carte dans le domaine d'activité **DC**. Faites glisser une dimension (icône d'étiquette) et une mesure (icône sigma) sur la zone de travail. Réglez la mesure sur **SUM**. Cliquez sur **Exécuter**.

Utilisez **Filtrer les éléments…** au-dessus de l'arborescence pour trouver un élément. Faites glisser la poignée d'une colonne pour changer l'ordre. Cliquez sur **X** sur une colonne pour la retirer.

Pendant la construction, le système vérifie la forme de la carte. Si elle va être refusée, une bannière orange explique pourquoi avant que vous cliquiez sur **Exécuter** (voir **Refus**).

## Configurer une colonne

Cliquez sur une colonne de la zone de travail. La boîte de dialogue **Configurer la colonne** s'ouvre. Rien n'est conservé tant que vous ne cliquez pas sur **Enregistrer** sur la carte.

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Nom d'affichage** | Le titre de la colonne. Vide, il reprend le nom de l'élément. |
| **Agrégation** | La façon dont la colonne est totalisée. |
| **Sens du tri** | Trie le résultat selon cette colonne. |
| **Masque de format** | La façon dont les nombres et les dates sont imprimés. |
| **Préréglages** | Remplit le **Masque de format** à partir d'une liste. |
| **Ordre de tri** | La place de la colonne quand vous triez selon plusieurs colonnes. |
| **Largeur de colonne (px)** | La largeur de la colonne. Elle doit être supérieure à zéro. |
| **Placement** | Le rôle de la colonne dans la mise en page. |
| **Bord du tableau croisé** | L'endroit où une colonne va dans un tableau croisé. |
| **Grouper et rompre** | Masque les valeurs répétées et démarre un sous-total à chaque changement de la colonne. |
| **Requête seulement, ne pas afficher** | La requête demande la colonne, donc une condition, un tri ou un total peut l'utiliser, mais le résultat ne l'affiche pas. |

| Option (**Agrégation**) | Signification / quand la choisir |
|---|---|
| NONE | Pas de total. À utiliser pour les noms et les codes. |
| SUM | Additionne les valeurs. |
| COUNT | Compte les lignes. |
| AVG | Moyenne. |
| MIN | Plus petite valeur. |
| MAX | Plus grande valeur. |

| Option (**Sens du tri**) | Signification / quand la choisir |
|---|---|
| **Aucun** | Ne pas trier selon cette colonne. |
| **Croissant** | Le plus petit d'abord, de A à Z. |
| **Décroissant** | Le plus grand d'abord, de Z à A. |

| Option (**Préréglages**) | Signification / quand la choisir |
|---|---|
| **Nombre (1 234)** | Nombre entier avec séparateurs de milliers. |
| **Décimal (1 234,00)** | Deux décimales. |
| **Devise (1 234,00 €)** | Montant avec le signe monétaire. |
| **Pourcentage (12,3 %)** | Pourcentage. |
| **Date (DD-MON-YYYY)** | Date comme 31-DEC-2026. |
| **Date (YYYY-MM-DD)** | Date comme 2026-12-31. |

| Option (**Placement**) | Signification / quand la choisir |
|---|---|
| **Aucun** | Aucun rôle particulier. |
| **Grouper par (axe)** | La colonne regroupe les lignes. |
| **Mesure** | La colonne contient les nombres. |
| **Élément de page** | La colonne divise le résultat en pages. |

| Option (**Bord du tableau croisé**) | Signification / quand la choisir |
|---|---|
| **Aucun** | Non utilisé dans un tableau croisé. |
| **Sur le côté** | Les valeurs descendent sur le côté gauche. |
| **En haut** | Les valeurs s'étendent en haut. |

![La boîte de dialogue Configurer la colonne avec la liste Agrégation ouverte.](shots/fr-FR/user/08-builder-column-aggregation.png)

## L'onglet Propriétés

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Description** | Le titre imprimé au-dessus des résultats et en haut de chaque exportation. Le texte après `&` est une variable. |
| **Insérer une variable** | Insère une variable au niveau du curseur. |
| **Public (visible par tous dans le domaine d'activité)** | Rend la carte publique à l'enregistrement. En réalité, tout utilisateur connecté peut alors l'ouvrir et l'exporter. Les données exigent toujours un accès. |
| Compteurs | Totaux en lecture seule des colonnes, conditions, paramètres et champs calculés. |

| Option (**Insérer une variable**) | Signification / quand la choisir |
|---|---|
| Date d'exécution (`&Date`) | La date de l'exécution. |
| Heure d'exécution (`&Time`) | L'heure de l'exécution. |
| Nom du classeur (`&Workbook`) | Le classeur auquel appartient la carte. |
| Nom de la feuille (`&Worksheet`) | Le nom de la carte. |
| Paramètres saisis à l'exécution | Chaque paramètre de la carte sous la forme `&Name`. |

## L'onglet Conditions

Une condition ne garde que les lignes qui satisfont un test.

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Ajouter une condition** | Ajoute une ligne. Elle exige au moins une colonne sur la zone de travail. |
| Case à cocher de ligne | Sélectionne la ligne pour le regroupement. |
| **Grouper les n conditions sélectionnées** | Regroupe deux lignes sélectionnées ou plus en un bloc OR. |
| **Dégrouper** | Supprime le bloc. |
| **Opérateur logique** | Relie la ligne à la ligne précédente : **AND** ou **OR**. |
| **Élément de condition** | La colonne à tester. |
| **Opérateur** | La comparaison. |
| **Valeur statique** | Une valeur fixe dans la zone. |
| **Demander à l'exécution** | La valeur est demandée quand la carte s'exécute. Vous nommez un paramètre. |
| Zone de valeur | La valeur. Utilisez `valeur1, valeur2, …` pour IN et `bas, haut` pour BETWEEN. |
| **Nom du paramètre** | Le paramètre qui fournit la valeur. Il doit exister. |
| Corbeille | Supprime la condition. |

| Option (**Opérateur**) | Signification / quand la choisir |
|---|---|
| `=` | Égal à. |
| `<>` | Différent de. |
| `<`, `>`, `<=`, `>=` | Inférieur à, supérieur à, et avec égalité. |
| LIKE | Correspond à un motif avec `%` et `_`. |
| IN | Correspond à un élément d'une liste. |
| BETWEEN | Entre une valeur basse et une valeur haute. |
| IS NULL | La valeur est vide. Pas de zone de valeur. |

## L'onglet Tri

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Choisir une colonne** | Choisit la colonne à ajouter. |
| **Ajouter un tri** | Ajoute le niveau de tri. |
| Poignée | Faites glisser pour changer la priorité. |
| Liste du sens | **Croissant** ou **Décroissant**. |
| X | Supprime le niveau. |

## L'onglet Paramètres

Un paramètre est une question posée quand la carte s'exécute.

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Ajouter un paramètre** | Ajoute un paramètre nommé Parameter1, Parameter2, etc. |
| Zone du nom | Le nom. Il doit être unique. |
| Liste du type | Le genre de valeur. |
| Valeur par défaut | Utilisée quand personne ne saisit de valeur. Si chaque paramètre a une valeur par défaut, la carte s'exécute sans rien demander. |
| **Obligatoire** | L'exécution refuse une valeur vide. |
| Corbeille | Supprime le paramètre. |
| **Aperçu de l'invite d'exécution** | Affiche l'invite telle que les gens la verront. |

| Option (**Type**) | Signification / quand la choisir |
|---|---|
| STRING | Du texte. |
| NUMBER | Un nombre. |
| DATE | Une date. |
| LIST | Plusieurs valeurs, séparées par des virgules. |

## L'onglet Champs calculés

Un champ calculé est une nouvelle colonne créée à partir d'une formule.

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Ajouter un champ calculé** | Ajoute Calc1, Calc2, etc. |
| Poignée | Réordonne les champs. |
| Zone du nom | Le nom. Les autres formules l'appellent sous la forme `[Name]`. |
| Ordre d'affichage | La place de la colonne. |
| Bouton de formule | Ouvre l'**Éditeur de formules**. |
| Corbeille | Supprime le champ. |

Dans l'**Éditeur de formules**, saisissez la formule ou cliquez sur une fonction pour l'insérer. Cliquez sur le nom d'une colonne pour insérer `[Colonne]`. L'éditeur signale les formules vides, les guillemets ou crochets non équilibrés, et les fonctions ou colonnes inconnues. **Tester la formule** exécute la formule sur les 5 premières lignes de données réelles. Elle fonctionne une fois la carte enregistrée.

| Groupe de fonctions | Ce qu'il contient |
|---|---|
| Arithmétique | ROUND, TRUNC, FLOOR, CEIL, ABS, MOD, POWER, SQRT, SIGN, GREATEST, LEAST |
| Chaînes | UPPER, LOWER, INITCAP, LENGTH, SUBSTR, TRIM, LTRIM, RTRIM, INSTR, REPLACE, CONCAT, LPAD, RPAD |
| Dates | TO_CHAR, TO_DATE, ADD_MONTHS, MONTHS_BETWEEN, LAST_DAY |
| Conditionnel / gestion des valeurs nulles | NVL, NVL2, COALESCE, DECODE, TO_NUMBER, CASE |

## Mise en forme conditionnelle

**Mise en forme** colore une cellule ou une ligne entière quand une valeur satisfait un test. Les règles sont stockées immédiatement. Elles n'attendent pas **Enregistrer**.

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Ajouter une règle** | Ouvre le formulaire de règle. |
| **Colonne** | La colonne à tester. |
| **Appliquer à** | **Cellule** colore une cellule. **Ligne** colore toute la ligne. |
| **Opérateur** | Le test. |
| **Valeur** | La valeur à laquelle comparer. |
| **Couleur de fond**, **Couleur du texte** | Les couleurs. **Effacer** en supprime une. |
| **Gras**, **Italique**, **Souligné** | Style du texte. |
| **Enregistrer** | Conserve la règle. |
| X sur une règle | Supprime la règle. |

| Option (**Opérateur**) | Signification / quand la choisir |
|---|---|
| **Égal à**, **Différent de** | Même valeur ou valeur différente. |
| **Supérieur à**, **Inférieur à** | Au-dessus ou en dessous. |
| **Supérieur ou égal à**, **Inférieur ou égal à** | Au-dessus ou en dessous, avec égalité. |
| **Contient (jokers % et _)** | Correspondance de motif. |
| **Dans la liste** | L'une des valeurs de `valeur1,valeur2,…`. |
| **Entre** | De `bas,haut`. |
| **Est vide** | Aucune valeur. |

## Exécuter une carte et lire le résultat

Cliquez sur **Exécuter**. Si un paramètre n'a pas de valeur par défaut, la boîte de dialogue **Paramètres d'exécution** s'ouvre d'abord. Remplissez les valeurs et cliquez sur **Exécuter**. Les champs obligatoires vides affichent **Ce paramètre est obligatoire.**

Le panneau de résultats affiche le nombre de lignes et la durée. **Lignes supplémentaires disponibles** signifie que le résultat a été tronqué. Cliquez sur **Charger plus** pour récupérer les 500 lignes suivantes.

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **SQL** | Affiche ou masque le texte SQL envoyé à la base de données. Seuls vous et les autres administrateurs le voient. |
| **Plan** | Affiche le plan d'exécution de la base de données. Administrateurs uniquement. |
| **Excel**, **CSV** | Exporte le résultat. |
| **PDF** | Ouvre **Exporter en PDF**. |
| Titre de colonne | Cliquez pour trier les lignes chargées. |
| Zone **Filtrer…** | Filtre les lignes chargées. |
| Double-clic sur une ligne | Ouvre **Explorer le détail** : les lignes brutes derrière cette ligne. |

**Exporter en PDF**

| Option | Signification / quand la choisir |
|---|---|
| **Format du papier** : **A4**, **A3**, **Lettre** | La taille de la page. A4 est la valeur par défaut. Utilisez A3 pour les résultats larges. |
| **Orientation** : **Portrait**, **Paysage** | Page haute ou large. Utilisez **Paysage** pour de nombreuses colonnes. |
| Liste **Colonnes**, **Tout sélectionner** / **Effacer** | Les colonnes à imprimer. Toutes sont cochées au départ. **Exporter** en exige au moins une. |

![Les résultats d'exécution avec les boutons SQL et Plan à côté des boutons Excel, CSV et PDF.](shots/fr-FR/admin/03-viewer-results.png)

Les résultats d'exécution sont conservés 24 heures. Exécuter de nouveau la même carte avec les mêmes valeurs affiche le résultat stocké (« Affichage d'un résultat en cache »). Cliquez sur **Exécuter à nouveau** dans la visionneuse pour une nouvelle exécution.

## Refus et erreurs

Le système refuse certaines cartes qui donneraient des totaux erronés. Il indique pourquoi et ce qu'il faut changer.

| Message | Que faire |
|---|---|
| Ces dossiers ne sont pas reliés | Retirez les colonnes du dossier non relié, ou définissez une jointure (voir **Jointures**). |
| Une jointure n'a pas de condition | Définissez les colonnes sur lesquelles la jointure correspond. |
| Une jointure est réglée dans les deux sens à la fois | Désactivez l'un des réglages de jointure externe. |
| Ces totaux sont mesurés par rapport à des éléments différents | Totalisez à partir d'un seul ensemble de lignes de détail. |
| Ces dossiers sont joints en cercle | Utilisez l'un des deux dossiers de détail. |
| Valeurs individuelles issues de deux ensembles de lignes de détail | Totalisez plutôt, ou listez à partir d'un seul ensemble. |
| Se déploie à partir de plusieurs dossiers | Scindez en deux cartes. |
| Ce type de total ne peut pas être calculé à travers une jointure | Utilisez SUM, COUNT, MIN ou MAX. |

Une bannière rouge **Exécution non autorisée** signifie qu'un accès à un domaine d'activité manque, ou (en mode fermé) qu'une stratégie de sécurité au niveau des lignes manque. Vous contournez les accès, mais pas la sécurité au niveau des lignes.

---

# La visionneuse de cartes

La visionneuse exécute une carte et affiche les lignes. Elle ne modifie jamais la carte. Ouvrez-la avec l'icône en forme d'œil, ou avec le nom d'une carte dans **Exécutions**.

![La visionneuse de cartes après une exécution terminée, avec la grille de résultats et les boutons d'exportation.](shots/fr-FR/user/25-viewer-results.png)

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Exécuter** | Exécute la carte. Elle demande les paramètres si l'un d'eux n'a pas de valeur par défaut. |
| **Exécuter à nouveau** | L'exécute de nouveau avec les mêmes valeurs et ignore le résultat stocké. N'apparaît qu'après une exécution terminée. |
| **Annuler** | Annule une exécution qui attend encore dans la file d'attente. N'apparaît que tant que l'exécution est en attente. |
| **Gestion des planifications** | Ouvre **Planifications**. |
| **Excel**, **CSV**, **PDF** | Exporte le résultat. |
| **SQL**, **Plan** | Administrateurs uniquement. |

La ligne sous **Exécuter** vous indique l'état : en attente, en cours, ou « Résultat de … valide jusqu'à … ». Une carte migrée peut afficher un avertissement indiquant que certains filtres de Discoverer n'ont pas pu être migrés. Le résultat peut alors contenir plus de lignes que l'original.

---

# Exécutions

**Exécutions** liste chaque exécution que vous avez demandée, en attente, en cours ou terminée. Utilisez-la pour ouvrir un résultat stocké, exécuter de nouveau, exporter ou effacer d'anciennes exécutions. Les résultats sont conservés 24 heures (exécutions en direct) ou pendant la durée de conservation de la planification (exécutions planifiées). La page se met à jour toute seule.

![La page Exécutions avec les exécutions de tous les utilisateurs affichées.](shots/fr-FR/admin/04-runs-every-user.png)

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| Filtre **Carte** | Affiche une seule carte. |
| Filtre **Statut** | Affiche un seul statut. |
| Filtre **Type** | Affiche les exécutions **En direct** ou **Programmée**. |
| **Afficher les exécutions de tous les utilisateurs** | Liste les exécutions de tous les utilisateurs, pas seulement les vôtres. Il n'y a pas de colonne propriétaire, donc les lignes des autres utilisateurs ne portent aucun nom. |
| Nom de la carte | Ouvre la carte dans la visionneuse. |
| Icône **Ouvrir** | Ouvre le résultat stocké. |
| Icône **Exécuter à nouveau** | Lance une nouvelle exécution de la même carte avec les mêmes valeurs. C'est votre exécution, même si vous l'avez copiée depuis la ligne d'un autre utilisateur. |
| Boutons **XLSX**, **CSV**, **PDF** | Exportent une exécution terminée qui n'a pas expiré. |
| Icône **Annuler** | Annule une exécution qui attend. |
| Icône **Supprimer** | Supprime une exécution terminée et ses lignes stockées. Irréversible. |

| Option (**Statut**) | Signification / quand la choisir |
|---|---|
| **En attente** | Attend son tour. Chaque personne exécute une carte à la fois. |
| **En cours** | En cours de traitement. |
| **Terminée** | Terminée. Le résultat peut être ouvert et exporté. |
| **Échec** | Arrêtée par une erreur. |
| **Annulée** | Arrêtée par une personne. |

La colonne **Expire dans** affiche le temps restant en minutes, heures ou jours, ou **Expiré**.

---

# Exportations

**Exportations** liste les fichiers que vous avez exportés. Elle n'affiche que vos propres exportations. Même un administrateur ne peut ni voir ni télécharger l'exportation d'une autre personne.

![La page Exportations listant les exportations avec leur état et les boutons de téléchargement.](shots/fr-FR/admin/05-exports.png)

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| Icône Télécharger | Enregistre le fichier. Elle s'affiche sur les exportations **Terminée**. |
| Badge d'état | **En file d'attente**, **En cours**, **Terminée** ou **Échouée**. Pointez une exportation échouée pour lire la raison. |

Les colonnes sont **Carte**, **Format**, **État**, **Lignes** et **Créée**.

| Option (**Format**) | Signification / quand la choisir |
|---|---|
| XLSX | Feuille de calcul Excel. |
| CSV | Texte brut avec des virgules. Utilisez-le pour charger les données dans un autre programme. |
| PDF | Un document paginé, créé avec le format de papier et les colonnes que vous avez choisis. |

Vous créez une exportation à partir d'une exécution terminée : depuis la visionneuse, le créateur, **Exécutions** ou l'historique d'une planification. Les fichiers sont supprimés au bout de 7 jours. Ensuite, la ligne reste mais le téléchargement échoue.

---

# Planifications

Une **planification** exécute une carte automatiquement à des heures définies et stocke le résultat. Utilisez-la pour les rapports dont vous avez besoin chaque jour, semaine ou mois. Elle n'affiche que les planifications que vous avez créées. Elle n'envoie pas d'e-mails. Le résultat reste sur le serveur.

![La page Planifications avec une planification en pause et ses icônes d'action.](shots/fr-FR/user/38-schedules-list.png)

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Nouvelle planification** | Ouvre le formulaire de planification. |
| Icône Lecture (**Exécuter maintenant**) | Exécute la planification immédiatement. Désactivée quand la planification est en pause. |
| Icône **Suspendre** / **Activer** | Arrête ou relance le calendrier. |
| Icône **Historique** | Ouvre **Historique d'exécution**. |
| Icône **Modifier** | Modifie la planification. Vous ne pouvez pas changer sa carte. |
| Icône **Supprimer** | Supprime la planification et son historique après confirmation. |

Les colonnes sont **Nom**, **Carte**, **Planification**, **Prochaine exécution**, **Format**, **Statut** (**Actif** ou **En pause**) et **Planificateur**. **Planificateur** affiche la note laissée par la migration pour une planification issue de Discoverer. **Non vérifié** est normal pour les nouvelles planifications. Les planifications migrées depuis Discoverer arrivent en pause.

Une planification s'exécute sous l'identité de son créateur. Les accès aux domaines d'activité et les stratégies au niveau des lignes du créateur s'appliquent.

## Nouvelle planification et Modifier la planification

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Carte** | La carte à exécuter. La liste contient vos propres cartes et les cartes partagées avec vous, marquées « (partagée) ». Pour planifier la carte d'un autre utilisateur, utilisez l'icône Calendrier dans **Cartes**. |
| **Nom** | Le nom de la planification. |
| **Fréquence** | La fréquence d'exécution. |
| **Fuseau horaire** | L'horloge que suit le calendrier. |
| **Heure** | L'heure et la minute de l'exécution. Affiché pour toutes les fréquences sauf **Personnalisé (cron)**. |
| **Jour de la semaine** | Affiché pour **Hebdomadaire**. |
| **Jour du mois** | De 1 à 28, ou **Dernier jour**. Les jours 29 à 31 ne sont pas proposés, ainsi aucun mois court n'est sauté. Affiché pour **Mensuel**, les fréquences plus longues et **Annuel**. |
| **Mois** | Affiché pour **Annuel**. |
| **Expression cron** | Le calendrier en cinq champs. Affiché uniquement pour **Personnalisé (cron)**. |
| **Valide à partir de (facultatif)** | Le calendrier démarre à cette date et heure. |
| **Valide jusqu'au (facultatif)** | Le calendrier s'arrête après cette date et heure. |
| **Format de sortie** | Le type de fichier du résultat stocké. |
| **Préréglages de paramètres** | La valeur de chaque paramètre de la carte : fixe, ou relative à la date d'exécution (voir ci-dessous). Affiché uniquement si la carte a des paramètres. |
| **Activé** | Indique si le calendrier est actif. |

| Option (**Fréquence**) | Signification / quand la choisir |
|---|---|
| **Quotidien** | Tous les jours, à l'**Heure** que vous choisissez. |
| **Hebdomadaire** | Une fois par semaine, le **Jour de la semaine** que vous choisissez. |
| **Bimensuel (le 1er et le 16)** | Le 1er et le 16 de chaque mois. |
| **Mensuel** | Une fois par mois, le **Jour du mois** que vous choisissez. |
| **Tous les 2 mois** | En janvier, mars, mai, juillet, septembre et novembre. |
| **Trimestriel** | En janvier, avril, juillet et octobre. |
| **Quadrimestriel** | En janvier, mai et septembre. |
| **Semestriel** | En janvier et juillet. |
| **Annuel** | Une fois par an, le **Mois** et le **Jour du mois** que vous choisissez. |
| **Personnalisé (cron)** | Vous écrivez une **Expression cron** : cinq champs, minute, heure, jour du mois, mois, jour de la semaine. Exemple : `0 9 * * 1-5` correspond à 09:00 les jours ouvrés. |

| Option (**Format de sortie**) | Signification / quand la choisir |
|---|---|
| **Excel (.xlsx)** | Une feuille de calcul. |
| **CSV** | Texte brut avec des virgules. La valeur par défaut. |

**Fuseau horaire** propose d'abord le fuseau horaire de votre ordinateur, puis UTC, Europe/Lisbon, Atlantic/Madeira, Atlantic/Azores, Europe/Madrid et d'autres fuseaux courants. Le fuseau horaire de votre ordinateur est la valeur par défaut.

Les résultats sont conservés 30 jours.

![La boîte de dialogue Nouvelle planification avec une fréquence personnalisée et le champ Expression cron.](shots/fr-FR/user/34-schedule-custom-cron.png)

## Paramètres qui suivent la date d'exécution

Chaque paramètre de **Préréglages de paramètres** propose un choix : **Valeur fixe** ou **Relatif à la date d’exécution**. Une valeur fixe est la même à chaque exécution. Une valeur relative change avec la date d'exécution de la planification, ainsi un rapport mensuel couvre toujours le bon mois.

Une valeur relative comporte trois parties :

1. **Décaler la date d’exécution de** un nombre. Utilisez -1 pour la période précédente, 0 pour la période en cours.
2. La période : **jours**, **semaines**, **quinzaines**, **mois**, **trimestres**, **semestres** ou **années**.
3. **puis utiliser le** : **cette date**, le premier ou le dernier jour de la semaine, de la quinzaine, du mois, du trimestre, du semestre ou de l'année, **l’année (nombre)** ou **le mois (nombre 1-12)**.

![Préréglages de paramètres avec une valeur fixe et une valeur relative à la date d'exécution.](shots/fr-FR/user/35-schedule-relative-date.png)

| Vous voulez | Date de début | Date de fin |
|---|---|---|
| Le mois dernier | -1 **mois**, **premier jour de ce mois** | -1 **mois**, **dernier jour de ce mois** |
| L'année en cours, jusqu'au mois dernier | -1 **mois**, **premier jour de cette année** | -1 **mois**, **dernier jour de ce mois** |
| Un début fixe, une fin mobile | **Valeur fixe**, par exemple 2026-01-01 | -1 **mois**, **dernier jour de ce mois** |
| Le trimestre dernier | -1 **trimestres**, **premier jour de ce trimestre** | -1 **trimestres**, **dernier jour de ce trimestre** |
| Hier | -1 **jours**, **cette date** | -1 **jours**, **cette date** |

Pour un paramètre qui demande une année ou un mois sous forme de nombre, utilisez **l’année (nombre)** ou **le mois (nombre 1-12)**. Une semaine commence le lundi. Une quinzaine va du 1er au 15, ou du 16 à la fin du mois.

> **Astuce :** -1 **mois**, **premier jour de cette année** donne toujours toute l'année précédente quand la planification s'exécute en janvier. Une **Valeur fixe** ne bouge pas : une date fixe 2026-01-01 commence toujours en 2026 quand la planification s'exécute en 2027.

La colonne **Prochaine exécution** affiche la date de la prochaine exécution et, en dessous, les valeurs que cette exécution utilisera. Vérifiez-la après l'enregistrement.

Vous pouvez donner plusieurs planifications à une même carte, chacune avec sa propre fréquence et ses propres valeurs. Exemple : une planification mensuelle pour le mois dernier, et une planification annuelle pour l'année dernière.

## Historique d'exécution

**Historique** affiche les 50 dernières exécutions de la planification : **Exécuté**, **Statut** (SUCCESS, FAILED ou TIMEOUT), **Lignes** et **Durée**. Pointez une ligne échouée pour lire l'erreur.

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **XLSX**, **CSV**, **PDF** | Exporte le résultat stocké d'une exécution réussie. |
| Icône **Ouvrir** | Ouvre le résultat stocké dans la visionneuse. |
| Icône **Télécharger** | Enregistre directement un ancien fichier de résultat. |
| « Expire … » | Le temps restant avant la suppression du résultat. |

## Exemple : un résultat hebdomadaire

Exemple : exécuter **GD_M.M10_V01.DIS** tous les lundis à 07:00.

1. Dans **Cartes**, cliquez sur l'icône Calendrier de la carte.
2. Dans **Nouvelle planification**, saisissez un **Nom**.
3. Réglez **Fréquence** sur **Hebdomadaire**, **Jour de la semaine** sur lundi et **Heure** sur 07:00.
4. Choisissez votre **Fuseau horaire**.
5. Laissez **Activé** coché, puis cliquez sur **Enregistrer**.
6. Plus tard, cliquez sur l'icône **Historique** pour ouvrir ou exporter le résultat.

---

# Domaines d'activité

Un **domaine d'activité** est un groupe de dossiers liés, par exemple « Ventes ». C'est l'unité qui sert à donner aux gens l'accès aux données.

![La page Domaines d'activité listant les domaines, avec le bouton Nouveau domaine d'activité et les icônes de ligne.](shots/fr-FR/admin/06-business-areas.png)

Les colonnes sont **Nom**, **Description**, **Statut** (**Actif** ou **Inactif**) et **Créé le**.

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Nouveau domaine d'activité** | Ouvre le formulaire de création. |
| Icône **Gérer les accès** | Ouvre la boîte de dialogue **Octrois d'accès**. |
| Icône **Modifier** | Modifie le nom et la description. |
| Icône **Supprimer** | Désactive le domaine d'activité après confirmation. |

Supprimer ne fait que désactiver. Un administrateur peut rétablir le domaine.

![La boîte de dialogue Nouveau domaine d'activité avec les champs Nom et Description.](shots/fr-FR/admin/07-business-areas-new.png)

## Créer un domaine d'activité

1. Cliquez sur **Nouveau domaine d'activité**.
2. Saisissez un **Nom** (obligatoire, 255 caractères maximum). Saisissez une **Description** si vous le souhaitez.
3. Cliquez sur **Enregistrer**. La notification **Domaine d'activité créé** apparaît.

## Accès

Un **accès** donne à une personne un niveau d'accès aux données d'un domaine d'activité. Seul un administrateur peut ajouter ou retirer des accès. Les accès s'appliquent à une personne, pas à un rôle. Un accès ne fait jamais apparaître une carte.

![La boîte de dialogue Gérer les accès avec la liste Autorisation ouverte.](shots/fr-FR/admin/09-business-areas-grants-permission.png)

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Filtrer les utilisateurs par nom ou e-mail** | Filtre la liste des personnes. |
| Cases à cocher des utilisateurs | Cochez une ou plusieurs personnes. |
| **Autorisation** | Le niveau à donner à chaque personne cochée. Le texte en dessous explique le niveau. |
| **Ajouter** | Donne le niveau à chaque personne cochée. Désactivé tant que vous n'avez coché personne. |
| Badge de niveau sur un accès | Indique le niveau qu'une personne détient. |
| **Révoquer** (X) | Retire l'accès de cette personne. |
| **Fermer** | Ferme la boîte de dialogue. |

Les six niveaux forment une échelle. Chaque niveau inclut les précédents. Si une personne détient plusieurs accès sur un domaine, le plus élevé l'emporte.

| Option (**Autorisation**) | Signification / quand la choisir |
|---|---|
| VIEW | Lire les données des dossiers du domaine. Exécuter les cartes partagées avec la personne. Voir les dossiers, éléments, jointures et hiérarchies du domaine. À choisir pour les personnes qui ne font qu'exécuter des rapports. |
| EXPORT | Identique à VIEW. Les droits d'exportation d'une carte dépendent de la façon dont elle est partagée. |
| SCHEDULE | Identique à VIEW. Les droits de planification d'une carte dépendent de la façon dont elle est partagée. |
| CREATE | Tout ce qui est dans VIEW, plus la création de nouvelles cartes, de nouveaux dossiers, éléments, jointures et hiérarchies dans le domaine. À choisir pour les personnes qui créent des cartes. |
| EDIT | Tout ce qui est dans CREATE, plus la modification du domaine et de ses dossiers, éléments, jointures et hiérarchies. |
| DELETE | Tout ce qui est dans EDIT, plus la suppression des dossiers, éléments, jointures et hiérarchies du domaine. |

> **Remarque :** EXPORT et SCHEDULE n'ajoutent rien par eux-mêmes. La possibilité d'exporter ou de planifier une carte dépend de la façon dont la carte est partagée. Une personne a besoin d'au moins CREATE pour enregistrer une nouvelle carte.

> **Remarque :** Un Manager ne modifie jamais les dossiers, éléments, jointures, hiérarchies ni le domaine, quel que soit son accès. Pour un Manager, CREATE, EDIT et DELETE lui permettent seulement de créer des cartes.

Exemple : donner à un collègue le droit de créer des cartes dans le domaine d'activité **DC**.

1. Cliquez sur l'icône **Gérer les accès** du domaine.
2. Cochez votre collègue.
3. Réglez **Autorisation** sur CREATE.
4. Cliquez sur **Ajouter**. La notification **Accès accordé à 1 utilisateur** apparaît.

Pour donner le même niveau à plusieurs personnes, cochez-les toutes avant de cliquer sur **Ajouter**. Si certains échouent, les notifications les signalent séparément.

---

# Dossiers

Un **dossier** est une table, une vue ou une requête d'un domaine d'activité. Ses colonnes deviennent des **éléments**. Choisissez d'abord un domaine d'activité. **Tout actualiser** et **Nouveau dossier** restent désactivés tant que vous ne l'avez pas fait.

![La page Dossiers avec un domaine d'activité choisi, affichant le tableau des dossiers et les icônes de ligne.](shots/fr-FR/admin/11-folders.png)

Les colonnes sont **Nom** (avec un badge **Partagé** pour un dossier qui appartient à un autre domaine), **Type**, **Nom de la table** et **Source de données**.

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Domaine d'activité** | Choisit le domaine dont vous voyez les dossiers. |
| **Tout actualiser** | Relit chaque table et chaque vue du domaine depuis sa source de données. Les nouvelles colonnes deviennent des éléments. Les types modifiés sont mis à jour. Les colonnes disparues sont seulement listées. |
| **Nouveau dossier** | Ouvre l'assistant de dossier. |
| Icône **Actualiser depuis la source de données** | La même actualisation pour un seul dossier. Elle s'affiche pour les dossiers de type table et vue qui ont une source de données et ne sont pas partagés depuis un autre domaine. |
| Icône **Gérer les domaines d'activité** | Ouvre la boîte de dialogue de partage. |
| Icône **Modifier** | Ouvre l'assistant sur ce dossier. |
| Icône **Supprimer** | Désactive le dossier après confirmation. |
| Panneau **Résultat de l’actualisation**, **Fermer** | Liste ce que chaque actualisation a trouvé. |

L'actualisation ne supprime jamais un élément. Une colonne disparue de la source est listée comme « Colonne disparue de la source (élément conservé — supprimez-le si aucune carte ne l’utilise) ».

Les dossiers partagés depuis un autre domaine sont ignorés par **Tout actualiser**. Actualisez-les depuis le domaine qui les possède.

## L'assistant de dossier

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Nom** | Le nom du dossier. Rempli à partir de la table s'il est vide. |
| **Description** | Texte. Rempli à partir du commentaire de la table Oracle s'il est vide. |
| **Type de dossier** | Le genre de dossier. |
| **SQL personnalisé** | Le SQL qui définit le dossier. S'affiche pour **DERIVED** et **COMPLEX**. |
| **Source de données** | La connexion à la base de données. S'affiche pour tous les types sauf **DERIVED** et **COMPLEX**. |
| **Découvrir les tables** | Lit les tables de la source de données pour que vous puissiez en choisir une. |
| Zone de filtre | Filtre la liste découverte par nom ou commentaire. |
| Liste découverte | Cliquez sur une table pour remplir **Nom de la table**, **Propriétaire de la table**, **Nom** et **Description**. |
| **Nom de la table**, **Propriétaire de la table** | La table à utiliser. Vous pouvez les saisir. Le système vérifie que la table existe et peut être lue. |
| **Éléments à créer (n)** | Les colonnes de la table. Chaque colonne cochée devient un élément. Vous pouvez modifier chaque description. **Tout sélectionner** / **Effacer** coche ou décoche tout. |
| **Enregistrer** | Crée le dossier, puis crée les éléments. |

| Option (**Type de dossier**) | Signification / quand la choisir |
|---|---|
| TABLE | Une table de base de données. Le choix habituel. |
| VIEW | Une vue de base de données. |
| DERIVED | Un dossier défini par votre propre texte dans **SQL personnalisé**. |
| COMPLEX | Un dossier défini par votre propre SQL. Le SQL ne doit pas être vide et doit passer la vérification. Les stratégies de sécurité au niveau des lignes ne fonctionnent pas avec lui : un dossier COMPLEX couvert par une stratégie est refusé. |
| JOIN | Un dossier qui représente une jointure. |
| SUMMARY | Un dossier de synthèse. |

![La boîte de dialogue Nouveau dossier avec une table choisie et la liste Éléments à créer.](shots/fr-FR/admin/15-folders-picked.png)

Exemple : créer un dossier pour une table.

1. Choisissez le domaine d'activité, puis cliquez sur **Nouveau dossier**.
2. Laissez **Type de dossier** sur TABLE. Choisissez la **Source de données**.
3. Cliquez sur **Découvrir les tables**. Saisissez une partie du nom dans la zone de filtre.
4. Cliquez sur la table. Les colonnes apparaissent sous **Éléments à créer**.
5. Décochez les colonnes dont vous n'avez pas besoin. Cliquez sur **Enregistrer**.

## Partager un dossier avec un autre domaine d'activité

Un dossier appartient à un domaine d'activité. Il peut aussi apparaître dans d'autres, comme dans Oracle Discoverer. Un accès sur l'un de ses domaines donne accès au dossier.

1. Cliquez sur l'icône **Gérer les domaines d'activité**.
2. Sous **Partager avec**, choisissez un domaine.
3. Cliquez sur **Partager**.
4. Pour arrêter le partage, cliquez sur le X du badge. Vous ne pouvez pas retirer le domaine propriétaire.

![La boîte de dialogue de partage du dossier avec le badge du propriétaire et la liste Partager avec.](shots/fr-FR/admin/16-folders-sharing.png)

---

# Éléments

Un **élément** est une colonne d'un dossier. Les cartes sont construites à partir d'éléments. Choisissez un **Domaine d'activité** puis un **Dossier**. La liste des dossiers inclut les dossiers partagés depuis un autre domaine.

![La page Éléments pour un dossier choisi, avec les colonnes Type, Colonne, Type de données et Agrégation.](shots/fr-FR/admin/17-items.png)

Les colonnes sont **Nom**, **Type**, **Colonne**, **Type de données** et **Agrégation**.

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Domaine d'activité**, **Dossier** | Choisissent les éléments que vous voyez. |
| **Nouvel élément** | Ouvre le formulaire de création. Désactivé tant qu'un dossier n'est pas choisi. |
| Icône **Modifier** | Modifie l'élément. Vous ne pouvez pas le déplacer vers un autre dossier. |
| Icône **Supprimer** | Désactive l'élément après confirmation. |

Les éléments sont normalement créés par l'assistant de dossier. Cette page n'a pas de bouton d'importation.

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Nom** | Le nom de l'élément. Obligatoire. |
| **Description** | Texte facultatif. |
| **Type d'élément** | Le genre d'élément. |
| **Nom de la colonne** | La colonne physique. S'affiche uniquement pour **Élément de base de données (CO)**. |
| **Formule** | Le calcul. S'affiche pour tous les types sauf CO. Une formule invalide est refusée. |
| **Type de données** | Par exemple NUMBER. |
| **Masque de format** | Par exemple `999,999.00`. |
| **Agrégation** | Le total par défaut de l'élément. |

| Option (**Type d'élément**) | Signification / quand la choisir |
|---|---|
| **Élément de base de données (CO)** | Une colonne de la table. Le choix habituel. |
| **Élément créé (CI)** | Un élément que vous avez créé, à l'aide d'une formule. |
| **Élément calculé (CU)** | Un élément calculé, à l'aide d'une formule. |
| **Élément de jointure (JI)** | Un élément qui provient d'une jointure. |
| **Élément de hiérarchie (HI)** | Un élément qui est un niveau d'une hiérarchie. |
| **Agrégation (AG)** | Un élément qui totalise d'autres éléments. |
| **Fonction (FU)** | Un élément qui appelle une fonction personnalisée. |

| Option (**Agrégation**) | Signification / quand la choisir |
|---|---|
| NONE | Pas de total par défaut. Ne stocke rien. |
| SUM, COUNT, AVG, MIN, MAX | Le total par défaut de cet élément quand il est utilisé dans une carte. Choisissez SUM pour les montants. |

![La boîte de dialogue Nouvel élément avec la liste Type d'élément ouverte affichant les types d'éléments.](shots/fr-FR/admin/19-items-type-open.png)

---

# Jointures

Une **jointure** indique au système comment deux dossiers sont reliés, afin qu'une carte puisse utiliser les colonnes des deux. Choisissez d'abord un domaine d'activité.

![La page Jointures, avec des jointures composées de plusieurs paires de colonnes.](shots/fr-FR/admin/20-joins.png)

Les colonnes sont **Nom**, **Dossier de gauche**, **Dossier de droite**, **Colonnes** (paires affichées sous la forme `gauche op droite`, reliées par AND) et **Type**.

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Domaine d'activité** | Choisit le domaine. |
| **Nouvelle jointure** | Ouvre le formulaire de jointure. |
| Icône **Modifier** | Modifie la jointure. |
| Icône **Supprimer** | Désactive la jointure après confirmation. |

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Nom** | Le nom de la jointure. Obligatoire. Rempli par une suggestion s'il est vide. |
| **Dossier de gauche**, **Dossier de droite** | Les deux dossiers. Tous deux doivent appartenir au domaine. |
| **Suggérer des jointures** | Recherche des noms de colonnes correspondants entre les dossiers et les liste. Elle part du dossier de gauche. Cliquez sur une suggestion pour remplir le formulaire. |
| **Élément de gauche**, **Opérateur**, **Élément de droite** | Une paire de colonnes et la façon dont elles se comparent. |
| X sur une paire | Retire la paire. La dernière paire ne peut pas être retirée. |
| **Ajouter une paire de colonnes** | Ajoute une autre paire. Chaque paire doit correspondre (AND). Cela donne une jointure sur plusieurs colonnes. |
| **Type de jointure** | Le genre de jointure. |

| Option (**Opérateur**) | Signification / quand la choisir |
|---|---|
| `=` | Les colonnes sont égales. Presque toujours le bon choix. |
| `<>`, `<`, `<=`, `>`, `>=` | Autres comparaisons. Rares. |

| Option (**Type de jointure**) | Signification / quand la choisir |
|---|---|
| INNER | Uniquement les lignes qui correspondent des deux côtés. La valeur par défaut. |
| LEFT | Toutes les lignes du dossier de gauche, avec ou sans correspondance. |
| RIGHT | Toutes les lignes du dossier de droite, avec ou sans correspondance. |

Il n'y a pas de jointure complète, volontairement.

![La boîte de dialogue Nouvelle jointure avec une liste déroulante ouverte.](shots/fr-FR/admin/23-joins-select-open.png)

Exemple : relier deux dossiers.

1. Choisissez le domaine et cliquez sur **Nouvelle jointure**.
2. Choisissez le **Dossier de gauche** et le **Dossier de droite**.
3. Cliquez sur **Suggérer des jointures** et cliquez sur la suggestion qui convient.
4. Vérifiez le **Type de jointure** et cliquez sur **Enregistrer**.

---

# Hiérarchies

Une **hiérarchie** est une liste ordonnée d'éléments, du plus large au plus étroit, par exemple Année, Trimestre, Mois. Elle définit la façon d'explorer par niveaux. Choisissez d'abord un domaine d'activité.

![La page Hiérarchies avec le tableau indiquant le nombre de niveaux.](shots/fr-FR/admin/24-hierarchies.png)

Les colonnes sont **Nom** et **Niveaux**.

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Domaine d'activité** | Choisit le domaine. |
| **Nouvelle hiérarchie** | Ouvre le formulaire. |
| Icône **Modifier** | Ouvre la hiérarchie avec ses niveaux. |
| Icône **Supprimer** | Désactive la hiérarchie après confirmation. |

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Nom**, **Description** | Champs de texte. |
| **Ajouter un niveau** | Ajoute un niveau en bas. |
| Poignée de déplacement | Faites glisser pour réordonner. L'ordre est l'ordre d'exploration (de haut en bas). |
| **Nom du niveau** | Le nom du niveau. |
| **Dossier**, **Élément** | L'élément qui constitue ce niveau. Choisir un nouveau dossier efface l'élément. |
| X sur un niveau | Retire le niveau. |
| **Enregistrer** | Désactivé tant que la hiérarchie n'a pas de nom, au moins un niveau, et que chaque niveau n'a pas un nom et un élément. |

> **Attention :** la liste **Dossier** affiche aussi les dossiers partagés depuis d'autres domaines, mais une hiérarchie n'accepte que des éléments de dossiers que son propre domaine possède. Un élément d'un dossier partagé depuis un autre domaine est refusé à l'enregistrement.

![La boîte de dialogue Nouvelle hiérarchie après l'ajout d'un niveau, avec les listes Dossier et Élément.](shots/fr-FR/admin/26-hierarchies-level-added.png)

---

# Fonctions personnalisées

Une **fonction personnalisée** enregistre une fonction qui se trouve dans la base de données Oracle, afin que les éléments calculés puissent l'appeler. Elle n'a pas de domaine d'activité.

![La page Fonctions personnalisées avec la zone de filtre, Tout actualiser, Nouvelle fonction et le tableau des fonctions.](shots/fr-FR/admin/27-custom-functions.png)

Les colonnes sont **Nom**, **Type**, **Fonction de la base** (`OWNER.PACKAGE.NAME`, avec `@LINK` le cas échéant), **Source de données**, **Paramètres** et **Type de retour**.

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Tout actualiser** | Relit depuis Oracle chaque fonction qui a une source de données et réécrit les signatures modifiées. Recompile les champs calculés si quelque chose a changé. Les fonctions disparues d'Oracle sont seulement listées et conservées. |
| **Nouvelle fonction** | Ouvre le formulaire. |
| **Filtrer par nom ou fonction de la base…** | Filtre le tableau. |
| Icône **Actualiser depuis la base de données** | Actualise une seule fonction. |
| Icône **Modifier** | Modifie la fonction. |
| Icône **Supprimer** | Désactive la fonction après confirmation. |
| Panneau **Résultat de l’actualisation**, **Fermer** | Liste ce qui a changé, ce qui a disparu et ce qui a échoué. |

## Le formulaire de fonction

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Source de données** | L'endroit où se trouve la fonction. Choisie pour vous s'il n'y en a qu'une. |
| **Propriétaire**, **Rechercher une fonction**, **Rechercher** | Recherche des fonctions et des packages dans la base de données Oracle. Fonctionne uniquement pour une source de données Oracle. Cliquez sur un résultat pour remplir le formulaire. Les résultats qui ne peuvent pas être appelés depuis SQL sont grisés avec la raison. |
| **Propriétaire**, **Package**, **Nom de la fonction**, **Lien de base de données** | Les parties de l'adresse de la fonction. Utilisez des lettres, des chiffres, `_`, `$` ou `#`, en commençant par une lettre. |
| **Nom**, **Description** | Le nom que voient les gens, et un texte. |
| **Type de fonction** | Le genre de fonction. |
| **Type de retour** | Par exemple NUMBER. |
| **Paramètres (JSON)** | Une liste de paramètres. Chacun exige un nom et un type, par exemple `[{ "name": "p_id", "type": "NUMBER", "required": true }]`. |

| Option (**Type de fonction**) | Signification / quand la choisir |
|---|---|
| SQL | Une fonction écrite en SQL. |
| PLSQL | Une fonction PL/SQL autonome. La valeur par défaut. |
| PACKAGE | Une fonction dans un package. La recherche choisit ce type quand elle trouve un package. |

![La boîte de dialogue Nouvelle fonction personnalisée listant les fonctions de la base qui correspondent à la recherche.](shots/fr-FR/admin/29-custom-functions-search-results.png)

---

# Sources de données

Une **source de données** est une connexion enregistrée à une base de données. Les domaines d'activité, les dossiers et les migrations l'utilisent. Les mots de passe sont stockés sur le serveur et ne sont plus jamais affichés.

![La page Sources de données avec un tableau de connexions et cinq icônes de ligne.](shots/fr-FR/admin/30-data-sources.png)

Les colonnes sont **Nom**, **Type**, **Hôte**, **Statut** et **Créé le**.

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Nouvelle source de données** | Ouvre le formulaire de connexion. |
| Icône **Tester la connexion** | Essaie de se connecter avec les informations enregistrées. Le résultat s'affiche dans une notification et dans une zone au-dessus du tableau. |
| Icône **Introspecter le schéma** | Relit le schéma Oracle. La notification indique combien de tables ont été trouvées. Fonctionne uniquement pour Oracle. |
| Icône **Importer des tables** | Ouvre **Importer des tables**. |
| Icône **Modifier** | Modifie la connexion. |
| Icône **Supprimer** | Désactive la source de données après confirmation. |

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Nom** | Doit être unique. |
| **Type de connexion** | Le genre de base de données. |
| **Hôte**, **Port** | L'emplacement du serveur. |
| **Nom du service**, **SID** | Affichés pour Oracle uniquement. |
| **Nom d'utilisateur** | Le compte de la base de données. |
| **Mot de passe** | Le mot de passe du compte. À la modification, laissez-le vide pour conserver celui enregistré. |

| Option (**Type de connexion**) | Signification / quand la choisir |
|---|---|
| **Oracle** | Une base de données Oracle. Nécessaire pour l'introspection, la recherche de fonctions et la migration. |
| **PostgreSQL** | Une base de données PostgreSQL. |

## Importer des tables

**Importer des tables** transforme plusieurs tables en dossiers d'un coup.

1. Cliquez sur l'icône **Importer des tables**.
2. Saisissez le **Propriétaire de la table / Schéma** (le nom d'utilisateur de la source de données est la valeur par défaut).
3. Cliquez sur **Découvrir les tables**.
4. Choisissez le **Domaine d'activité** qui possédera les nouveaux dossiers.
5. Cochez les tables souhaitées.
6. Cliquez sur **Importer n table(s)**. La notification indique combien de dossiers ont été créés et combien ont été ignorés parce qu'ils existent déjà.

![La boîte de dialogue Importer des tables avec le bouton Découvrir les tables, avant qu'une table soit trouvée.](shots/fr-FR/admin/34-data-sources-import-dialog.png)

---

# Utilisateurs

**Utilisateurs** liste tous les comptes. Utilisez-la pour ajouter des personnes, changer des rôles, désactiver des comptes et confier des cartes à d'autres personnes.

![La page Utilisateurs avec les boutons Fichier d'identifiants et Nouvel utilisateur et les icônes de ligne.](shots/fr-FR/admin/35-users.png)

Les colonnes sont **Nom**, **E-mail**, **Rôle** et **Statut** (**Actif** ou **Inactif**).

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Fichier d'identifiants** | Donne un nouveau mot de passe temporaire à chaque compte actif qui en a encore un, et télécharge la liste sous forme de fichier CSV. |
| **Nouvel utilisateur** | Ouvre le formulaire de création. |
| Icône **Cartes que cet utilisateur peut ouvrir** | Ouvre la liste des cartes que cette personne peut ouvrir, et pourquoi. |
| Icône **Modifier** | Modifie le nom, l'e-mail, le mot de passe ou le rôle. |
| Icône **Désactiver** | Désactive le compte. S'affiche sur les comptes actifs. |
| Icône **Activer** | Réactive le compte, sans question. S'affiche sur les comptes inactifs. |
| Icône **Supprimer** | Supprime définitivement le compte. |

Vous ne pouvez pas désactiver ni supprimer votre propre compte. Ces icônes sont grisées sur votre ligne.

## Créer ou modifier un utilisateur

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Nom** | Obligatoire, 255 caractères maximum. |
| **E-mail** | L'adresse de connexion. Elle doit être unique. |
| **Mot de passe** | Au moins 8 caractères. À la modification, laissez-le vide pour conserver l'ancien. Un mot de passe que vous définissez n'oblige pas la personne à le changer. |
| **Rôle** | Le type de compte. La liste en dessous explique chaque rôle. |

| Option (**Rôle**) | Signification / quand la choisir |
|---|---|
| ADMIN | Peut tout faire : utilisateurs, domaines d'activité, sources de données, sécurité et audit. Ouvre, modifie, partage et supprime toutes les cartes. À donner à très peu de personnes. |
| MANAGER | Ouvre, exécute, exporte, planifie et partage toutes les cartes, et change le propriétaire d'une carte. Ne modifie que ses propres cartes et les cartes partagées avec **Peut modifier**. Voit, modifie, active et désactive les comptes MANAGER, USER et VIEWER, mais ne voit jamais les administrateurs et ne peut ni créer ni supprimer d'utilisateurs, ni donner le rôle ADMIN. Ne peut pas modifier les domaines d'activité, dossiers, éléments, jointures ni hiérarchies, quel que soit son accès. Ne peut pas utiliser **Fonctions personnalisées**, **Sources de données**, **Sécurité**, **Journal d'audit** ni **Migration**. |
| USER | Voit ses propres cartes, les cartes publiques et les cartes partagées avec lui. Exécute, exporte et planifie selon ce que permet chaque partage. Copie des cartes et crée de nouvelles cartes là où il a un accès CREATE. La valeur par défaut. |
| VIEWER | Comme USER, mais ne peut pas copier de cartes ni de classeurs. Pour une personne qui doit seulement lire : partagez les cartes avec **Peut consulter** et ne donnez aucun accès CREATE. |

> **Remarque :** le court texte sous la liste **Rôle** à l'écran est un résumé. Le tableau ci-dessus décrit ce que chaque rôle peut réellement faire.

Un changement de rôle s'applique au prochain clic de la personne. Elle n'a pas besoin de se reconnecter.

![La boîte de dialogue Nouvel utilisateur avec la liste Rôle ouverte et chaque rôle décrit.](shots/fr-FR/admin/37-users-role-open.png)

## Désactiver, activer ou supprimer

- **Désactiver** conserve le compte et son historique. La personne est déconnectée à sa prochaine requête et ne peut pas se connecter tant que vous n'activez pas le compte. Utilisez-le quand quelqu'un part ou est absent.
- **Activer** réactive le compte immédiatement.
- **Supprimer** supprime définitivement le compte et ne peut pas être annulé. La confirmation le précise et liste ce qui disparaît avec le compte : ses planifications, exécutions et exportations. En cas de doute, utilisez **Désactiver**.

![La boîte de dialogue de confirmation affichée avant de désactiver un utilisateur.](shots/fr-FR/admin/39-users-deactivate-dialog.png)

> **Attention :** **Supprimer** est définitif. **Désactiver** ne l'est pas.

## Le fichier d'identifiants

Les comptes migrés démarrent avec un mot de passe temporaire et doivent le changer avant de pouvoir faire quoi que ce soit. **Fichier d'identifiants** crée un nouveau mot de passe temporaire pour chaque compte actif qui en a encore un, et télécharge un CSV. Chaque clic crée de nouveaux mots de passe : conservez donc le fichier en lieu sûr et ne donnez à chaque personne que sa propre ligne. Les comptes inactifs ou qui représentent des rôles de base de données sont ignorés.

## Cartes que cet utilisateur peut ouvrir

L'icône ouvre **Cartes de <nom>**. Elle liste exactement ce que la personne voit sur sa propre page **Cartes**, avec le propriétaire et la raison.

![La boîte de dialogue Cartes d'un utilisateur, avec les badges d'origine et les listes de niveau de partage.](shots/fr-FR/admin/41-users-maps-dialog.png)

| Badge | Signification |
|---|---|
| Administrateur | La personne est administratrice et voit toutes les cartes. |
| Propriétaire | La personne possède la carte. |
| Partagée | La carte a été partagée avec la personne. |
| Publique | La carte est publique. |
| Rôle de gestionnaire | La personne est manager et voit toutes les cartes. |

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| Nom de la carte | Ouvre la carte dans la visionneuse. |
| Liste du niveau de partage | Pour une carte partagée, change le niveau : **Peut consulter**, **Peut exporter**, **Peut modifier**. |
| Icône de transfert de carte | Affiche la liste **Nouveau propriétaire**. |
| **Nouveau propriétaire** | Choisissez un utilisateur actif. La carte passe à cette personne. Elle peut la modifier, la partager et la supprimer. |
| Icône X | Retire cette carte à la personne immédiatement, sans question. |

Exemple : un collègue part. Ouvrez **Cartes que cet utilisateur peut ouvrir** pour ce collègue. Pour chaque carte dont il est propriétaire, cliquez sur l'icône de transfert et choisissez le nouveau propriétaire. Puis cliquez sur **Désactiver** sur le compte.

---

# Stratégies de sécurité

**Stratégies de sécurité** contrôle la **sécurité au niveau des lignes** : quelles lignes d'un dossier chaque personne peut voir. Une **stratégie** contient une ou plusieurs **règles**. Chaque règle pointe vers un domaine d'activité ou un dossier et contient un filtre écrit sous forme de test SQL. Le filtre est ajouté à chaque requête exécutée par une personne couverte par la stratégie.

![La page Stratégies de sécurité avec les boutons Tester et Nouvelle stratégie.](shots/fr-FR/admin/43-security.png)

> **Attention :** ce qui arrive à un dossier qu'aucune stratégie ne couvre dépend d'un réglage de l'installation (`ROW_LEVEL_FAIL_MODE`). **Fermé**, la valeur par défaut : personne ne voit ses lignes, administrateurs compris, et les exécutions s'arrêtent avec **Refusing to run unfiltered**. **Ouvert** : toute personne ayant un accès voit toutes ses lignes. Demandez à la personne qui a installé le système quel mode est utilisé chez vous. En mode fermé, écrivez et attribuez des stratégies avant que les gens exécutent des cartes.

Les colonnes sont **Nom**, **Description**, **Statut**, **Règles** et **Attributions**.

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Tester** | Ouvre **Tester une stratégie**. |
| **Nouvelle stratégie** | Ouvre le formulaire de stratégie. |
| Icône **Attributions** | Ouvre la boîte de dialogue **Attributions**. |
| Icône **Modifier** | Modifie la stratégie. |
| Icône **Supprimer** | Supprime la stratégie après confirmation. |

## Écrire une stratégie

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Nom** | Obligatoire. |
| **Description** | Texte facultatif. |
| **Actif** | Une stratégie inactive n'est pas appliquée. |
| **Ajouter une règle** | Ajoute une autre règle. Une stratégie en exige au moins une. |
| **S'applique à** | Ce vers quoi la règle pointe. |
| **Domaine d'activité**, **Dossier** | La cible. **Dossier** liste les dossiers du domaine choisi. |
| **Prédicat SQL (fragment de clause WHERE)** | Le filtre. Il ne doit pas être vide. |
| **Valider** | Vérifie le filtre. **Prédicat valide** signifie qu'il est correct. |
| **Supprimer la règle** | Supprime la règle. |

| Option (**S'applique à**) | Signification / quand la choisir |
|---|---|
| **Domaine d'activité** | La règle couvre chaque dossier du domaine. |
| **Dossier** | La règle couvre un seul dossier. |

Dans le filtre, vous pouvez utiliser `:current_user_id`, `:current_user_email` et `:current_user_role`. Utilisez `{alias}` pour le nom du dossier à l'intérieur de la requête. Exemple : `{alias}.REGION = 'NORTH'`. Tous les filtres qui correspondent sont reliés par AND.

> **Remarque :** un dossier COMPLEX couvert par une stratégie est refusé. Utilisez un autre type de dossier si le dossier a besoin d'une stratégie.

![La boîte de dialogue Nouvelle stratégie après un clic sur Valider pour un prédicat.](shots/fr-FR/admin/46-security-validate.png)

## Attribuer une stratégie

Une stratégie s'applique à chaque personne attribuée, et à toute personne qui détient un rôle attribué.

| Option (**Attribuer à**) | Signification / quand la choisir |
|---|---|
| **Utilisateur** | Une personne nommée. Choisissez-la dans **Utilisateur**. |
| **Rôle** | Toutes les personnes ayant ce rôle : ADMIN, MANAGER, USER ou VIEWER. Choisissez-le dans **Rôle**. |

1. Cliquez sur l'icône **Attributions**.
2. Choisissez **Utilisateur** ou **Rôle**, puis choisissez la personne ou le rôle.
3. Cliquez sur **Attribuer**. La notification **Stratégie attribuée** apparaît.
4. Pour supprimer, cliquez sur l'icône **Supprimer l'attribution**.

Une stratégie sans attribution ne donne de lignes à personne (« Non attribuée — cette stratégie ne donne de lignes à personne. »).

## Tester une stratégie

**Tester** montre où les filtres atterrissent dans une requête d'exemple. Elle n'exécute pas la requête. Choisissez la **Stratégie**, modifiez la **Requête d'exemple** (la valeur par défaut est `SELECT * FROM SALES`), et cliquez sur **Exécuter le test**. Le résultat apparaît sous **Requête avec prédicats de sécurité**.

---

# Journal d'audit

Le **Journal d'audit** enregistre chaque modification et chaque événement de connexion du système. Utilisez-le pour savoir qui a fait quoi et quand. Il est en lecture seule.

![La page Journal d'audit avec le bouton d'exportation, les cartes de statistiques, le graphique quotidien et les filtres.](shots/fr-FR/admin/47-audit.png)

Le haut de la page affiche **Total des actions**, **Actions principales** et **Actions par jour**.

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Exporter le CSV (cette page)** | Enregistre les lignes à l'écran (jusqu'à 25) en CSV. Ce n'est pas tout le journal. |
| Filtre **Utilisateur** | Affiche les actions d'une seule personne. **Tous les utilisateurs** le supprime. |
| **Type d'entité** | Affiche un seul type d'objet. Saisissez le texte exact, par exemple `maps`. |
| **Action** | Affiche une seule action. Saisissez le texte exact, par exemple `POST /api/maps`. |
| **De**, **À** | La plage de dates. |
| **Effacer** | Supprime tous les filtres. |
| Icône **Afficher les détails** | Ouvre **Détails de l'entrée d'audit** avec l'entrée complète. |
| **Précédent**, **Suivant** | Naviguent entre les pages de 25 lignes. |

Les colonnes sont **Horodatage**, **Utilisateur**, **Action**, **Entité** et **Adresse IP**. Un utilisateur vide affiche **Système / non authentifié**.

Ce qui est enregistré : chaque requête qui modifie quelque chose (création, modification, suppression, connexion, déconnexion, exportation, migration), ainsi que la lecture des domaines d'activité, dossiers, éléments, jointures, hiérarchies, fonctions personnalisées et sources de données. Les mots de passe et les jetons ne sont jamais stockés. Les filtres de texte correspondent au texte entier et respectent la casse.

Quand vous lisez les données d'un dossier sans accès, le journal l'enregistre comme un contournement par administrateur.

---

# Migration

**Migration** importe une couche utilisateur final (EUL, End User Layer) Oracle Discoverer dans Discoverer Neo. L'EUL est l'endroit où Discoverer conservait ses domaines d'activité, dossiers, éléments, utilisateurs et classeurs. C'est puissant. Elle écrit de nombreux objets dans cette base de données.

> **Attention :** faites toujours d'abord une **simulation** et lisez le rapport. Une migration réelle écrit dans la base de données de Discoverer Neo. **Réimporter les cartes** remplace toutes les cartes du domaine d'activité « Migrated Workbooks » : les modifications faites depuis la première migration sont donc perdues, ainsi que les planifications, partages, exécutions et exportations de ces cartes. Préférez **Tout réimporter**, qui les conserve.

![La page Migration avec la carte Source, ses boutons et son texte d'aide.](shots/fr-FR/admin/50-migration.png)

La source est une **source de données** Oracle que vous avez enregistrée au préalable (voir **Sources de données**). Son mot de passe enregistré est utilisé sur le serveur. Aucun mot de passe n'est saisi sur cette page.

## Choisir la source

| Bouton ou contrôle | Ce qu'il fait |
|---|---|
| **Source de données Oracle** | La connexion Oracle qui contient l'EUL. |
| **Propriétaire du schéma EUL (facultatif)** | Le schéma qui possède l'EUL, par exemple `EUL5_US`. |
| **Version EUL** | La version de l'EUL. |
| **Détecter la version** | Trouve la version et affiche la carte **Source détectée**. |
| **Analyser** | Vérifie la préparation et la complexité. Remplit la carte **Évaluation**. |
| **Simulation (valider sans écrire)** | Activée par défaut. Les exécutions ne sont qu'un test et n'écrivent rien. |
| **Lancer une simulation** / **Lancer la migration** | Démarre la tâche. Le nom suit la case **Simulation**. |
| **Réimporter les cartes** | Reconstruit les cartes d'une base de données déjà migrée. |
| **Tout réimporter** | Rejoue toute la migration avec la version actuelle. |
| **Compiler les champs calculés** | Vérifie chaque champ calculé et écrit le SQL qu'exécutent les cartes. |

| Option (**Version EUL**) | Signification / quand la choisir |
|---|---|
| **Détection automatique** | Le système trouve la version. À choisir en premier. |
| **Forcer EUL4** | Traite la source comme Discoverer 4. |
| **Forcer EUL5** | Traite la source comme Discoverer 9i, 10g ou 11g. |

## Ce que fait chaque action

| Action | Ce qu'elle fait |
|---|---|
| **Lancer la migration** | Une première migration d'une cible vide. Elle ne peut pas s'exécuter sur une cible qui contient déjà une migration (**La base de données cible est déjà migrée**). Utilisez plutôt une réimportation. |
| **Réimporter les cartes** | Reconstruit uniquement les cartes, à partir des classeurs de l'EUL. Elle remplace toutes les cartes du domaine d'activité « Migrated Workbooks », et supprime avec elles leurs planifications et partages. Elle ne touche ni aux utilisateurs, ni aux dossiers, ni aux éléments, ni aux accès. |
| **Tout réimporter** | Réécrit, objet par objet, tout ce qui diffère maintenant : domaines d'activité, dossiers, éléments, jointures, hiérarchies, fonctions, utilisateurs, accès et cartes. Rien n'est supprimé. Les identifiants de cartes sont conservés, donc les planifications et partages aussi. Les objets retirés de l'EUL sont seulement signalés. Une exécution réelle se termine par la compilation des champs calculés. |
| **Compiler les champs calculés** | À utiliser si une carte indique qu'un champ « n'a pas été compilé ». Une migration et une réimportation le font déjà à la fin. Elle ne lit pas l'EUL. |

Les boutons sont désactivés pendant l'exécution d'une tâche, ou quand aucune source de données n'est choisie. **Compiler les champs calculés** fonctionne même sans source de données.

## Faire une migration en toute sécurité

1. Enregistrez la source de données Oracle dans **Sources de données** et testez-la.
2. Choisissez-la ici. Cliquez sur **Détecter la version**, puis sur **Analyser**. Lisez l'**Évaluation** : préparation, points bloquants et avertissements.
3. Laissez **Simulation** cochée. Cliquez sur **Lancer une simulation**.
4. Lisez le rapport : **Lignes qui seraient insérées**, le résumé, le rapprochement et le **Journal de la migration**.
5. Quand la simulation est propre, décochez **Simulation**. L'avertissement « A live migration writes into this Discoverer Neo database » apparaît. Cliquez sur **Lancer la migration**.
6. Ouvrez **Utilisateurs**. Les comptes migrés ne peuvent pas se connecter tant qu'ils n'ont pas de mot de passe. Cliquez sur **Fichier d'identifiants** et distribuez les mots de passe.
7. Passez en revue les cartes du domaine d'activité « Migrated Workbooks » et déplacez chacune vers le domaine auquel elle appartient.

La carte **Évaluation** affiche un score de préparation sur 100, la complexité, l'effort estimé, le nombre d'éléments trouvés, la couverture de la mise en page des feuilles, les points bloquants et les avertissements.

---

# Questions fréquentes

**Je ne vois pas une carte qu'un collègue voit. Ou un collègue ne voit pas ma carte.**
Vous voyez toutes les cartes, donc le problème vient du collègue. Ouvrez **Utilisateurs**, cliquez sur **Cartes que cet utilisateur peut ouvrir**, et vérifiez le badge. Si la carte est absente, partagez-la (**Peut consulter** au minimum) ou rendez-la publique.

**Un utilisateur ouvre une carte mais l'exécution s'arrête avec « Exécution non autorisée ».**
La carte est visible mais la personne n'a pas d'accès au domaine d'activité de ses dossiers. Ajoutez un accès dans **Domaines d'activité**. En mode fermé, l'absence de stratégie de sécurité au niveau des lignes donne la même bannière.

**Tout le monde obtient « Refusing to run unfiltered ».**
L'installation exécute la sécurité au niveau des lignes en mode fermé, et aucune stratégie ne couvre le dossier. Écrivez une stratégie dans **Stratégies de sécurité** et attribuez-la.

**Une personne peut consulter une carte mais ne peut ni l'exporter ni la planifier.**
Son partage est **Peut consulter**. Changez-le en **Peut exporter**. Les cartes publiques peuvent être exportées mais pas planifiées.

**Un utilisateur migré ne peut pas se connecter.**
Le compte n'a pas encore de mot de passe. Utilisez **Fichier d'identifiants** dans **Utilisateurs**. Si la personne est désactivée, cliquez sur **Activer**.

**Je ne peux pas supprimer ni désactiver mon propre compte.**
C'est voulu. Demandez à un autre administrateur.

**La page Exécutions n'affiche que mes exécutions.**
Cochez **Afficher les exécutions de tous les utilisateurs**.

**Je ne peux pas télécharger une exportation faite par quelqu'un d'autre.**
Les exportations sont privées, même pour les administrateurs. Demandez à la personne d'exporter de nouveau.

**Une planification que j'ai créée pour la carte d'une autre personne n'est pas dans la liste.**
La page **Planifications** ne liste que les planifications que vous avez créées. La liste **Carte** du formulaire affiche vos propres cartes et les cartes partagées avec vous. Pour planifier la carte de quelqu'un d'autre, utilisez l'icône Calendrier dans **Cartes**.

**Ma planification mensuelle affiche toujours les mêmes dates.**
Ses paramètres de date ont une **Valeur fixe**. Modifiez la planification et réglez-les sur **Relatif à la date d’exécution**, par exemple -1 **mois**, **premier jour de ce mois** et **dernier jour de ce mois**.

**J'ai cliqué sur Enregistrer et j'ai vu « Aucune modification à enregistrer ».**
Rien n'a changé depuis le dernier enregistrement, donc rien n'a été envoyé. La carte est déjà enregistrée.

**Un champ calculé indique qu'il « n'a pas été compilé ».**
Cliquez sur **Compiler les champs calculés** dans **Migration**.

## Glossaire

| Terme | Signification |
|---|---|
| Carte | Un rapport. Dans Oracle Discoverer, c'était une feuille de calcul. |
| Classeur | Un groupe de cartes. |
| Domaine d'activité | Un groupe de données liées. L'unité des accès. |
| Dossier | Une table, une vue ou une requête d'un domaine d'activité. |
| Élément | Une colonne d'un dossier. |
| Jointure | Une règle qui relie deux dossiers. |
| Hiérarchie | Une liste ordonnée d'éléments utilisée pour l'exploration par niveaux. |
| Accès | Un niveau d'accès à un domaine d'activité, donné à une personne. |
| Exécution | Un lancement d'une carte. Son résultat est stocké pendant un certain temps. |
| Exportation | Un fichier (XLSX, CSV ou PDF) créé à partir d'une exécution terminée. |
| Planification | Un calendrier qui exécute une carte automatiquement et stocke le résultat. |
| Partage | L'accès à une carte, donné à une personne : **Peut consulter**, **Peut exporter** ou **Peut modifier**. |
| Carte publique | Une carte que tout utilisateur connecté peut ouvrir et exporter. |
| Source de données | Une connexion enregistrée à une base de données. |
| Sécurité au niveau des lignes | Des règles qui décident quelles lignes d'un dossier une personne voit. |
| EUL | End User Layer (couche utilisateur final). L'endroit où Oracle Discoverer conservait ses métadonnées. |
| Simulation | Un test de migration qui n'écrit rien. |
