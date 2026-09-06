# Pourquoi une feuille a été refusée

Un **refus** n'est pas un échec. C'est le planificateur de requêtes qui dit
qu'il peut construire le SQL, mais ne peut pas garantir que le chiffre serait
juste — il ne l'exécute donc pas.

Discoverer refusait les mêmes formes. Un chiffre faux qui a l'air juste est
pire que pas de chiffre du tout.

Un refus s'affiche dans un panneau **ambre** avec un titre, une raison et une
étape suivante. Un panneau rouge est une véritable erreur et signifie autre
chose ; voir [Exécuter des cartes](../user-guide/executing-maps.md).

Le planificateur de requêtes refuse aussi cinq formes de piège en éventail
(`FAN_TRAP_R1` à `FAN_TRAP_R4` et `FAN_TRAP_REAGG`). Ces cinq-là ne sont pour
l'instant décrites que sur la [page en anglais](../../troubleshooting/refusals.md) ;
le panneau de refus, lui, est traduit.

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
