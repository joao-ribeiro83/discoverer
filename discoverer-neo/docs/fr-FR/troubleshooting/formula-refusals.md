# Pourquoi un calcul a été refusé

Une feuille peut s'exécuter alors qu'un de ses calculs ne le peut pas. Cette
page concerne ce deuxième type de refus : une formule unique qui provenait de
Discoverer et n'a pas pu être compilée.

Pour une feuille entière qui n'a pas été exécutée, voir
[Pourquoi une feuille a été refusée](refusals.md).

Un calcul Discoverer n'a pas été stocké en tant que texte. Il a été stocké
sous forme d'arbre de jetons numérotés, et Neo convertit cet arbre en SQL.
Lorsque l'arbre dit quelque chose que Neo ne peut pas lire avec confiance, le
calcul est **refusé avec une raison** plutôt que compilé en équivalent proche.

Cette règle mérite d'être énoncée clairement, car c'est la raison pour laquelle
cette liste existe :

> Un calcul refusé est une lacune visible. Un calcul compilé incorrectement est
> un nombre erroné dans un rapport auquel les gens font confiance depuis quinze
> ans.

Les propres outils de migration de Discoverer ont adopté la même position.
`NOT IN` n'a jamais été compilé en `IN`, car cela inverse le filtre et produit
un nombre qui semble tout à fait raisonnable et qui est faux.

---

## Les raisons

Chaque refus porte l'une de ces raisons. Elles sont énumérées par probabilité
décroissante.

### `UNFITTED_CODE`

**Signification.** La formule utilise une fonction intégrée Discoverer dont la
forme exacte n'a pas pu être établie à partir des preuves.

Neo n'a pas deviné comment ces fonctions se rendent. Chaque fonction intégrée
qu'il compile a été ajustée par rapport à 37 971 paires de formules réelles
provenant de vos propres classeurs — l'arbre de jetons stocké à côté de la
chaîne que Discoverer lui-même a placée à l'écran. Une fonction qui n'a jamais
figuré dans une paire que Neo pouvait lire est refusée plutôt qu'hypothéquée.

**Quelles fonctions.** `CASE`, `WHEN`, `ELSE`, `IS NULL`, `IS NOT NULL`,
`UPPER`, `GREATEST` et la famille analytique (`FIRST_VALUE`, `OVER`,
`PARTITION`, `ORDER`, `ROW_NUMBER`, `NPASSORDERCOMP`).

**À faire.** Réécrivez le calcul dans l'éditeur de formules de Neo. Un `CASE`
peut généralement être écrit avec `DECODE`, qui est compilé.

### `UNRESOLVED_FUNCTION`

**Signification.** La formule appelle une fonction PL/SQL enregistrée, et aucune
fonction correspondante n'existe dans Neo.

**À faire.** Enregistrez-la sous **Admin → Fonctions personnalisées**, en
correspondant avec le nom que Discoverer a utilisé. Voir
[Fonctions personnalisées](../admin-guide/custom-functions.md).

### `UNRESOLVED_ELEMENT`

**Signification.** La formule fait référence à une colonne ou un paramètre que
le classeur ne contient plus. La référence a survécu ; la chose vers laquelle
elle pointait ne l'a pas.

**À faire.** Ouvrez le calcul et réorientez-le vers une colonne active. C'est
généralement un classeur Discoverer qui a été modifié après la suppression de
la colonne.

### `INVALID_IDENTIFIER`

**Signification.** Un nom de colonne, nom de paramètre ou nom de fonction qui a
atteint la formule n'est pas un identificateur Oracle valide.

Neo refuse ces éléments plutôt que de les mettre entre guillemets pour la
sécurité. Un nom portant un guillemet, un point-virgule ou un crochet est soit
un défaut de métadonnées, soit une tentative d'injection SQL, et le mettre
entre guillemets cacherait les deux.

**À faire.** Corrigez le nom dans **Admin → Métadonnées**. Un nom de fonction
qualifié par un paquet (`PKG.CALC`) se retrouve également ici : enregistrez un
wrapper à un seul nom.

### `BAD_ARITY`

**Signification.** Le nombre d'arguments ne correspond à rien de ce que Neo a
pour preuve — pour une fonction intégrée, toute forme vue dans votre domaine ;
pour une fonction enregistrée, les **Paramètres** que vous avez définis pour
elle.

**À faire.** Pour une fonction enregistrée, vérifiez que sa liste de paramètres
est correcte. Pour une fonction intégrée, la formule est probablement endommagée
et devrait être réécrite.

### `UNREAGGREGABLE`

**Signification.** Le calcul contient une agrégation qui ne peut pas être
correctement retotalisée sur une jointure — `AVG`, `COUNT DISTINCT`, `STDDEV`
ou `VARIANCE`.

Neo réécrit certaines requêtes pour éviter les doublons. Ces quatre ne peuvent
pas survivre à cette réécriture : une moyenne de moyennes n'est pas la moyenne.

**À faire.** Déplacez l'agrégation vers la feuille, ou limitez la feuille à une
seule carpette pour qu'aucune réécriture ne soit nécessaire. La même raison sur
une feuille entière est couverte dans [refusals.md](refusals.md).

### `DATE_WITH_TIME`

**Signification.** Une date stockée porte une heure, et Neo ne l'abandonnera pas
silencieusement.

Les dates dans Discoverer sont stockées avec six chiffres de fin pour l'heure.
Chacune des 7 670 dates de ce domaine les a mises à zéro, donc Neo compile la
date et sait qu'il n'a rien perdu. Une date qui portait réellement une heure
serait une valeur différente, et la tronquer changerait un résultat
silencieusement.

**À faire.** Signalez-le. Cela n'a pas été observé en pratique et Neo aimerait
voir le classeur.

### `UNKNOWN_SEMANTICS`

**Signification.** Le calcul utilise une fonctionnalité Discoverer dont le
résultat n'est pas visible dans ce que Discoverer a affiché, donc il n'y a rien
d'où dériver le SQL.

En pratique, c'est une chose : `2_Pass_Percentage`. Discoverer l'a montré comme
son seul argument, donc rien dans les preuves ne dit ce qu'il a réellement
calculé.

**À faire.** Réécrivez-le comme un calcul de pourcentage explicite.

### `UNKNOWN_NODE`, `UNKNOWN_LITERAL_KIND`, `PARSE_FAILED`

**Signification.** La formule stockée n'est pas quelque chose que Neo peut lire
du tout.

**À faire.** Signalez-le avec le nom du classeur. Ces éléments indiquent soit
une fonctionnalité Discoverer que personne n'a encore rencontrée, soit un
classeur endommagé, et Neo ne peut pas faire la différence sans regarder.

### `NOT_IN_ALLOWLIST`

**Signification.** La formule générerait une fonction SQL qui ne figure pas sur
la liste des fonctions que Neo émettra.

**À faire.** Signalez-le. Seul un petit ensemble fixe de fonctions Oracle peut
être généré, et atteindre cette raison signifie qu'une fonction intégrée a été
mappée à quelque chose hors de lui — ce qui est un défaut dans Neo, pas dans
vos métadonnées.

### `CALCULATION_CYCLE`

**Signification.** Le calcul fait référence à un autre calcul qui se réfère à
nouveau à lui, directement ou par le biais d'une chaîne. Il n'y a pas de valeur
à calculer.

Discoverer permet à un calcul d'en utiliser un autre par nom, et Neo substitue
la chaîne entière plutôt que le nom. Une boucle n'a pas de bas, elle est donc
refusée avec la chaîne nommée plutôt qu'expansée jusqu'à ce que quelque chose
casse.

**À faire.** Ouvrez le calcul dans l'éditeur de formules de Neo et cassez la
boucle. Le refus nomme chaque calcul sur l'anneau.

### `EXPANSION_TOO_DEEP`, `EXPANSION_TOO_LARGE`

**Signification.** La chaîne de calculs faisant référence à des calculs est
plus longue que 16 maillons, ou s'expanse à plus de 20 000 nœuds.

Le deuxième est celui qui se produit réellement : une chaîne qui n'est pas une
chaîne mais un diamant, où plusieurs calculs partagent un parent, multiplie au
lieu d'additionner.

**À faire.** Aplatissez la chaîne. Un calcul utilisé par plusieurs autres peut
généralement être écrit une fois en tant qu'élément de carpette à la place, qui
est calculé une fois plutôt que substitué partout.

### `NO_SOURCE_TOKENS`

**Signification.** Neo a le texte lisible de la formule mais pas l'arbre de
jetons dont il provient, donc il n'y a rien à compiler.

Ce n'est **pas** une lacune dans ce que Neo comprend. Cela se produit lorsque
le domaine a été migré par une version de l'outil qui n'a pas conservé la forme
de jetons, et cela affecte chaque calcul d'un tel domaine de la même manière.

**À faire.** Réimportez les cartes. Cela écrit la forme de jetons à côté de
chaque formule et les calculs se compilent normalement. Rien d'autre ne le
change.

### `TOKENS_NOT_RETAINED`

**Signification.** La même situation que `NO_SOURCE_TOKENS`, signalée par la
vérification précédente basée sur le texte : la formule stockée contient toujours
visiblement des jetons de style `[1,102]` et l'arbre derrière eux n'a pas été
conservé.

**À faire.** Réimportez les cartes.

---

## Ce qu'un refus ne signifie pas

- **Ce n'est pas une erreur de données.** Rien n'est incorrect dans vos données.
- **Il ne cache pas l'original.** La forme de jeton Discoverer stockée est
  conservée à côté de la forme compilée, donc un calcul refusé aujourd'hui se
  compile le jour où la lacune est comblée, sans réexécuter la migration.
- **Il n'arrête pas la feuille.** Les autres colonnes s'exécutent toujours.

---

**Voir aussi :** [Pourquoi une feuille a été refusée](refusals.md),
[Fonctions personnalisées](../admin-guide/custom-functions.md)
