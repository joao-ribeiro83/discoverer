# Pourquoi une feuille a été refusée

Un **refus** n'est pas un échec. C'est le planificateur de requêtes qui dit
qu'il peut construire le SQL, mais ne peut pas garantir que le chiffre serait
juste — il ne l'exécute donc pas.

Discoverer refusait les mêmes formes. Un chiffre faux qui a l'air juste est
pire que pas de chiffre du tout.

Un refus s'affiche dans un panneau **ambre** avec un titre, une raison et une
étape suivante. Un panneau rouge est une véritable erreur et signifie autre
chose ; voir [Exécuter des cartes](../user-guide/executing-maps.md).

La phase 3.3 étendra cette page à mesure que le planificateur de requêtes
gagnera de nouveaux contrôles.

---

## Ce total n'est pas encore fiable, il n'a donc pas été exécuté

**Code :** `MULTI_FOLDER_AGGREGATE`

### Ce qui a été demandé

La feuille totalise une valeur — `SUM`, `AVG`, `COUNT`, `COUNT DISTINCT` — sur
des colonnes provenant de plusieurs dossiers.

### Pourquoi cela ne peut pas recevoir de réponse

Les dossiers sont joints en un-à-plusieurs. Chaque ligne du côté « un » est
répétée une fois par ligne correspondante du côté « plusieurs ». Additionner
après cette jointure compte la même valeur une fois par répétition : le total
ressort trop élevé.

C'est ce qu'on appelle un **piège en éventail** (fan trap). L'exemple d'Oracle
lui-même chiffre l'inflation à deux ou trois fois, sur deux mesures à la fois.
Rien à l'écran ne vous dirait que le chiffre est faux.

### Quoi changer

- Totalisez une valeur d'**un seul dossier**. Retirez les colonnes qui puisent
  dans le second dossier, ou supprimez le total.
- Ou scindez la feuille en deux, une par dossier.
- Ou conservez les lignes de détail et totalisez-les en dehors du produit.

Les totaux multi-dossiers seront disponibles avec le planificateur de fan-trap
(phase 3.4). Rien dans votre feuille n'aura à changer : la même feuille se
mettra simplement à renvoyer un chiffre correct.

---

## Ces dossiers ne sont pas reliés, la feuille n'a donc pas été exécutée

**Code :** `NO_JOIN_PATH`

### Ce qui a été demandé

La feuille utilise des colonnes de deux dossiers ou plus, qu'aucune chaîne de
jointures ne relie.

### Pourquoi cela ne peut pas recevoir de réponse

Sans jointure, la base de données n'a aucune règle pour apparier les lignes.
Elle associerait chaque ligne d'un dossier à chaque ligne de l'autre — une
**jointure croisée** — et renverrait un nombre de lignes égal au produit des
deux, dénué de sens.

### Quoi changer

- Retirez les colonnes du dossier non relié. Le panneau nomme les dossiers
  concernés.
- Ou demandez à un administrateur de définir une jointure entre eux, sous
  **Modélisation des données → Jointures**.

Un administrateur peut vérifier si la jointure existe mais n'a pas été migrée :
certaines jointures Discoverer ne survivent pas à un import EUL si leurs deux
dossiers n'étaient pas tous les deux dans le périmètre.
