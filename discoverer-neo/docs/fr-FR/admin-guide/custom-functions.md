# Fonctions personnalisées

Découvrez comment définir des fonctions SQL et PLSQL personnalisées à utiliser dans les champs calculés.

## Que sont les fonctions personnalisées ?

Les **fonctions personnalisées** vous permettent d'étendre Discoverer Neo avec une logique propre à votre métier :

- **Fonctions SQL** — Expressions simples (p. ex. `UPPER(name)`, `TRUNC(date)`)
- **Fonctions PLSQL** — Procédures stockées réutilisables sur Oracle

Les fonctions sont disponibles dans les champs calculés et les conditions des cartes.

## Créer une fonction personnalisée

### Étape 1 : Ajouter une fonction

1. Panneau d'administration → **Fonctions personnalisées**
2. Cliquez sur **+ Créer une fonction**
3. Saisissez :
   - **Nom** — Identifiant de la fonction (p. ex. `REVENUE_BAND`)
   - **Type** — SQL ou PLSQL
   - **Paramètres** — Paramètres d'entrée (voir ci-dessous)
   - **Type de retour** — VARCHAR, NUMBER, DATE, etc.
   - **Description** — Expliquez l'objet de la fonction

### Étape 2 : Définir le corps de la fonction

Pour les fonctions **SQL** :

```sql
CASE
  WHEN revenue > 100000 THEN 'Enterprise'
  WHEN revenue > 50000 THEN 'Mid-Market'
  ELSE 'SMB'
END
```

Pour les fonctions **PLSQL** (Oracle) :

```plsql
CREATE FUNCTION revenue_band(p_revenue NUMBER) RETURN VARCHAR2 IS
BEGIN
  IF p_revenue > 100000 THEN
    RETURN 'Enterprise';
  ELSIF p_revenue > 50000 THEN
    RETURN 'Mid-Market';
  ELSE
    RETURN 'SMB';
  END IF;
END;
/
```

### Étape 3 : Définir les paramètres

Les fonctions peuvent accepter des paramètres :

1. Cliquez sur **+ Ajouter un paramètre**
2. Saisissez :
   - **Nom** — Nom du paramètre (p. ex. `p_revenue`)
   - **Type de données** — NUMBER, VARCHAR, DATE, etc.
   - **Obligatoire** — Case à cocher

**Exemple de fonction avec paramètres :**
```sql
FUNCTION discount_rate(p_customer_type VARCHAR2, p_amount NUMBER)
RETURN NUMBER
BEGIN
  CASE p_customer_type
    WHEN 'GOLD' THEN RETURN 0.15
    WHEN 'SILVER' THEN RETURN 0.10
    ELSE RETURN 0.05
  END;
END;
```

### Étape 4 : Enregistrer la fonction

Cliquez sur **Créer**. La fonction est désormais disponible dans les champs calculés et les conditions.

## Utiliser les fonctions personnalisées

### Dans les champs calculés

Une fois définies, les fonctions apparaissent dans l'éditeur de formule des champs calculés :

1. Générateur de cartes → **Ajouter un champ calculé**
2. Saisissez le nom et la formule :
   ```sql
   revenue_band(ANNUAL_REVENUE)
   ```
3. La colonne calculée affiche le résultat de la fonction

### Dans les conditions

Utilisez des fonctions pour créer des filtres intelligents :

1. Générateur de cartes → **Ajouter une condition**
2. Utilisez la fonction dans la valeur :
   ```sql
   discount_rate(CUSTOMER_TYPE, ORDER_AMOUNT) > 0.10
   ```

## Fonctions SQL ou PLSQL

| Aspect | SQL | PLSQL |
|--------|-----|-------|
| **Complexité** | Expressions simples | Logique complexe |
| **Performance** | Rapide (analysée une fois) | Bonne (compilée) |
| **Débogage** | Facile (visible) | Plus difficile (boîte noire) |
| **Stockage** | Stockée dans la base Discoverer Neo | Créée sur la base Oracle |
| **Portabilité** | Fonctionne sur toute base de données | Oracle uniquement |

**Utilisez SQL pour :**
- Les transformations simples
- Les instructions CASE
- La manipulation de dates/chaînes
- La logique portable

**Utilisez PLSQL pour :**
- La logique métier complexe
- Les opérations de boucle
- Les fonctionnalités propres à Oracle
- Les fonctions appelant d'autres procédures stockées

## Exemples de fonctions

### Exemple 1 : calcul de trimestre (SQL)

```sql
CASE
  WHEN MONTH(sale_date) IN (1, 2, 3) THEN 'Q1'
  WHEN MONTH(sale_date) IN (4, 5, 6) THEN 'Q2'
  WHEN MONTH(sale_date) IN (7, 8, 9) THEN 'Q3'
  ELSE 'Q4'
END
```

**Utilisation :**
```sql
calculate_quarter(sale_date)  -- returns Q1, Q2, etc.
```

### Exemple 2 : classification par tranche d'âge (PLSQL)

```plsql
CREATE FUNCTION age_group(p_birth_date DATE) RETURN VARCHAR2 IS
  v_age NUMBER;
BEGIN
  v_age := TRUNC((SYSDATE - p_birth_date) / 365.25);
  CASE
    WHEN v_age < 18 THEN RETURN 'Minor';
    WHEN v_age < 30 THEN RETURN '18-29';
    WHEN v_age < 50 THEN RETURN '30-49';
    ELSE RETURN '50+';
  END CASE;
END;
/
```

### Exemple 3 : calcul de commission (SQL)

```sql
CASE
  WHEN sales_stage = 'Won' AND revenue > 1000000 THEN revenue * 0.12
  WHEN sales_stage = 'Won' AND revenue > 500000 THEN revenue * 0.10
  WHEN sales_stage = 'Won' THEN revenue * 0.08
  ELSE 0
END
```

## Modifier les fonctions

1. Panneau d'administration → **Fonctions personnalisées**
2. Cliquez sur la fonction → **Modifier**
3. Modifiez le nom, les paramètres ou le corps
4. Cliquez sur **Enregistrer**

**Remarque :** modifier les noms/types de paramètres peut casser les champs calculés existants. Procédez avec prudence.

## Supprimer des fonctions

1. Cliquez sur la fonction → **Supprimer**
2. Confirmez

Les champs calculés utilisant cette fonction échoueront. Retirez-les ou mettez-les à jour au préalable.

## Tester les fonctions

### Tester via un champ calculé

1. Créez une carte de test avec un champ calculé utilisant la fonction
2. Exécutez la carte
3. Vérifiez que la colonne calculée affiche les valeurs attendues

### Tester via une procédure PLSQL (Oracle)

Pour les fonctions PLSQL, testez directement dans Oracle :

```sql
-- Test function directly
SELECT revenue_band(75000) FROM DUAL;
-- Output: Mid-Market

SELECT revenue_band(150000) FROM DUAL;
-- Output: Enterprise
```

## Optimisation des performances

- **Indexez les colonnes de support** — Si une fonction filtre par colonne (p. ex. `revenue_band(annual_revenue)` utilisant ANNUAL_REVENUE), indexez-la
- **Simplifiez la logique** — Les instructions CASE imbriquées complexes sont plus lentes
- **Évitez les sous-requêtes** — N'utilisez pas de SELECT à l'intérieur des fonctions
- **Utilisez la clause DETERMINISTIC** (Oracle) :
  ```sql
  CREATE FUNCTION revenue_band(p_revenue NUMBER)
  RETURN VARCHAR2 DETERMINISTIC
  ...
  ```

## Autorisations PLSQL

Pour créer des fonctions PLSQL sur Oracle, l'utilisateur de base de données Discoverer Neo a besoin de :

```sql
GRANT CREATE PROCEDURE TO eul5_us;
GRANT CREATE FUNCTION TO eul5_us;
```

## Limites

- **Pas de fonctions externes** — Impossible d'appeler Python, Java, etc.
- **Valeur de retour unique** — Les fonctions renvoient une seule valeur, pas des jeux de résultats
- **Pas d'effets de bord** — Les fonctions ne doivent pas effectuer d'INSERT/UPDATE/DELETE (comportement indéfini)
- **Liaison des paramètres** — Les utilisateurs ne peuvent pas actuellement transmettre de valeurs de paramètres personnalisées aux fonctions ; les fonctions doivent référencer les champs de la carte

## Gestion des versions

Documentez les fonctions personnalisées :

1. Tenez un journal de la date de création et de l'auteur de chaque fonction
2. Maintenez des descriptions expliquant la logique métier
3. Notez si une fonction est utilisée dans plusieurs champs calculés
4. Planifiez la mise hors service avant de supprimer des fonctions

## Et ensuite ?

- **[Création de cartes](../user-guide/building-maps.md)** — Utiliser les fonctions dans les champs calculés
- **[Gestion des métadonnées](metadata-management.md)** — Organiser les fonctions avec les domaines d'activité

---

**Voir aussi :** [Guide de l'administrateur](../admin-guide/), [Référence de l'API - Fonctions personnalisées](../../api/endpoints.md)
