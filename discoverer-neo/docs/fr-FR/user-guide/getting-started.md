# Prise en main de Discoverer Neo

Découvrez comment vous connecter et naviguer dans l'interface de Discoverer Neo.

## Accéder à Discoverer Neo

1. Ouvrez votre navigateur et accédez à l'URL de Discoverer Neo (p. ex. `http://localhost:5173` en environnement de développement)
2. L'écran de connexion doit s'afficher

## Se connecter

**Écran de connexion :**
- **E-mail :** votre adresse e-mail
- **Mot de passe :** votre mot de passe (fourni par votre administrateur)

Saisissez vos identifiants, puis cliquez sur **Se connecter**.

**Première visite ?** Contactez votre administrateur pour faire créer un compte.

## Première connexion avec un mot de passe temporaire

Si votre compte provient d'Oracle Discoverer, votre administrateur vous remettra
un **mot de passe temporaire**. C'est une chaîne aléatoire de 16 caractères, par
exemple `ufNnRksjgR7U%M6X`.

1. Connectez-vous avec votre adresse e-mail et le mot de passe temporaire.
2. Vous arrivez directement sur **Changer votre mot de passe** — cette étape ne
   peut pas être ignorée. Tant que vous n'avez pas choisi de mot de passe, le
   reste de l'application est indisponible.
3. Saisissez à nouveau le mot de passe temporaire, puis votre nouveau mot de
   passe deux fois.
4. Vous arrivez sur le tableau de bord et le mot de passe temporaire cesse
   immédiatement de fonctionner.

Votre nouveau mot de passe doit comporter **au moins 12 caractères** et être
différent du temporaire.

> **Astuce :** le mot de passe temporaire évite délibérément les caractères
> faciles à confondre — ni `O` majuscule ni zéro, ni `l` minuscule ni un. Si un
> caractère vous paraît ambigu, ce n'est aucun de ceux-là.

Si vous saisissez mal le mot de passe temporaire, l'écran vous le signale et rien
n'est modifié ; demandez à votre administrateur de le réinitialiser si vous
l'avez perdu.

## Interface principale

Une fois connecté, le tableau de bord principal s'affiche avec les sections suivantes :

### Navigation

**Barre latérale gauche :**
- **Tableau de bord** — Vue d'ensemble et actions rapides
- **Domaines d'activité** — Collections de données organisées
- **Cartes** — Toutes les cartes accessibles : les vôtres, les partagées avec vous,
  ou (selon vos permissions) l'ensemble du domaine
- **Paramètres** — Personnaliser les préférences de langue et de thème
- **Admin** (si vous disposez de privilèges d'administrateur) — Gestion du système

### Tableau de bord

Le tableau de bord affiche :
- **Nombre total de cartes** — Toutes les cartes que vous pouvez voir (les vôtres et celles partagées avec vous)
- **Nombre total d'exécutions** — Le nombre de fois où vous avez exécuté une requête, sur toutes les cartes que vous pouvez voir
- **Cartes planifiées** — Le nombre de vos planifications actives
- **Résultats planifiés** — Le nombre de résultats produits par vos planifications
- **Cartes récentes** — Vos 5 dernières cartes mises à jour, si vous en possédez

## Explorer les domaines d'activité

Un **domaine d'activité** est un regroupement logique de données et de requêtes associées.

1. Cliquez sur **Domaines d'activité** dans la barre latérale
2. La liste des domaines auxquels vous avez accès s'affiche
3. Cliquez sur un domaine d'activité pour explorer son contenu :
   - **Dossiers** — Tables/vues disponibles dans ce domaine
   - **Éléments** — Colonnes/champs au sein des dossiers
   - **Jointures** — Relations entre les dossiers
   - **Cartes existantes** — Requêtes déjà créées pour ce domaine

## Vos cartes

### Consulter vos cartes

1. Cliquez sur **Cartes** dans la barre latérale
2. Trois onglets vous permettent de changer le périmètre :
   - **Mienne** — Cartes que vous avez créées
   - **Partagée avec moi** — Cartes que d'autres ont explicitement partagées
     avec vous
   - **Toutes** — Toutes les cartes que vous êtes autorisé à voir, y compris
     celles migrées de Discoverer que personne n'a partagées ou réassignées
3. Recherchez par nom, filtrez par domaine d'activité et triez par nom ou par
   la dernière mise à jour d'une carte
4. Cliquez sur **Créer une carte** pour en commencer une nouvelle

### Créer une carte

Consultez [Création de cartes](building-maps.md).

### Consulter les détails d'une carte

Cliquez sur une carte pour afficher :
- La définition de la carte (éléments sélectionnés, filtres, paramètres)
- L'historique d'exécution
- Les autorisations de partage

## Naviguer dans l'aide

- **Survolez les icônes** pour afficher les info-bulles
- **Repérez les icônes « ? »** pour obtenir une aide propre à chaque champ
- **Consultez les messages d'erreur en ligne** pour le retour de validation

## Et ensuite ?

- **[Paramètres](settings.md)** — Personnaliser la langue et le thème
- **[Création de cartes](building-maps.md)** — Créer votre première requête
- **[Exécution de cartes](executing-maps.md)** — Exécuter des cartes et consulter les résultats
- **[Exportation de données](exporting-data.md)** — Télécharger les résultats au format Excel ou CSV
- **[Planification de cartes](scheduling.md)** — Automatiser la génération de rapports

---

**Voir aussi :** [Guide de l'utilisateur](../user-guide/), [Référence de l'API](../../api/endpoints.md)
