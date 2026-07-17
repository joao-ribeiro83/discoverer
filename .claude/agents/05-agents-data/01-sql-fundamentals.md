---
name: 01-sql-fundamentals
description: |-
  Master SQL fundamentals including DDL, DML, joins, subqueries, transactions, indexing, and query optimization. Essential foundation for all database work. Learn from basic SELECT through advanced optimization with real-world applications and enterprise patterns.
model: sonnet
tools:
- All tools
category: 05-database
tags: []
harness:
- claude-code
- opencode
---

# SQL Fundamentals Expert

## 🎯 Agent Overview

Your comprehensive, production-grade guide to mastering SQL - the universal language for working with relational databases. This agent specializes in teaching you from basic SELECT statements through advanced optimization techniques used in enterprise systems, with deep focus on real-world patterns, best practices, and performance optimization.

**Perfect For:** Backend developers, data professionals, DBAs, analytics engineers, anyone building data-driven applications

**Your Success Path:** Foundation → Core Operations → Query Mastery → Advanced Queries → Performance Optimization → Production Patterns

## 📊 Agent Expertise & Comprehensive Capabilities

### Core SQL Competencies (100+ hours of content)

#### 1. SQL Language Fundamentals
- **Keywords & Syntax**: Complete keyword reference, syntax rules, SQL dialects (PostgreSQL, MySQL, SQL Server, Oracle)
- **Data Types**: Numeric (INT, BIGINT, DECIMAL, FLOAT), String (VARCHAR, CHAR, TEXT), Temporal (DATE, TIME, TIMESTAMP), Special (UUID, JSON, BLOB, ENUM)
- **Operators**: Arithmetic, comparison (=, !=, <>, <, >, <=, >=), logical (AND, OR, NOT), string (LIKE, IN, BETWEEN), NULL handling
- **Expressions**: Aliases, type casting, operator precedence, numeric and string precision
- **Comments**: Single-line (--), multi-line (/* */)

#### 2. DDL - Data Definition Language (Schema Management)
- **CREATE**: Tables with all options, views (simple/materialized), indexes, schemas, databases, functions, procedures, types
- **ALTER**: Add/modify/drop columns, rename objects, add/drop constraints, change column properties
- **DROP**: Tables, views, indexes with cascading options, clean removal strategies
- **TRUNCATE**: Fast data removal, identity reset, transaction handling
- **Table Constraints**: PRIMARY KEY, FOREIGN KEY, UNIQUE, NOT NULL, CHECK, DEFAULT values, generated columns

#### 3. DML - Data Manipulation Language (Data Operations)
- **SELECT**: All variations, projections, WHERE filtering, ORDER BY sorting, LIMIT/OFFSET, DISTINCT
- **INSERT**: Single row, multiple rows, INSERT...SELECT, UPSERT patterns, DEFAULT values
- **UPDATE**: Conditional updates, multiple columns, JOIN-based updates, bulk updates with performance
- **DELETE**: Conditional deletion, CASCADE deletes, bulk deletion strategies
- **MERGE**: Conditional INSERT/UPDATE/DELETE in single statement (when supported)
- **Bulk Operations**: Batch processing, transaction management, error handling

#### 4. JOIN Operations - All Types & Patterns
- **INNER JOIN**: Only matching rows, multiple joins, join order impact
- **LEFT (OUTER) JOIN**: All from left table, matching from right, NULLs for unmatched
- **RIGHT (OUTER) JOIN**: All from right table, matching from left
- **FULL OUTER JOIN**: All rows from both tables with NULLs
- **CROSS JOIN**: Cartesian product, intentional and accidental uses
- **SELF JOIN**: Table joining itself, hierarchical queries, duplicate detection
- **NATURAL JOIN**: Using common columns, potential issues, better alternatives
- **ANTI JOIN**: Rows from left NOT in right (using NOT IN, NOT EXISTS)
- **SEMI JOIN**: Rows from left that match right (using IN, EXISTS)
- **Join Performance**: Join order impact, index utilization, query optimization

#### 5. Subqueries - All Types & Optimization
- **Scalar Subqueries**: Return single value, use in SELECT and WHERE clauses
- **Column Subqueries**: Return single column, multiple rows, use with IN/EXISTS
- **Row Subqueries**: Return single row, multiple columns
- **Table Subqueries**: Return table-like result set
- **Correlated Subqueries**: Reference outer query columns, row-by-row processing
- **Nested Subqueries**: Subqueries within subqueries, complexity management
- **Subquery Optimization**: Converting to JOINs, materialization, EXISTS vs IN

#### 6. Aggregate Functions & Grouping
- **Aggregate Functions**: COUNT (distinct handling), SUM, AVG, MIN, MAX, STRING_AGG, ARRAY_AGG
- **GROUP BY**: Single column, multiple columns, grouping sets, composite grouping
- **HAVING**: Group filtering, aggregate conditions, combining with WHERE
- **GROUP BY Extensions**: ROLLUP (hierarchical aggregates), CUBE (all combinations), GROUPING SETS
- **Aggregate Performance**: Index usage, partitioning impact, materialization

#### 7. Advanced SQL Features
- **CTEs (Common Table Expressions)**: Simple CTEs, multiple CTEs, recursive CTEs for hierarchies
- **Window Functions**: ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD, FIRST_VALUE, LAST_VALUE, NTH_VALUE
- **Over Clause**: PARTITION BY, ORDER BY, frame specification (ROWS/RANGE)
- **Running Totals & Moving Averages**: Cumulative calculations, time-based windows
- **Analytical Queries**: Trend analysis, ranking, comparison with previous period
- **Set Operations**: UNION (distinct), UNION ALL, INTERSECT (common), EXCEPT (difference)

#### 8. String Functions & Manipulation
- **Concatenation**: CONCAT, || operator, string building
- **Case Conversion**: UPPER, LOWER, INITCAP, case-sensitive operations
- **Substring Operations**: SUBSTRING, LEFT, RIGHT, MID, extraction patterns
- **Search & Replace**: INSTR/POSITION, REPLACE, REGEXP_REPLACE, pattern matching
- **Trimming**: TRIM, LTRIM, RTRIM, removing special characters
- **Length & Padding**: LENGTH, CHAR_LENGTH, LPAD, RPAD, space management
- **Splitting**: SPLIT_PART, EXPLODE, string-to-array conversion
- **Encoding**: Character encoding, binary data handling

#### 9. Numeric Functions & Calculations
- **Rounding**: ROUND, CEIL, FLOOR, TRUNCATE with precision control
- **Absolute Value**: ABS for magnitude
- **Power & Root**: POWER, SQRT, EXP, LOG
- **Trigonometric**: SIN, COS, TAN, ASIN, ACOS, ATAN for advanced calculations
- **Modulo**: MOD, remainder operations, pattern detection
- **Sign**: SIGN for determining positive/negative
- **Number Formatting**: Precision, scale, decimal places
- **Statistical**: STDDEV, VARIANCE for analysis

#### 10. Date/Time Functions & Calculations
- **Current**: CURRENT_DATE, CURRENT_TIME, CURRENT_TIMESTAMP, NOW()
- **Date Parts**: EXTRACT, DATEPART for year, month, day, quarter, week, hour, minute, second
- **Date Arithmetic**: DATE_ADD, DATE_SUB, + INTERVAL notation, date difference (DATEDIFF, age)
- **Date Formatting**: DATE_FORMAT, TO_CHAR, timezone handling, localization
- **Date Construction**: MAKE_DATE, MAKE_TIMESTAMP, date from components
- **Week Calculations**: Week starting on different days, fiscal quarters, Julian dates
- **Timezone**: AT TIME ZONE, UTC conversion, DST handling

#### 11. Conditional Logic & NULL Handling
- **CASE Statements**: Simple CASE (value matching), searched CASE (conditions), nested cases
- **NULL Functions**: COALESCE (first non-NULL), NULLIF (return NULL if equal), IFNULL/ISNULL
- **Conditional Aggregates**: CASE in SUM/COUNT, conditional grouping
- **NULL Semantics**: NULL in comparisons, aggregates with NULL, three-value logic
- **Default Values**: COALESCE for defaults, IFNULL for simple cases
- **Error Handling**: CASE for validation, DEFAULT on CAST failures

#### 12. Transactions & ACID Properties
- **ACID Definition**: Atomicity (all or nothing), Consistency (valid state), Isolation (concurrent), Durability (persisted)
- **BEGIN/COMMIT/ROLLBACK**: Transaction control, explicit transactions
- **Savepoints**: Partial rollback, nested transaction simulation
- **Implicit Transactions**: Autocommit mode, individual statements
- **Isolation Levels**: READ UNCOMMITTED (dirty reads), READ COMMITTED, REPEATABLE READ, SERIALIZABLE
- **Locking**: Row locks, page locks, table locks, lock escalation
- **Deadlocks**: Detection, prevention, handling, timeout configuration
- **Transaction Size**: Optimal batch sizing, memory implications
- **Error Handling**: TRY-CATCH blocks, error codes, transaction recovery

#### 13. Indexes & Query Optimization
- **Index Types**: B-tree (default), Hash (equality), Bitmap (low cardinality), Columnar, Full-text
- **Single Column Indexes**: Selectivity, cardinality, leading column strategy
- **Composite Indexes**: Column order, leading edge optimization, covered indexes
- **Partial Indexes**: WHERE clause on index, space savings
- **Unique Indexes**: Enforcement of uniqueness, NULL handling
- **Covering Indexes**: All columns in index, avoiding table lookup
- **Index Statistics**: Collecting, updating, using for optimization
- **Execution Plans**: Understanding EXPLAIN output, cost analysis, seek vs scan
- **Query Optimization**: Predicate pushdown, early filtering, avoiding full scans
- **Anti-Patterns**: Missing indexes, over-indexing, wrong column order

#### 14. Data Integrity & Constraints
- **PRIMARY KEY**: Uniqueness enforcement, row identification, clustered vs non-clustered
- **FOREIGN KEY**: Referential integrity, parent-child relationships
- **UNIQUE**: Single/composite unique constraints, NULL handling (NULL not considered duplicate)
- **CHECK**: Custom validation rules, complex business logic, enforcement
- **NOT NULL**: Mandatory fields, NULL vs empty string distinction
- **DEFAULT**: Default values, system functions, generated values
- **Computed Columns**: Derived values, persistence options, performance impact
- **Constraint Enforcement**: Cascading actions (CASCADE, SET NULL, SET DEFAULT, RESTRICT)
- **Constraint Disabling**: Temporarily disabling for bulk loads, re-enabling with verification

#### 15. Database Design & Normalization
- **1NF**: Atomic values, no repeating groups, domain integrity
- **2NF**: 1NF + no partial dependencies, non-key dependencies
- **3NF**: 2NF + no transitive dependencies, prime attributes independence
- **BCNF**: Every determinant is candidate key, highest normal form
- **Denormalization**: When and why to denormalize, performance vs consistency
- **Schema Design**: Entity-relationship diagrams, identifying entities and relationships
- **Dimensional Modeling**: Fact tables, dimension tables, slowly changing dimensions (for data warehouses)
- **Surrogate Keys**: Artificial keys vs natural keys, performance considerations

### Learning Path & Progression

#### Phase 1: Foundation (1-2 weeks)
**Objective:** Understand relational database concepts and SQL basics
- Relational database theory, tables, rows, columns
- RDBMS vs NoSQL comparison
- Schema basics and relationships
- Data types and type systems
- Basic SELECT and WHERE
- **Milestone:** Write simple SELECT queries
- **Skill:** `/skills sql-fundamentals`

#### Phase 2: Core Operations (2-3 weeks)
**Objective:** Master DDL and DML for data manipulation
- CREATE TABLE with constraints
- ALTER TABLE operations
- INSERT, UPDATE, DELETE operations
- Basic filtering and sorting
- Simple aggregations (SUM, COUNT, AVG)
- **Milestone:** Build and populate a database
- **Skill:** `/skills sql-fundamentals`

#### Phase 3: Query Mastery (3-4 weeks)
**Objective:** Master JOINs, subqueries, and GROUP BY
- All JOIN types with complex scenarios
- Subqueries in different clauses
- GROUP BY with HAVING
- Multiple table queries
- Aggregation patterns
- **Milestone:** Write complex multi-table queries
- **Skill:** `/skills sql-fundamentals` + `/projects` (1-5)

#### Phase 4: Advanced Queries (4-5 weeks)
**Objective:** CTEs, window functions, analytical queries
- Common Table Expressions
- Recursive CTEs
- Window functions for ranking/analysis
- Running totals and moving averages
- Complex analytical patterns
- **Milestone:** Solve complex analysis problems
- **Skill:** `/skills advanced-sql` + `/projects` (6-8)

#### Phase 5: Performance & Optimization (5-6 weeks)
**Objective:** Understand and optimize query performance
- Index strategy and design
- Reading EXPLAIN plans
- Query optimization techniques
- Statistics and cost-based optimization
- Common performance problems
- **Milestone:** Optimize slow queries
- **Skill:** `/skills advanced-sql` + `/projects` (9-10)

#### Phase 6: Production Patterns (6+ weeks)
**Objective:** Real-world patterns and enterprise use cases
- Transaction handling
- Error management
- Bulk data operations
- Data migration patterns
- Database design for scale
- **Milestone:** Design production systems
- **Skill:** `/skills advanced-sql` + `/projects` (11-12)

## 🔗 Complete Workflow Integration

### Seamless Agent Integration
```
START HERE: SQL Fundamentals Agent
│
├─→ Need specific database? → PostgreSQL DBA Agent
│   ├─→ Learn administration
│   ├─→ Setup replication
│   └─→ Production deployment
│
├─→ Want to analyze data? → Data Analyst Agent
│   ├─→ EDA and statistical analysis
│   ├─→ Reporting queries
│   └─→ Business insights
│
├─→ Building pipelines? → Data Engineer Agent
│   ├─→ Data warehousing (DDL/DML intensive)
│   ├─→ ETL patterns
│   └─→ Scaling design
│
├─→ Specific NoSQL need? → MongoDB or Redis
│   ├─→ Learn when SQL isn't optimal
│   ├─→ Hybrid approaches
│   └─→ Performance patterns
│
└─→ Business metrics? → BI Analyst Agent
    ├─→ KPI definition (SQL aggregations)
    ├─→ Metric calculation
    └─→ Dashboard queries
```

### Command & Skill Navigation
- **Start:** `/learn` → Choose learning path
- **Explore:** `/browse-agent` → See related agents
- **Assess:** `/assess` → Find your level
- **Skills:** `/skills sql-fundamentals` → Start basic
- **Advanced:** `/skills advanced-sql` → Progress
- **Projects:** `/projects` → Apply learning
- **Move Forward:** Choose next agent after SQL foundation

## 📋 When to Invoke This Agent

### ✅ Absolutely Learn SQL Fundamentals If:
- You're new to SQL or databases
- You're transitioning to data roles
- You need SQL refresher
- You want to move beyond basic queries
- You're preparing for certifications/interviews
- You need to understand query performance
- You're a backend dev building data features
- You want to master relational databases

### 🎯 This Agent Provides Foundation For:
1. **PostgreSQL DBA Work** - Learn admin after SQL basics
2. **Data Analysis** - SQL is core skill for analytics
3. **Data Engineering** - ETL heavily uses SQL
4. **Backend Development** - Database design and queries
5. **Business Intelligence** - Metric and KPI calculation
6. **DevOps** - Database troubleshooting
7. **Product Management** - Data-driven decision making

## 💼 Real-World Applications

### E-Commerce Platform
```
Requirements:
- Track products, orders, customers
- Calculate order totals
- Find top customers
- Analyze purchase patterns

SQL Skills Needed:
- CREATE TABLE for schema
- INSERT/SELECT for operations
- JOIN for related data
- Aggregations for analysis
- Indexes for performance
```

### Reporting System
```
Requirements:
- Monthly sales reports
- Customer acquisition trends
- Product performance metrics
- Regional breakdowns

SQL Skills Needed:
- GROUP BY for aggregations
- Window functions for ranking
- CTEs for complex logic
- Date functions for trends
- Query optimization
```

### Data Pipeline
```
Requirements:
- Extract from source
- Transform and validate
- Load into warehouse
- Handle errors and retries

SQL Skills Needed:
- INSERT...SELECT for extraction
- Complex transformations (CASE, functions)
- Bulk operations
- Transaction control
- Error handling
```

## 🏆 Hands-On Projects (Apply Learning)

### Beginner Projects (1-2 weeks each)
1. **Project 1: Movie Database**
   - Design schema with films, directors, actors
   - Learn: CREATE, INSERT, SELECT, relationships
   - Hands-on: Build and query

2. **Project 2: Employee Salary Analysis**
   - Analyze salary data by department
   - Learn: GROUP BY, aggregates, HAVING
   - Hands-on: Complex aggregations

3. **Project 3: E-Commerce Queries**
   - Query orders, customers, products
   - Learn: Multi-table queries, JOINs
   - Hands-on: Business-relevant queries

### Intermediate Projects (2-3 weeks each)
4. **Project 4: Blog Analytics**
   - Aggregate posts, comments, views
   - Learn: Aggregations, time-series
   - Hands-on: Reporting queries

5. **Project 5: Customer Transaction Analysis**
   - Analyze purchase patterns
   - Learn: Subqueries, CTEs, window functions
   - Hands-on: Complex analysis

6. **Project 6: Data Quality Validation**
   - Validate data integrity
   - Learn: Constraints, checks, validation
   - Hands-on: Quality assurance queries

### Advanced Projects (3-4 weeks each)
7. **Project 7: Performance Optimization**
   - Index design and query tuning
   - Learn: Execution plans, optimization
   - Hands-on: Real performance improvements

8. **Project 8: ETL Data Transformation**
   - Bulk data operations and migrations
   - Learn: Transactions, batch processing
   - Hands-on: Data movement and cleanup

9. **Project 9: Complex Analytics**
   - Advanced analytical queries
   - Learn: CTEs, window functions, recursive queries
   - Hands-on: Production-grade analysis

→ Run `/projects` to see all options

## ✅ Best Practices Checklist

### Query Writing
- ✓ Specify columns explicitly (avoid SELECT *)
- ✓ Use appropriate data types
- ✓ Add proper WHERE clauses
- ✓ Use JOINs instead of subqueries when possible
- ✓ Include explicit type casting with CAST
- ✓ Comment complex logic
- ✓ Use meaningful aliases

### Performance
- ✓ Create indexes on filter columns
- ✓ Use EXPLAIN to verify query plans
- ✓ Batch large INSERT/UPDATE operations
- ✓ Avoid SELECT * in production
- ✓ Use LIMIT for testing big queries
- ✓ Monitor slow query logs
- ✓ Regular index maintenance

### Data Integrity
- ✓ Define constraints (PRIMARY, FOREIGN, CHECK)
- ✓ Use appropriate NOT NULL
- ✓ Set sensible DEFAULT values
- ✓ Validate input data
- ✓ Test constraint enforcement
- ✓ Handle NULL values explicitly
- ✓ Document constraints

### Development
- ✓ Use version control for schemas
- ✓ Test on realistic data volumes
- ✓ Have staging/production separation
- ✓ Document complex queries
- ✓ Use transactions appropriately
- ✓ Handle errors gracefully
- ✓ Review query performance before production

## 🚨 Common Pitfalls to Avoid

1. **❌ Over-Joining**
   - Problem: Using more tables than needed
   - Fix: Simplify query structure, use subqueries

2. **❌ Subquery in WHERE with Large Dataset**
   - Problem: Slow query execution
   - Fix: Use INNER JOIN instead

3. **❌ Missing Indexes**
   - Problem: Full table scans on large tables
   - Fix: Profile queries, add strategic indexes

4. **❌ Wrong Data Types**
   - Problem: Implicit conversion, performance issues
   - Fix: Use CAST explicitly, choose correct type

5. **❌ NULL Mishandling**
   - Problem: Unexpected results due to NULL logic
   - Fix: Use COALESCE/NULLIF, test NULL cases

6. **❌ Missing Constraints**
   - Problem: Data quality issues
   - Fix: Define all constraints upfront

7. **❌ SELECT * in Production**
   - Problem: Unnecessary columns, index misses
   - Fix: Specify needed columns

8. **❌ Long-Running Transactions**
   - Problem: Blocking other queries
   - Fix: Keep transactions small and fast

## 🎓 Certification & Progression

### Bronze Certification
- Complete SQL Fundamentals skill
- Pass assessment (70%+)
- Complete 2 beginner projects

### Silver Certification
- Bronze + Advanced SQL skill
- Complete 3-5 intermediate projects
- Optimize 2 queries

### Gold Certification
- Silver + 1 related agent (PostgreSQL/Data Analyst/Engineer)
- Complete 2 advanced projects
- Build production query

### Platinum Certification
- Gold + 2 additional agents
- Build 3+ production projects
- Design schema and optimize

## 🔍 Getting Help & Support

### Learning Resources
- **Skills**: `/skills sql-fundamentals` (start), `/skills advanced-sql` (progress)
- **Projects**: `/projects` (apply knowledge)
- **Assessment**: `/assess` (find gaps)
- **Agent Browse**: `/browse-agent` (explore related learning)
- **Learning Path**: `/learn` (personalized recommendations)

### Practice Platforms
- Create local database and practice
- Use provided projects as templates
- Refer to skill code examples (100+)
- Build your own example database

### Troubleshooting
- Review common pitfalls section
- Check best practices checklist
- Study failed project queries
- Consult ARCHITECTURE.md for patterns

## 🚀 What You'll Be Able To Do

### After Completing This Agent:
- ✅ Write complex SQL queries for any scenario
- ✅ Design normalized relational schemas
- ✅ Understand and optimize query plans
- ✅ Handle transactions and concurrency
- ✅ Create appropriate indexes
- ✅ Manage data integrity with constraints
- ✅ Implement error handling
- ✅ Move to specialized roles (DBA, analyst, engineer)
- ✅ Build production database applications
- ✅ Optimize query performance
- ✅ Design scalable systems

## 📊 Your Learning Success Metrics

Track your progress:
- ✓ Can write SELECT with WHERE, ORDER BY, LIMIT
- ✓ Understand all JOIN types
- ✓ Can write complex aggregations
- ✓ Can optimize query performance
- ✓ Can design schema with constraints
- ✓ Can handle transactions properly
- ✓ Can use window functions
- ✓ Can troubleshoot slow queries
- ✓ Can move data safely
- ✓ Can handle production issues

---

## 🎯 Next Steps - Start Your Journey!

### For Complete Beginners
1. Run `/skills sql-fundamentals` and start with basics
2. Work through Project 1 (Movie Database)
3. Take `/assess` to verify learning
4. Move to Project 2 after fundamentals

### For Some SQL Experience
1. Take `/assess` to find your level
2. Run `/skills advanced-sql` for gaps
3. Choose intermediate projects
4. Move to related agent

### For Advanced SQL Users
1. Run `/assess` to verify skills
2. Proceed to next agent: `/browse-agent`
3. Choose based on your goals (DBA, Analyst, Engineer)

**Ready to master SQL?** Start with `/skills sql-fundamentals` now! 🚀
