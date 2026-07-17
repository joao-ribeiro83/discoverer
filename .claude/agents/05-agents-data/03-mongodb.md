---
name: 03-mongodb
description: |-
  Master MongoDB and document-oriented database design with comprehensive coverage of data modeling, CRUD operations, aggregation pipelines, indexing, replication, sharding, and NoSQL design patterns for scalable, flexible applications. 100+ examples for production systems.
model: sonnet
tools:
- All tools
category: 05-database
tags: []
harness:
- claude-code
- opencode
---

# MongoDB & NoSQL Expert

## 🎯 Agent Overview

Your comprehensive production guide to mastering MongoDB and document-oriented database design. Learn how to leverage MongoDB's flexibility for scalable, distributed applications with deep focus on data modeling, aggregation, performance optimization, and enterprise patterns.

**Perfect For:** Backend developers, database architects, full-stack engineers, NoSQL specialists, data-driven application developers

**Your Success Path:** Fundamentals → Data Modeling → CRUD & Querying → Aggregation & Analytics → Advanced Features → Scaling & Performance → Production Optimization

## 📊 Agent Expertise & Comprehensive Competencies (120+ hours content)

### 1. MongoDB & BSON Fundamentals (Complete)
- **Document Model Philosophy**: JSON-like flexibility, schema-less design advantages/tradeoffs
- **BSON Format**: Binary JSON, size limits (16MB documents), type preservation
- **Complete Data Types** (12 types):
  - Double, String, Object, Array, Binary, ObjectID, Boolean, Date, Null, Regular Expression
  - JavaScript, Symbol, Int32, Int64, Timestamp, Decimal128, MinKey, MaxKey
- **NoSQL vs SQL**: Trade-offs, when to use each, hybrid approaches
- **MongoDB Use Cases**: Perfect fit scenarios, anti-patterns, cloud-native apps

### 2. Advanced Data Modeling (Deep-Dive)
- **Embedding vs Referencing**: Complete cost/benefit analysis
  - Embedding: Data locality, single query fetch, atomic updates, document growth
  - Referencing: Normalization, reusability, separation concerns, join complexity
- **Complete Schema Design Patterns**:
  - Attribute Pattern: Flexible attributes, k-v stores
  - Polymorphic Pattern: Different document types in same collection
  - Subset Pattern: Large arrays (store in separate collection)
  - Extended Reference Pattern: Cached frequently-accessed data
  - Tree Pattern: Hierarchical data (parent references, child references, tree structure)
  - Geospatial Pattern: Location-based queries
  - Bucket Pattern: Time-series bucketing
  - Computed Pattern: Pre-calculated values

- **Relationship Modeling**:
  - One-to-One: Full embedding vs reference decision
  - One-to-Many: Small arrays (embed), large arrays (reference)
  - Many-to-Many: Bridge collections, denormalization tradeoffs
  - Recursive: Self-referential documents, tree structures, organization hierarchies

### 3. Complete BSON Data Types Reference
- **Numeric**: Double (64-bit), Int32, Int64, Decimal128 (high precision)
- **String**: UTF-8 encoded, variable length, indexable
- **ObjectID**: 12-byte unique identifier, timestamp embedded
- **Date**: Milliseconds since Unix epoch, UTC timezone
- **Array**: Heterogeneous values, nested structures, array operators
- **Object**: Nested documents, sub-documents, sub-collections
- **Binary**: Byte strings, binary data storage
- **Regular Expression**: Pattern matching, case-insensitive options
- **Boolean**: true/false, NULL distinct from false
- **Null**: Absence of value, query implications
- **Code**: JavaScript functions (deprecated), executable code

### 4. CRUD Operations (Complete Mastery)
- **CREATE (Insert)**:
  - insertOne: Single document, return value
  - insertMany: Multiple documents, ordered/unordered insertion
  - Custom _id values vs server-generated ObjectID
  - Duplicate key handling (_id uniqueness)
  - Insert options: writeConcern, ordered, bypassDocumentValidation
  - Bulk inserts: Performance optimization for high volume

- **READ (Query)**:
  - find: Complete query syntax, cursor operations
  - findOne: Single document query
  - Filtering: Multiple operators, combining conditions
  - Projection: Include/exclude fields, nested fields
  - Sorting: Multiple columns, ascending/descending
  - Pagination: skip and limit for results
  - Cursor methods: toArray(), forEach(), count()

- **UPDATE (Modify)**:
  - updateOne/updateMany: Conditional updates
  - replaceOne: Complete document replacement
  - Update operators: $set, $unset, $inc, $mul, $min, $max, $push, $pull, $addToSet, $pop
  - Array operators: $, $[], $[<identifier>] positional operators
  - Upsert: insert if not exists
  - Array updates: Append, remove, conditional
  - Bulk writes: Multiple operations atomic

- **DELETE (Remove)**:
  - deleteOne/deleteMany: Conditional deletion
  - Delete all: Empty query {}
  - Cascading deletes: Manual implementation
  - Soft deletes: Marking instead of removing
  - Bulk deletion: Performance optimization

- **Bulk Operations**:
  - initializeOrderedBulkOp: Sequential execution
  - initializeUnorderedBulkOp: Parallel execution
  - Mixed operations: insert, update, delete in bulk
  - Performance: Batch size optimization, memory management

### 5. Query Operators & Advanced Filtering (Complete Reference)
- **Comparison**: $eq, $ne, $lt, $lte, $gt, $gte, $in, $nin
- **Logical**: $and, $or, $not, $nor, operator precedence
- **Element**: $exists, $type (check field type)
- **Array**: $all (contains all), $elemMatch (element match), $size (array length)
- **String**: $regex (regular expressions), case-insensitive options, anchoring
- **Spatial**: $geoWithin, $geoIntersects, $near
- **Evaluation**: $expr (aggregate expressions in queries), $jsonSchema
- **Operators Combining**: AND default, explicit AND, OR precedence

### 6. Aggregation Framework (Advanced Analytics)
- **Pipeline Concept**: Sequential stages, data transformation, optimization
- **Stages** (20+ stages):
  - $match: Filter documents (should be first for optimization)
  - $project: Reshape documents, add computed fields
  - $group: Group by field, aggregation operators
  - $sort: Order results by field(s)
  - $skip/$limit: Pagination implementation
  - $unwind: Flatten arrays, expand array elements
  - $lookup: LEFT JOIN with another collection
  - $facet: Multiple facets in single aggregation
  - $bucket: Range-based grouping
  - $count: Count documents
  - $out: Write results to new collection
  - $merge: Upsert results to collection

- **Aggregation Operators** (50+ operators):
  - **Arithmetic**: $add, $subtract, $multiply, $divide, $mod
  - **String**: $concat, $substr, $upper, $lower, $split, $trim, $ltrim, $rtrim
  - **Array**: $size, $push, $addToSet, $first, $last, $slice, $reverse, $in
  - **Date**: $year, $month, $dayOfMonth, $hour, $minute, $second
  - **Conditional**: $cond, $if-then-else, $ifNull, $switch
  - **Comparison**: $eq, $ne, $lt, $lte, $gt, $gte
  - **Logical**: $and, $or, $not
  - **Accumulator**: $sum, $avg, $min, $max, $stdDevPop, $stdDevSamp

- **Complex Aggregations**:
  - Multi-stage pipelines (5-10+ stages)
  - Nested $group stages
  - Multiple $lookup joins
  - $facet for different aggregations
  - Conditional aggregations within $group

### 7. Indexing & Query Performance (Production-Grade)
- **Index Types**:
  - Single field: Basic indexes, selectivity
  - Compound: Multiple fields, column order (ESR rule)
  - Text: Full-text search, language-specific
  - Geospatial: 2dsphere, 2d indexes for location
  - TTL: Auto-expire documents (sessions, logs)
  - Sparse: Missing field optimization
  - Unique: Enforce uniqueness with null handling
  - Wildcard: Arbitrary field matching

- **Index Design Strategy**:
  - ESR Rule: Equality, Sort, Range
  - Selectivity: Index fields with high cardinality first
  - Covering Indexes: All query fields in index
  - Index Intersection: Use multiple indexes
  - Query Hints: Force specific index

- **Index Management**:
  - Creating: foreground (locking), background (slow), build in parallel
  - Statistics: Index size, usage frequency
  - Unused Indexes: Monitor and remove
  - Rebuild: Defragmentation
  - Compound Index Creation: Order matters

- **Query Performance**:
  - EXPLAIN: Analyze execution plan
  - executionStats: Document examination count
  - COLLSCAN vs IXSCAN: Full scan vs index scan
  - Covered Queries: Zero document examination
  - Index Intersection: Using multiple indexes

### 8. Transactions & ACID Guarantees (4.0+)
- **Single Document Transactions**: Atomic by default
- **Multi-Document Transactions**:
  - Session-based transactions
  - Start, commit, abort
  - Automatic rollback on error
  - Write concern levels (0, 1, majority)
  - Read concern levels (local, available, majority, linearizable)

- **ACID Properties**:
  - Atomicity: All-or-nothing operations
  - Consistency: Valid state guarantee
  - Isolation: Concurrent transaction safety
  - Durability: Committed data persistence

### 9. Replica Sets & Replication (HA Architecture)
- **Replica Set Architecture**:
  - Primary: Single writer node
  - Secondary: Read-only copies, automatic sync
  - Arbiter: Voting participant, no data
  - Hidden members: Data but no primary eligibility
  - Delayed members: Lag behind for recovery

- **Replication Process**:
  - Oplog (operation log): Record of writes
  - Initial sync: First replica sync, index rebuild
  - Incremental sync: Continuous oplog replay
  - Arbiters: Election voting only

- **High Availability**:
  - Automatic failover: Election of new primary
  - Election: Majority voting, heartbeat monitoring
  - Priority: Control which member becomes primary
  - Readiness: Time to be elected primary

- **Read Preferences**:
  - Primary (default): Strongly consistent
  - PrimaryPreferred: Primary, fallback to secondary
  - Secondary: Load balancing
  - SecondaryPreferred: Secondary, fallback to primary
  - Nearest: Lowest latency

### 10. Sharding & Horizontal Scaling (At-Scale Systems)
- **Sharding Architecture**:
  - Shard cluster: Multiple independent shards
  - Config servers: Metadata and cluster state
  - Mongos router: Query router, transaction coordinator
  - Shard key: Determines document distribution

- **Shard Key Design** (Critical):
  - Cardinality: Too low = uneven distribution
  - Frequency: Avoid hotspots
  - Query patterns: Support common queries
  - Growth: Extensibility over time
  - Monotonic: Avoid (creates hotspots)
  - Good examples: user_id + date, location, category

- **Chunk Management**:
  - Chunk size: Default 64MB, configurable
  - Chunk splitting: Automatic on growth
  - Balancing: Even distribution across shards
  - Jumbo chunks: Cannot split (>chunk_size)
  - Migration: Data movement between shards

- **Administration**:
  - Adding shards: New shard joining cluster
  - Removing shards: Draining shard gracefully
  - Migration: Data rebalancing
  - Monitoring: Distribution metrics

### 11. Backup & Disaster Recovery
- **Backup Methods**:
  - mongodump: Logical backup, selective collection backup
  - mongorestore: Restore from dump
  - File system backup: LVM snapshot, cloud snapshots
  - MongoDB Cloud Backup: Continuous, PITR capable
  - WiredTiger backup: Consistent physical backup

- **Recovery Strategies**:
  - Full recovery: Complete database restore
  - Partial recovery: Specific collections
  - Point-in-time recovery: Restore to specific timestamp
  - Backup testing: Regular verification
  - RTO/RPO planning: Recovery objectives

### 12. Monitoring & Operations (Production Excellence)
- **Built-in Monitoring**:
  - db.stats(): Database-level statistics
  - db.collection.stats(): Collection-level statistics
  - db.serverStatus(): Server health and metrics
  - db.currentOp(): Active operations
  - db.oplog.rs.find(): Replication log viewing

- **Performance Monitoring**:
  - Query profiler: Slow query logging
  - mongostat: Live statistics stream
  - mongotop: Operation timing
  - Atlas monitoring: Cloud-based metrics
  - Prometheus exporter: Metrics export

- **Key Metrics**:
  - Query latency: Response time
  - Throughput: Operations per second
  - Lock contention: Write conflicts
  - Replication lag: Secondary delay
  - Memory usage: Working set size
  - Disk I/O: Read/write operations

## 🔗 Workflow Integration (Seamless)

```
SQL Fundamentals (understand RDBMS)
        ↓
MongoDB Expert (embrace NoSQL flexibility)
  ├→ Understand document design advantages
  ├→ Learn aggregation instead of joins
  ├→ Implement sharding for scale
  └→ Build distributed systems

        ↓
Choose next based on architecture:
  ├→ Data Engineer (if building pipelines)
  ├→ Redis (if need caching with MongoDB)
  └→ PostgreSQL (if hybrid SQL/NoSQL)
```

### Command Integration Points
- `/learn` - Get personalized MongoDB path
- `/assess` - Test MongoDB knowledge
- `/browse-agent` - Explore related agents
- `/projects` - Projects 8, 13-14 (MongoDB focus)
- `/skills mongodb` - Core CRUD & queries
- `/skills nosql-design` - Advanced patterns

## 📋 When to Learn This Agent

### ✅ You Should Learn MongoDB If:
- Building flexible, scalable applications
- Working with unstructured/semi-structured data
- Need horizontal scaling (sharding)
- JSON-native data structure advantages
- High write throughput requirements
- Growing dataset with evolving schema
- Real-time analytics and dashboards
- Microservices with flexible schemas

### 🎯 This Agent Enables:
1. **NoSQL Architecture** - Scale horizontally
2. **Flexible Schemas** - Evolve without migrations
3. **Aggregation Analytics** - Complex analysis without ETL
4. **High Availability** - Replica sets and failover
5. **Distributed Systems** - Sharding for petabyte-scale

## 💼 Real-World Production Scenarios

### Scenario 1: SaaS Content Platform
**Requirements:** Flexible content types, multi-tenant, versioning
**MongoDB Advantages:**
- Polymorphic documents (different content types)
- Embedded relationships (one query fetch)
- Flexible schema (new attributes without migration)

**Key Skills Needed:**
- Document design patterns
- Indexing for query performance
- Replication for HA

### Scenario 2: IoT Sensor Network
**Requirements:** Time-series data, high write volume, flexible structure
**MongoDB Advantages:**
- TTL indexes (auto-expire old data)
- High write throughput
- Flexible metric attributes

**Key Skills Needed:**
- Sharding for scale
- Aggregation for analytics
- Efficient indexing

### Scenario 3: Multi-Tenant Analytics Platform
**Requirements:** Isolated data, custom metrics, real-time dashboards
**MongoDB Advantages:**
- Document flexibility
- Aggregation framework
- Horizontal scaling

**Key Skills Needed:**
- Sharding by tenant_id
- Aggregation pipelines
- Security (field-level filtering)

## ✅ Best Practices & Production Patterns

### Schema Design
- ✓ Design schemas for queries, not just storage
- ✓ Consider embedding vs referencing trade-offs
- ✓ Plan for growth (array limits, document size)
- ✓ Use schema validation for consistency
- ✓ Document denormalization decisions

### Querying
- ✓ Use aggregation pipeline for complex analysis
- ✓ Filter early ($match first stage)
- ✓ Avoid large array expansion ($unwind)
- ✓ Use covered queries when possible
- ✓ Index query fields properly

### Performance
- ✓ Monitor query performance
- ✓ Use EXPLAIN to verify execution plans
- ✓ Index wisely (not every field)
- ✓ Keep working set in memory
- ✓ Batch large inserts

### Operations
- ✓ Test backup and recovery regularly
- ✓ Monitor replication lag
- ✓ Plan shard key carefully
- ✓ Monitor chunk distribution
- ✓ Use connection pooling

### Security
- ✓ Enable authentication
- ✓ Use RBAC (role-based access control)
- ✓ Encrypt in transit (TLS)
- ✓ Encrypt at rest (where needed)
- ✓ Audit administrative actions

## 🎓 Hands-On Projects

### Beginner Projects
- **Project 8**: MongoDB Fundamentals
  - Create collections, basic CRUD
  - Design simple schema
  - Basic queries and aggregation

### Intermediate Projects
- **Project 14**: Real-Time Analytics
  - Time-series data with MongoDB
  - Aggregation pipelines
  - Dashboard data preparation

### Advanced Projects
- **Project 13**: Multi-Node Sharded Cluster
  - Shard key selection
  - Cluster setup
  - Testing failover

## 🚀 After Completing This Agent

### You'll Be Able To:
- ✅ Design flexible MongoDB schemas
- ✅ Write complex aggregation pipelines
- ✅ Optimize query performance
- ✅ Implement replica sets
- ✅ Shard large datasets
- ✅ Handle real-time data
- ✅ Build scalable applications
- ✅ Understand NoSQL vs SQL trade-offs
- ✅ Deploy and operate MongoDB
- ✅ Troubleshoot performance issues

### Your Toolkit Includes:
- 50+ aggregation pipeline patterns
- Shard key selection decision tree
- Index design guidelines
- Query optimization checklist
- Troubleshooting playbook
- Production deployment procedures

---

## 📚 Next Steps to Mastery

### Immediate (This Week)
1. Run `/skills mongodb` - Start with fundamentals
2. Complete Project 8 - Basic CRUD practice
3. Design first schema - Apply embedding pattern

### Short-term (This Month)
1. Master aggregation framework (most powerful feature)
2. Understand sharding trade-offs
3. Build replica set locally
4. Complete intermediate project

### Long-term (3 months)
1. Run production MongoDB system
2. Implement sharding strategy
3. Optimize indexes
4. Complete advanced project

**Ready to master MongoDB?** Run `/skills mongodb` now and join thousands building scalable NoSQL systems! 🚀
