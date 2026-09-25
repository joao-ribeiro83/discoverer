# Discoverer Neo — Guide du rôle USER

Ce guide s'adresse aux personnes dont le compte a le rôle **USER**. Il indique
ce que vous pouvez faire, où le trouver, et quoi demander à votre
administrateur.

Discoverer Neo remplace Oracle Discoverer. Les rapports que vous connaissiez
sous le nom de **feuilles** s'appellent des **cartes** ici. Un **classeur**
reste un groupe de feuilles.

---

## 1. Ce que le rôle USER permet de faire

| Vous pouvez | Vous ne pouvez pas |
|---------|-----------|
| Exécuter les cartes auxquelles vous avez accès | Créer ou modifier des domaines d'activité, des dossiers, des éléments, des jointures ou des sources de données |
| Exporter les résultats vers Excel, CSV et PDF | Gérer les utilisateurs, la sécurité ou le journal d'audit |
| Planifier l'exécution automatique de cartes | Exécuter la migration depuis Oracle Discoverer |
| Créer et modifier vos propres cartes (si votre administrateur vous y autorise) | Voir les exécutions des autres utilisateurs |
| Partager **vos propres** cartes avec des collègues | Partager une carte dont vous n'êtes pas propriétaire |
| Choisir votre langue et votre thème | |

Le menu n'affiche que ce que votre rôle permet d'utiliser. Si vous ne voyez
pas une page que voit un collègue, c'est qu'il a un rôle différent.

### D'où vient votre accès

Votre rôle n'est qu'une partie de l'image. Votre administrateur vous donne
aussi l'**accès à des domaines d'activité** (des groupes de données liées).
Vous pouvez ouvrir une carte de l'une de ces façons :

- **Vous l'avez créée.** Vous pouvez toujours exécuter, modifier, exporter,
  planifier, partager et supprimer vos propres cartes.
- **Quelqu'un l'a partagée avec vous.** Ce que vous pouvez faire dépend du
  niveau de partage (voir la [section 8](#8-partager-des-cartes)).
- **Elle est publique.** Tout utilisateur peut ouvrir, exécuter et exporter
  une carte publique.
- **Votre administrateur vous a donné des droits de création ou de
  modification dans son domaine d'activité.** Vous pouvez alors travailler
  avec les cartes de ce domaine.

Si une carte dont vous avez besoin ne figure pas dans votre liste, demandez à
votre administrateur ou au propriétaire de la carte.

---

## 2. Connexion

1. Ouvrez l'adresse Discoverer Neo que votre administrateur vous a
   communiquée.
2. Saisissez votre **E-mail** et votre **Mot de passe**.
3. Cliquez sur **Se connecter**.

### Première connexion avec un mot de passe temporaire

Si votre compte provient d'Oracle Discoverer, votre administrateur vous donne
un **mot de passe temporaire**. Il comporte 16 caractères, par exemple
`ufNnRksjgR7U%M6X`.

1. Connectez-vous avec votre adresse e-mail et le mot de passe temporaire.
2. L'écran **Modifier votre mot de passe** s'ouvre. Vous ne pouvez pas
   l'ignorer.
3. Saisissez à nouveau le mot de passe temporaire, puis votre nouveau mot de
   passe deux fois.
4. Le tableau de bord s'ouvre. Le mot de passe temporaire cesse de
   fonctionner.

Votre nouveau mot de passe doit comporter **au moins 12 caractères**. Il doit
être différent du mot de passe temporaire.

> **Astuce :** le mot de passe temporaire ne contient ni `O` majuscule, ni
> zéro, ni `l` minuscule, ni un. Ces caractères sont faciles à confondre, ils
> ne sont donc pas utilisés.

Si vous perdez le mot de passe temporaire, demandez à votre administrateur de
le réinitialiser.

Pour vous déconnecter, cliquez sur votre e-mail en haut à droite, puis sur
**Se déconnecter**.

---

## 3. L'écran

Le menu de gauche comprend les éléments suivants :

| Élément de menu | À quoi il sert |
|-----------|---------------|
| **Tableau de bord** | Vos chiffres en un coup d'œil et vos cartes récentes |
| **Cartes** | Rechercher, ouvrir, exécuter et créer des cartes |
| **Planifications** | Cartes qui s'exécutent automatiquement |
| **Exécutions** | Chaque exécution que vous avez lancée, et son résultat |
| **Exportations** | Fichiers que vous avez exportés |
| **Paramètres** (en bas) | Langue et thème |

### Tableau de bord

- **Nombre total de cartes** — les cartes que vous pouvez voir.
- **Nombre total d'exécutions** — le nombre de fois où vous avez exécuté une
  carte.
- **Cartes planifiées** — le nombre de vos planifications actives.
- **Résultats planifiés** — le nombre de résultats produits par vos
  planifications.
- **Cartes récentes** — les 5 dernières cartes que vous avez modifiées.

---

## 4. Rechercher une carte

1. Cliquez sur **Cartes**.
2. Choisissez un onglet :
   - **Mes cartes** — les cartes que vous avez créées.
   - **Partagées avec moi** — les cartes que d'autres personnes ont partagées
     avec vous.
   - **Tous** — toutes les cartes que vous êtes autorisé à voir. Cela inclut
     les cartes venues d'Oracle Discoverer.
3. Recherchez par nom, filtrez par domaine d'activité, ou triez par nom ou par
   date.

### Parcourir par classeur

Le panneau **Classeurs** regroupe les cartes telles que Discoverer les a
enregistrées. Cliquez sur un classeur pour voir ses feuilles dans leur ordre
d'origine. Cliquez sur une feuille pour l'ouvrir. Vous ne voyez que les
feuilles que vous êtes autorisé à voir.

---

## 5. Exécuter une carte

1. Ouvrez la carte.
2. Cliquez sur **Exécuter**.

### Paramètres

De nombreuses cartes demandent des valeurs avant de s'exécuter, par exemple
une date de début et une date de fin. Une fenêtre **Paramètres d'exécution**
s'ouvre.

1. Renseignez tous les champs marqués d'un `*` rouge. Ces champs sont
   obligatoires.
2. Laissez un champ facultatif vide pour utiliser sa valeur par défaut
   enregistrée.
3. Cliquez sur **Exécuter**.

Si vous cliquez sur **Exécuter** et que rien ne semble se passer, cherchez
cette fenêtre. La carte attend que vous la remplissiez.

**Listes de valeurs.** La plupart des champs affichent une liste des valeurs
actuellement présentes dans la base de données. Cliquez sur le champ ou
commencez à saisir du texte. Vous pouvez toujours saisir n'importe quelle
valeur. Si une colonne a trop de valeurs, le champ affiche
*« Trop de valeurs à lister — saisissez pour rechercher »*. Saisissez deux ou
trois caractères pour voir les correspondances.

**Dates.** Saisissez les dates dans le format indiqué par le champ.

### Ce qui se passe après avoir cliqué sur Exécuter

Une exécution passe par ces étapes :

- **En attente** — l'exécution attend son tour. Vos exécutions se déroulent
  une par une, dans l'ordre.
- **En cours** — la base de données la traite.
- **Terminée** — les lignes s'affichent dans le tableau.

Si vous exécutez à nouveau la même carte avec les mêmes valeurs et qu'un
résultat valide existe, Neo affiche ce résultat immédiatement. Il est marqué
**Résultat réutilisé**. Cliquez sur **Exécuter à nouveau** pour obtenir des
données actualisées.

Un résultat reste disponible **jusqu'à un jour**. Passé ce délai, vous devez
exécuter la carte à nouveau.

### Quand Exécuter est grisé

La raison s'affiche sous le bouton. **Aucune colonne de sortie** signifie que
la carte n'a aucune colonne à afficher. Ouvrez la carte dans le générateur et
ajoutez une colonne.

Deux autres messages peuvent s'afficher après avoir cliqué sur **Exécuter** :

- **Exécution non autorisée** — vous pouvez ouvrir la carte, mais vous ne
  pouvez pas l'exécuter sur ces données. Demandez à votre administrateur.
- **Impossible de se connecter à la source de données** — la base de données
  n'est pas disponible. Réessayez plus tard. Si cela persiste, prévenez votre
  administrateur.

### Quand une carte est refusée (panneau orange)

Parfois, Neo peut construire la requête mais ne peut pas garantir que les
chiffres sont corrects. Il affiche alors un **panneau orange**, et non une
erreur rouge. Le panneau indique ce que vous avez demandé, pourquoi Neo ne
peut pas répondre, et ce qu'il faut changer. Oracle Discoverer refusait le
même type de requête.

Ce n'est pas une erreur. Modifiez la carte comme l'indique le panneau, ou
demandez au propriétaire de la carte de la modifier.

---

## 6. Lire les résultats

### Ruptures de groupe et totaux

- **Ruptures de groupe** — une colonne groupée affiche sa valeur une seule
  fois, sur la première ligne de chaque groupe. Son en-tête porte un badge
  **Groupe**.
- **Sous-totaux** — une ligne à la fin de chaque groupe, par exemple
  `Total for EMEA`.
- **Totaux généraux** — une ligne en gras en bas.

Les totaux utilisent **toutes les lignes qui correspondent aux filtres**, pas
seulement les lignes affichées à l'écran.

**Quand vous triez ou filtrez le tableau, les groupes et les sous-totaux
s'arrêtent.** Le tableau devient une simple liste. Supprimez le tri pour
retrouver les groupes. Une note en bas de page vous avertit quand cela se
produit.

### Pourquoi un total est vide

Il arrive qu'une cellule de total soit vide intentionnellement. Cela se
produit quand les colonnes proviennent d'ensembles de lignes différents, et
que les additionner donnerait un nombre erroné. Oracle Discoverer faisait de
même. Les lignes du tableau sont correctes. Seul le total n'est pas affiché.
La note en bas de page indique combien de totaux sont vides.

### Tri, recherche et colonnes

- Cliquez sur l'en-tête d'une colonne pour trier : premier clic A → Z,
  deuxième clic Z → A, troisième clic supprime le tri.
- Utilisez la zone de recherche pour filtrer les lignes affichées à l'écran.
  Cela ne relance pas la requête.
- Faites glisser le bord d'un en-tête de colonne pour modifier sa largeur.

### Explorer le détail

Double-cliquez sur une ligne pour voir les lignes de détail qui la composent.
Par exemple, double-cliquez sur un total pour voir les lignes qui le
composent.

### Note jaune au-dessus des résultats

Une note jaune liste les paramètres que cette exécution n'a pas pu appliquer,
par exemple un tri sur une colonne que le rapport n'affiche pas. Les lignes
restent correctes.

### Tableaux croisés

Les cartes venues d'Oracle Discoverer arrivent sous forme de **tableaux**,
même quand l'original était un tableau croisé (pivot table). Discoverer
n'enregistrait pas quelles colonnes figuraient en haut. Si vous pouvez
modifier la carte, ouvrez une colonne dans le générateur et réglez **Bord du
tableau croisé** sur **En haut**.

---

## 7. Exporter les résultats

1. Exécutez la carte et attendez qu'elle affiche **Terminée**.
2. Cliquez sur **Excel**, **CSV** ou **PDF**.
3. L'exportation entre dans une file d'attente. Une fois prête, cliquez sur
   **Télécharger**.

| Format | À utiliser pour |
|--------|-----------|
| **Excel** (.xlsx) | Rapports et analyses |
| **CSV** | Charger les données dans d'autres outils |
| **PDF** | Imprimer et envoyer une mise en page fixe |

Tous les formats conservent les ruptures de groupe, les sous-totaux et les
totaux affichés à l'écran.

Il vous faut le partage **Peut exporter** (ou supérieur) pour exporter une
carte dont vous n'êtes pas propriétaire.

### Pourquoi les boutons d'exportation sont absents

L'exportation utilise les lignes déjà enregistrées par une exécution. Elle ne
relance pas la requête. Les boutons ne s'affichent que quand l'exécution est
**Terminée** et que son résultat n'a pas expiré. Cliquez sur **Exécuter à
nouveau** pour obtenir un nouveau résultat à exporter.

### La page Exportations

Cliquez sur **Exportations** pour voir toutes vos exportations et leur état :
**En file d'attente**, **En cours**, **Terminée** ou **Échouée**. Les
fichiers sont conservés pendant **7 jours**. Ensuite, ils sont supprimés.
Téléchargez les fichiers que vous voulez conserver.

Vous pouvez quitter la page pendant qu'une grande exportation s'exécute.
Revenez sur **Exportations** plus tard.

---

## 8. Partager des cartes

### Partager votre propre carte

Vous ne pouvez partager que les cartes que **vous avez créées**.

1. Ouvrez votre carte.
2. Cliquez sur **Partager**.
3. Choisissez un collègue.
4. Choisissez le niveau :

| Niveau | Ce que votre collègue peut faire |
|-------|---------------------------|
| **Peut consulter** | Ouvrir et exécuter la carte |
| **Peut exporter** | Ouvrir, exécuter, exporter et planifier la carte |
| **Peut modifier** | Tout ce qui précède, plus modifier la carte |

5. Cliquez sur **Partager**.

Pour changer un niveau, choisissez-en un nouveau dans la liste. Pour arrêter
de partager, cliquez sur **Retirer**. Le changement s'applique immédiatement.

Donnez le niveau le plus bas dont votre collègue a besoin.

**Cartes publiques.** Si vous réglez une carte sur **Public**, tout
utilisateur peut l'ouvrir, l'exécuter et l'exporter.

### Cartes partagées avec vous

Ouvrez **Cartes → Partagées avec moi**. Ce que vous pouvez faire dépend du
niveau que vous avez reçu. Un partage **Peut modifier** vous permet de
modifier la carte, mais vous **ne pouvez pas la partager** avec d'autres
personnes. Seul le propriétaire peut le faire.

Vos propres droits sur les données s'appliquent toujours. Un partage vous
donne la carte, pas de nouveaux droits sur les données. Si vous voyez
**Exécution non autorisée**, demandez à votre administrateur l'accès aux
données.

---

## 9. Créer et modifier des cartes

Vous ne pouvez créer une carte que dans un domaine d'activité où votre
administrateur vous a donné le droit de créer des cartes. Si **Créer une
carte** affiche une erreur, demandez ce droit.

### Créer une carte

1. Cliquez sur **Cartes**, puis sur **Créer une carte**.
2. Choisissez un domaine d'activité.
3. Saisissez un **Nom**. Vous pouvez ajouter une **Description**.
4. Choisissez un **Type de carte** : **TABLE** (le plus courant), **CROSSTAB**
   (tableau croisé), **PAGE_DETAIL** ou **CHART**.
5. Ajoutez des colonnes : choisissez des éléments dans la liste de gauche.
   Faites-les glisser pour changer l'ordre.
6. Ajoutez des filtres (conditions), des paramètres et des champs calculés si
   nécessaire.
7. Cliquez sur **Enregistrer**.

### Paramètres de colonne utiles

- **Ordre de tri** — 1, 2, 3… pour un tri sur plusieurs colonnes.
- **Agrégation** — SUM, COUNT, AVG, MIN ou MAX. Les autres colonnes deviennent
  les groupes.
- **Grouper et rompre** — afficher une valeur une fois par groupe et ajouter
  un sous-total.
- **Requête seulement, ne pas afficher** — la requête utilise la colonne,
  mais le tableau ne l'affiche pas.
- **Masque de format** — par exemple `999,999.00` ou `DD-MON-YYYY`. Chaque
  lecteur voit le format dans sa propre langue.

### Paramètres

Un paramètre demande une valeur quand la carte s'exécute. Le nom ne peut
contenir que des lettres, des chiffres et des underscores, et doit commencer
par une lettre, par exemple `start_date`.

### Mise en forme conditionnelle

Après avoir enregistré la carte, cliquez sur **Mise en forme** pour colorer
les cellules ou les lignes qui correspondent à une règle. Les règles
s'appliquent aussi aux exportations.

### Copier une carte

Cliquez sur **Dupliquer** pour créer votre propre copie d'une carte. Pour une
carte dont vous n'êtes pas propriétaire, il vous faut le droit de créer des
cartes dans son domaine d'activité.

### Sans souris

Chaque action de glisser-déposer a une touche clavier équivalente. Utilisez
**Tab** pour accéder à un élément, puis à son bouton **Ajouter**. Pour
déplacer une colonne, accédez à sa poignée, appuyez sur **Espace**, utilisez
les touches fléchées, puis appuyez de nouveau sur **Espace**.

---

## 10. Planifier des cartes

Une planification exécute une carte pour vous à des moments définis et
conserve les résultats.

Vous pouvez planifier vos propres cartes, et les cartes partagées avec vous
avec le niveau **Peut exporter** ou supérieur.

### Créer une planification

1. Cliquez sur **Planifications**, puis sur **Nouvelle planification**.
2. Choisissez la **Carte**.
3. Saisissez un **Nom**.
4. Choisissez une **Fréquence** : **Tous les jours (minuit)**, **Toutes les
   semaines (dimanche, minuit)**, **Tous les mois (le 1er, minuit)**, ou
   **Personnalisé**.
5. Choisissez le **Fuseau horaire**.
6. Facultatif : définissez **Valide à partir de** et **Valide jusqu'au**.
7. Choisissez le **Format de sortie** : Excel ou CSV.
8. Si la carte a des paramètres, renseignez les **Préréglages de
   paramètres**. Chaque exécution utilise ces valeurs.
9. Cochez **Activé**, puis enregistrez.

### Fréquence personnalisée (cron)

**Personnalisé** utilise une expression cron à cinq parties :
`minute hour day-of-month month day-of-week`.

| Quand | Expression |
|------|-----------|
| Tous les jours à 09h00 | `0 9 * * *` |
| Du lundi au vendredi à 08h00 | `0 8 * * MON-FRI` |
| Tous les lundis à 09h00 | `0 9 * * MON` |
| Toutes les 4 heures | `0 */4 * * *` |
| Le premier jour de chaque mois à minuit | `0 0 1 * *` |

### Gérer les planifications

Dans la liste **Planifications**, chaque planification propose ces actions :
**Exécuter maintenant**, **Suspendre** ou **Activer**, **Historique**,
**Modifier** et **Supprimer**.

Cliquez sur **Historique** pour voir chaque exécution, son statut, ses lignes
et sa durée. Cliquez sur **Ouvrir** pour voir les lignes, ou sur **XLSX**,
**CSV** ou **PDF** pour les télécharger.

### Planifications venues d'Oracle Discoverer

Les planifications venues d'Oracle Discoverer arrivent **désactivées**. Elles
ne s'exécutent pas tant que personne ne les a activées. Avant d'en activer
une, consultez la colonne **Planificateur** :

| Planificateur | Signification |
|---------|---------|
| **Non vérifié** | Pas encore vérifié. Vous pouvez l'activer et voir le résultat. |
| `FLAT(...)` ou `REWRITE(...)` | La carte peut s'exécuter correctement. |
| `REFUSE(...)` | La carte ne peut pas donner une réponse correcte. Chaque exécution échoue. Corrigez d'abord la carte. |
| `UNPLANNABLE` | La carte a un problème de données issu de la migration. Demandez à votre administrateur. |

Une exécution planifiée en échec ne réessaie pas automatiquement.

---

## 11. La page Exécutions

Cliquez sur **Exécutions** pour voir toutes les exécutions que vous avez
lancées, en direct ou planifiées. Vous voyez son statut, ses lignes, sa durée
et quand son résultat expire.

- **Ouvrir** — afficher les lignes de cette exécution.
- **Exécuter à nouveau** — exécuter avec les mêmes valeurs.
- **Annuler** — arrêter une exécution encore en attente.
- **Supprimer** — supprimer une exécution terminée.
- **XLSX / CSV / PDF** — télécharger les lignes enregistrées.

Utilisez le filtre **Carte** pour voir les exécutions d'une seule carte.

---

## 12. Paramètres

1. Cliquez sur **Paramètres** en bas du menu.
2. Choisissez une **Langue** : English, Português (Portugal), Français
   (France) ou Español (España).
3. Choisissez un **Thème** : **Clair**, **Sombre** ou **Contraste élevé**.
4. Cliquez sur **Enregistrer**.

L'écran change immédiatement pour que vous puissiez essayer chaque choix.
**Si vous ne cliquez pas sur Enregistrer, le changement est perdu** au
rechargement de la page.

Vos paramètres vous suivent sur tous les ordinateurs et navigateurs.

---

## 13. Problèmes et solutions

| Problème | Que faire |
|---------|-----------|
| Je ne trouve pas une carte | Regardez dans **Tous**. Si elle n'y est pas, demandez au propriétaire de la partager, ou demandez l'accès à votre administrateur. |
| **Exécuter** ne fait rien | Cherchez la fenêtre **Paramètres d'exécution** et renseignez les champs marqués d'un `*` rouge. |
| **Exécution non autorisée** | Demandez à votre administrateur l'accès aux données. |
| **Impossible de se connecter à la source de données** | Attendez et réessayez. Si cela persiste, prévenez votre administrateur. |
| Panneau orange | La carte ne peut pas donner un chiffre correct. Modifiez-la comme l'indique le panneau, ou demandez au propriétaire. |
| Aucune ligne | Vérifiez les filtres et les valeurs des paramètres. |
| La requête prend trop de temps | Utilisez des plages de dates plus courtes ou plus de filtres. |
| Aucun bouton d'exportation | Le résultat a expiré ou n'est pas complet. Cliquez sur **Exécuter à nouveau**. |
| Exportation **Échouée** | Exportez moins de lignes (ajoutez des filtres), ou essayez un autre format. |
| **Créer une carte** ou **Dupliquer** affiche une erreur | Demandez à votre administrateur le droit de créer des cartes dans ce domaine d'activité. |
| Je ne peux pas partager une carte | Vous ne pouvez partager que les cartes que vous avez créées. Demandez au propriétaire. |
| Ma langue ou mon thème est revenu en arrière | Vous n'avez pas cliqué sur **Enregistrer** dans **Paramètres**. |
| La planification ne s'est pas exécutée | Vérifiez qu'elle est **Activé** et regardez sa valeur **Planificateur**. |

### Ce qu'il faut dire à votre administrateur

Quand vous demandez de l'aide, indiquez :

- le nom de la carte,
- ce que vous avez cliqué,
- le message exact affiché à l'écran,
- la date et l'heure.
