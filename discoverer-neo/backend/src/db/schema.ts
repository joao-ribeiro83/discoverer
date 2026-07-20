import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum('user_role', [
  'ADMIN',
  'MANAGER',
  'USER',
  'VIEWER',
]);

export const connectionTypeEnum = pgEnum('connection_type', [
  'oracle',
  'postgres',
]);

export const folderTypeEnum = pgEnum('folder_type', [
  'TABLE',
  'VIEW',
  'DERIVED',
  'COMPLEX',
  'JOIN',
  'SUMMARY',
]);

export const itemTypeEnum = pgEnum('item_type', [
  'CI', // custom item
  'CU', // custom (user) item
  'CO', // calculated item
  'JI', // join item
  'HI', // hierarchy item
  'AG', // aggregate item
  'FU', // function item
]);

export const permissionLevelEnum = pgEnum('permission_level', [
  'CREATE',
  'EDIT',
  'DELETE',
  'EXPORT',
  'SCHEDULE',
  'VIEW',
]);

export const joinTypeEnum = pgEnum('join_type', [
  'INNER',
  'LEFT',
  'RIGHT',
  'FULL',
]);

export const functionTypeEnum = pgEnum('function_type', [
  'SQL',
  'PLSQL',
  'PACKAGE',
]);

export const mapTypeEnum = pgEnum('map_type', [
  'TABLE',
  'CROSSTAB',
  'PAGE_DETAIL',
  'CHART',
]);

export const sortDirectionEnum = pgEnum('sort_direction', ['ASC', 'DESC']);

export const operatorEnum = pgEnum('map_operator', [
  '=',
  '<>',
  '>',
  '<',
  '>=',
  '<=',
  'LIKE',
  'IN',
  'BETWEEN',
  'IS_NULL',
]);

export const conditionTypeEnum = pgEnum('condition_type', [
  'PARAMETER',
  'STATIC',
]);

export const logicOperatorEnum = pgEnum('logic_operator', ['AND', 'OR']);

export const sharePermissionEnum = pgEnum('share_permission_level', [
  'VIEW',
  'EDIT',
  'EXPORT',
]);

export const exportFormatEnum = pgEnum('export_format', ['XLSX', 'CSV']);

export const exportStatusEnum = pgEnum('export_status', [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
]);

export const executionStatusEnum = pgEnum('execution_status', [
  'SUCCESS',
  'FAILED',
  'TIMEOUT',
]);

export const policyTypeEnum = pgEnum('policy_type', ['ROW_LEVEL']);

export const targetTypeEnum = pgEnum('target_type', [
  'BUSINESS_AREA',
  'FOLDER',
]);

export const localeEnum = pgEnum('locale', ['en', 'pt-PT', 'fr-FR', 'es-ES']);

export const themeEnum = pgEnum('theme', ['light', 'dark', 'high-contrast']);

// ---------------------------------------------------------------------------
// 1. users
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    role: userRoleEnum('role').notNull().default('USER'),
    locale: localeEnum('locale').notNull().default('en'),
    theme: themeEnum('theme').notNull().default('light'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
);

// ---------------------------------------------------------------------------
// 2. data_sources
// ---------------------------------------------------------------------------

export const dataSources = pgTable(
  'data_sources',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 255 }).notNull().unique(),
    description: text('description'),
    connectionType: connectionTypeEnum('connection_type').notNull(),
    host: varchar('host', { length: 255 }),
    port: integer('port'),
    serviceName: varchar('service_name', { length: 255 }),
    sid: varchar('sid', { length: 64 }),
    username: varchar('username', { length: 255 }),
    passwordEnc: text('password_enc'),
    connectionString: text('connection_string'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('data_sources_name_idx').on(t.name)],
);

// ---------------------------------------------------------------------------
// 3. business_areas
// ---------------------------------------------------------------------------

export const businessAreas = pgTable(
  'business_areas',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 255 }).notNull().unique(),
    description: text('description'),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: uuid('updated_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    uniqueIndex('business_areas_name_idx').on(t.name),
    index('business_areas_created_by_idx').on(t.createdBy),
  ],
);

// ---------------------------------------------------------------------------
// 4. user_business_area_grants
// ---------------------------------------------------------------------------

export const userBusinessAreaGrants = pgTable(
  'user_business_area_grants',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    businessAreaId: uuid('business_area_id')
      .notNull()
      .references(() => businessAreas.id, { onDelete: 'cascade' }),
    permissionLevel: permissionLevelEnum('permission_level').notNull(),
    grantedBy: uuid('granted_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    grantedAt: timestamp('granted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('user_ba_grants_user_ba_perm_idx').on(
      t.userId,
      t.businessAreaId,
      t.permissionLevel,
    ),
    index('user_ba_grants_ba_idx').on(t.businessAreaId),
  ],
);

// ---------------------------------------------------------------------------
// 5. folders
// ---------------------------------------------------------------------------

export const folders = pgTable(
  'folders',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    businessAreaId: uuid('business_area_id')
      .notNull()
      .references(() => businessAreas.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    folderType: folderTypeEnum('folder_type').notNull(),
    tableName: varchar('table_name', { length: 255 }),
    tableOwner: varchar('table_owner', { length: 255 }),
    customSql: text('custom_sql'),
    dataSourceId: uuid('data_source_id').references(() => dataSources.id, {
      onDelete: 'set null',
    }),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('folders_ba_idx').on(t.businessAreaId),
    index('folders_data_source_idx').on(t.dataSourceId),
    index('folders_created_by_idx').on(t.createdBy),
  ],
);

// ---------------------------------------------------------------------------
// 6. items
// ---------------------------------------------------------------------------

export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    folderId: uuid('folder_id')
      .notNull()
      .references(() => folders.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    itemType: itemTypeEnum('item_type').notNull(),
    columnName: varchar('column_name', { length: 255 }),
    formula: text('formula'),
    dataType: varchar('data_type', { length: 64 }),
    formatMask: varchar('format_mask', { length: 255 }),
    aggFunction: varchar('agg_function', { length: 64 }),
    displayOrder: integer('display_order').notNull().default(0),
    isHidden: boolean('is_hidden').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    // Self-referential parent item; FK added at migration time because drizzle
    // cannot declare an inline `.references()` on its own table.
    parentItemId: uuid('parent_item_id'),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('items_folder_idx').on(t.folderId),
    index('items_parent_idx').on(t.parentItemId),
    index('items_created_by_idx').on(t.createdBy),
  ],
);

// ---------------------------------------------------------------------------
// 7. joins
// ---------------------------------------------------------------------------

export const joins = pgTable(
  'joins',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 255 }).notNull(),
    leftFolderId: uuid('left_folder_id')
      .notNull()
      .references(() => folders.id, { onDelete: 'cascade' }),
    rightFolderId: uuid('right_folder_id')
      .notNull()
      .references(() => folders.id, { onDelete: 'cascade' }),
    leftItemId: uuid('left_item_id').references(() => items.id, {
      onDelete: 'set null',
    }),
    rightItemId: uuid('right_item_id').references(() => items.id, {
      onDelete: 'set null',
    }),
    joinType: joinTypeEnum('join_type').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('joins_left_folder_idx').on(t.leftFolderId),
    index('joins_right_folder_idx').on(t.rightFolderId),
    index('joins_left_item_idx').on(t.leftItemId),
    index('joins_right_item_idx').on(t.rightItemId),
  ],
);

// ---------------------------------------------------------------------------
// 8. hierarchies
// ---------------------------------------------------------------------------

export const hierarchies = pgTable(
  'hierarchies',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    businessAreaId: uuid('business_area_id')
      .notNull()
      .references(() => businessAreas.id, { onDelete: 'cascade' }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('hierarchies_ba_idx').on(t.businessAreaId)],
);

// ---------------------------------------------------------------------------
// 9. hierarchy_levels
// ---------------------------------------------------------------------------

export const hierarchyLevels = pgTable(
  'hierarchy_levels',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    hierarchyId: uuid('hierarchy_id')
      .notNull()
      .references(() => hierarchies.id, { onDelete: 'cascade' }),
    levelName: varchar('level_name', { length: 255 }).notNull(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    levelNumber: integer('level_number').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('hierarchy_levels_hierarchy_number_idx').on(
      t.hierarchyId,
      t.levelNumber,
    ),
    index('hierarchy_levels_item_idx').on(t.itemId),
  ],
);

// ---------------------------------------------------------------------------
// 10. custom_functions
// ---------------------------------------------------------------------------

export const customFunctions = pgTable('custom_functions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  functionType: functionTypeEnum('function_type').notNull(),
  parameters: jsonb('parameters'),
  returnType: varchar('return_type', { length: 64 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// 11. maps
// ---------------------------------------------------------------------------

export const maps = pgTable(
  'maps',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    mapType: mapTypeEnum('map_type').notNull(),
    businessAreaId: uuid('business_area_id')
      .notNull()
      .references(() => businessAreas.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    isPublic: boolean('is_public').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('maps_ba_idx').on(t.businessAreaId),
    index('maps_created_by_idx').on(t.createdBy),
  ],
);

// ---------------------------------------------------------------------------
// 12. map_items
// ---------------------------------------------------------------------------

export const mapItems = pgTable(
  'map_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    mapId: uuid('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    displayOrder: integer('display_order').notNull().default(0),
    displayName: varchar('display_name', { length: 255 }),
    formatMask: varchar('format_mask', { length: 255 }),
    aggFunction: varchar('agg_function', { length: 64 }),
    sortDirection: sortDirectionEnum('sort_direction'),
    sortOrder: integer('sort_order'),
    columnWidth: integer('column_width'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('map_items_map_idx').on(t.mapId),
    index('map_items_item_idx').on(t.itemId),
  ],
);

// ---------------------------------------------------------------------------
// 13. map_conditions
// ---------------------------------------------------------------------------

export const mapConditions = pgTable(
  'map_conditions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    mapId: uuid('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    operator: operatorEnum('operator').notNull(),
    value: text('value'),
    paramName: varchar('param_name', { length: 255 }),
    conditionType: conditionTypeEnum('condition_type').notNull(),
    groupId: uuid('group_id'),
    logicOperator: logicOperatorEnum('logic_operator').notNull().default('AND'),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('map_conditions_map_idx').on(t.mapId),
    index('map_conditions_item_idx').on(t.itemId),
  ],
);

// ---------------------------------------------------------------------------
// 14. map_parameters
// ---------------------------------------------------------------------------

export const mapParameters = pgTable(
  'map_parameters',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    mapId: uuid('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    paramType: varchar('param_type', { length: 32 }).notNull(), // STRING | NUMBER | DATE | LIST
    defaultValue: text('default_value'),
    isRequired: boolean('is_required').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('map_parameters_map_idx').on(t.mapId)],
);

// ---------------------------------------------------------------------------
// 15. map_calculated_fields
// ---------------------------------------------------------------------------

export const mapCalculatedFields = pgTable(
  'map_calculated_fields',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    mapId: uuid('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    formula: text('formula').notNull(),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('map_calculated_fields_map_idx').on(t.mapId)],
);

// ---------------------------------------------------------------------------
// 16. map_shares
// ---------------------------------------------------------------------------

export const mapShares = pgTable(
  'map_shares',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    mapId: uuid('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    sharedWithUserId: uuid('shared_with_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permissionLevel: sharePermissionEnum('permission_level').notNull(),
    sharedBy: uuid('shared_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sharedAt: timestamp('shared_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('map_shares_map_user_idx').on(t.mapId, t.sharedWithUserId),
    index('map_shares_user_idx').on(t.sharedWithUserId),
  ],
);

// ---------------------------------------------------------------------------
// 17. query_execution_log
// ---------------------------------------------------------------------------

export const queryExecutionLog = pgTable(
  'query_execution_log',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    mapId: uuid('map_id').references(() => maps.id, {
      onDelete: 'set null',
    }),
    executedBy: uuid('executed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    executedAt: timestamp('executed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    executionTimeMs: integer('execution_time_ms'),
    rowCount: integer('row_count'),
    sqlText: text('sql_text'),
    errorMessage: text('error_message'),
    status: executionStatusEnum('status').notNull(),
  },
  (t) => [
    index('query_execution_log_map_idx').on(t.mapId),
    index('query_execution_log_user_idx').on(t.executedBy),
    index('query_execution_log_at_idx').on(t.executedAt),
  ],
);

// ---------------------------------------------------------------------------
// 18. export_jobs
// ---------------------------------------------------------------------------

export const exportJobs = pgTable(
  'export_jobs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    mapId: uuid('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    format: exportFormatEnum('format').notNull(),
    status: exportStatusEnum('status').notNull().default('PENDING'),
    progress: integer('progress').notNull().default(0),
    /** Rows actually written. Null until the export completes. */
    rowCount: integer('row_count'),
    filePath: varchar('file_path', { length: 1024 }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    index('export_jobs_map_idx').on(t.mapId),
    index('export_jobs_requested_by_idx').on(t.requestedBy),
    index('export_jobs_status_idx').on(t.status),
    // Backs the retention sweep, which scans completed jobs by age.
    index('export_jobs_created_at_idx').on(t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// 19. schedules
// ---------------------------------------------------------------------------

export const schedules = pgTable(
  'schedules',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    mapId: uuid('map_id')
      .notNull()
      .references(() => maps.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    cronExpression: varchar('cron_expression', { length: 255 }).notNull(),
    timezone: varchar('timezone', { length: 128 }).notNull().default('UTC'),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    outputFormat: exportFormatEnum('output_format').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('schedules_map_idx').on(t.mapId),
    index('schedules_created_by_idx').on(t.createdBy),
  ],
);

// ---------------------------------------------------------------------------
// 20. schedule_parameters
// ---------------------------------------------------------------------------

export const scheduleParameters = pgTable(
  'schedule_parameters',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    scheduleId: uuid('schedule_id')
      .notNull()
      .references(() => schedules.id, { onDelete: 'cascade' }),
    paramName: varchar('param_name', { length: 255 }).notNull(),
    paramValue: text('param_value'),
  },
  (t) => [index('schedule_parameters_schedule_idx').on(t.scheduleId)],
);

// ---------------------------------------------------------------------------
// 21. scheduled_results
// ---------------------------------------------------------------------------

export const scheduledResults = pgTable(
  'scheduled_results',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    scheduleId: uuid('schedule_id')
      .notNull()
      .references(() => schedules.id, { onDelete: 'cascade' }),
    executedAt: timestamp('executed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    rowCount: integer('row_count'),
    filePath: varchar('file_path', { length: 1024 }),
    executionTimeMs: integer('execution_time_ms'),
    status: executionStatusEnum('status').notNull(),
    errorMessage: text('error_message'),
  },
  (t) => [index('scheduled_results_schedule_idx').on(t.scheduleId)],
);

// ---------------------------------------------------------------------------
// 22. security_policies
// ---------------------------------------------------------------------------

export const securityPolicies = pgTable('security_policies', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  policyType: policyTypeEnum('policy_type').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// 23. security_policy_rules
// ---------------------------------------------------------------------------

export const securityPolicyRules = pgTable(
  'security_policy_rules',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    policyId: uuid('policy_id')
      .notNull()
      .references(() => securityPolicies.id, { onDelete: 'cascade' }),
    targetId: uuid('target_id').notNull(),
    targetType: targetTypeEnum('target_type').notNull(),
    sqlPredicate: text('sql_predicate').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('security_policy_rules_policy_idx').on(t.policyId),
    index('security_policy_rules_target_idx').on(t.targetId),
  ],
);

// ---------------------------------------------------------------------------
// 24. security_policy_assignments
// ---------------------------------------------------------------------------

export const securityPolicyAssignments = pgTable(
  'security_policy_assignments',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    policyId: uuid('policy_id')
      .notNull()
      .references(() => securityPolicies.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    roleName: varchar('role_name', { length: 255 }),
  },
  (t) => [
    index('security_policy_assignments_policy_idx').on(t.policyId),
    index('security_policy_assignments_user_idx').on(t.userId),
  ],
);

// ---------------------------------------------------------------------------
// 25. audit_log
// ---------------------------------------------------------------------------

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: varchar('action', { length: 128 }).notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: uuid('entity_id'),
    details: jsonb('details'),
    ipAddress: varchar('ip_address', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('audit_log_user_idx').on(t.userId),
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
    index('audit_log_created_at_idx').on(t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Relations (for drizzle query API)
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  businessAreaGrants: many(userBusinessAreaGrants),
  createdBusinessAreas: many(businessAreas),
  createdFolders: many(folders),
  createdItems: many(items),
  createdMaps: many(maps),
  mapShares: many(mapShares),
  exportJobs: many(exportJobs),
  schedules: many(schedules),
  auditLogs: many(auditLog),
}));

export const dataSourcesRelations = relations(dataSources, ({ many }) => ({
  folders: many(folders),
}));

export const businessAreasRelations = relations(businessAreas, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [businessAreas.createdBy],
    references: [users.id],
  }),
  updatedBy: one(users, {
    fields: [businessAreas.updatedBy],
    references: [users.id],
  }),
  folders: many(folders),
  hierarchies: many(hierarchies),
  maps: many(maps),
  grants: many(userBusinessAreaGrants),
}));

export const userBusinessAreaGrantsRelations = relations(
  userBusinessAreaGrants,
  ({ one }) => ({
    user: one(users, {
      fields: [userBusinessAreaGrants.userId],
      references: [users.id],
    }),
    businessArea: one(businessAreas, {
      fields: [userBusinessAreaGrants.businessAreaId],
      references: [businessAreas.id],
    }),
    grantedBy: one(users, {
      fields: [userBusinessAreaGrants.grantedBy],
      references: [users.id],
    }),
  }),
);

export const foldersRelations = relations(folders, ({ one, many }) => ({
  businessArea: one(businessAreas, {
    fields: [folders.businessAreaId],
    references: [businessAreas.id],
  }),
  dataSource: one(dataSources, {
    fields: [folders.dataSourceId],
    references: [dataSources.id],
  }),
  createdBy: one(users, {
    fields: [folders.createdBy],
    references: [users.id],
  }),
  items: many(items),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  folder: one(folders, {
    fields: [items.folderId],
    references: [folders.id],
  }),
  parentItem: one(items, {
    fields: [items.parentItemId],
    references: [items.id],
    relationName: 'item_parent',
  }),
  childItems: many(items, { relationName: 'item_parent' }),
  createdBy: one(users, {
    fields: [items.createdBy],
    references: [users.id],
  }),
  mapItems: many(mapItems),
  mapConditions: many(mapConditions),
  hierarchyLevels: many(hierarchyLevels),
}));

export const joinsRelations = relations(joins, ({ one }) => ({
  leftFolder: one(folders, {
    fields: [joins.leftFolderId],
    references: [folders.id],
    relationName: 'join_left_folder',
  }),
  rightFolder: one(folders, {
    fields: [joins.rightFolderId],
    references: [folders.id],
    relationName: 'join_right_folder',
  }),
  leftItem: one(items, {
    fields: [joins.leftItemId],
    references: [items.id],
  }),
  rightItem: one(items, {
    fields: [joins.rightItemId],
    references: [items.id],
  }),
}));

export const hierarchiesRelations = relations(hierarchies, ({ one, many }) => ({
  businessArea: one(businessAreas, {
    fields: [hierarchies.businessAreaId],
    references: [businessAreas.id],
  }),
  levels: many(hierarchyLevels),
}));

export const hierarchyLevelsRelations = relations(hierarchyLevels, ({ one }) => ({
  hierarchy: one(hierarchies, {
    fields: [hierarchyLevels.hierarchyId],
    references: [hierarchies.id],
  }),
  item: one(items, {
    fields: [hierarchyLevels.itemId],
    references: [items.id],
  }),
}));

export const mapsRelations = relations(maps, ({ one, many }) => ({
  businessArea: one(businessAreas, {
    fields: [maps.businessAreaId],
    references: [businessAreas.id],
  }),
  createdBy: one(users, {
    fields: [maps.createdBy],
    references: [users.id],
  }),
  mapItems: many(mapItems),
  mapConditions: many(mapConditions),
  mapParameters: many(mapParameters),
  mapCalculatedFields: many(mapCalculatedFields),
  mapShares: many(mapShares),
  exportJobs: many(exportJobs),
  schedules: many(schedules),
  queryLogs: many(queryExecutionLog),
}));

export const mapItemsRelations = relations(mapItems, ({ one }) => ({
  map: one(maps, { fields: [mapItems.mapId], references: [maps.id] }),
  item: one(items, { fields: [mapItems.itemId], references: [items.id] }),
}));

export const mapConditionsRelations = relations(mapConditions, ({ one }) => ({
  map: one(maps, {
    fields: [mapConditions.mapId],
    references: [maps.id],
  }),
  item: one(items, {
    fields: [mapConditions.itemId],
    references: [items.id],
  }),
}));

export const mapParametersRelations = relations(mapParameters, ({ one }) => ({
  map: one(maps, {
    fields: [mapParameters.mapId],
    references: [maps.id],
  }),
}));

export const mapCalculatedFieldsRelations = relations(
  mapCalculatedFields,
  ({ one }) => ({
    map: one(maps, {
      fields: [mapCalculatedFields.mapId],
      references: [maps.id],
    }),
  }),
);

export const mapSharesRelations = relations(mapShares, ({ one }) => ({
  map: one(maps, { fields: [mapShares.mapId], references: [maps.id] }),
  sharedWithUser: one(users, {
    fields: [mapShares.sharedWithUserId],
    references: [users.id],
  }),
  sharedBy: one(users, {
    fields: [mapShares.sharedBy],
    references: [users.id],
  }),
}));

export const queryExecutionLogRelations = relations(queryExecutionLog, ({ one }) => ({
  map: one(maps, {
    fields: [queryExecutionLog.mapId],
    references: [maps.id],
  }),
  executedBy: one(users, {
    fields: [queryExecutionLog.executedBy],
    references: [users.id],
  }),
}));

export const exportJobsRelations = relations(exportJobs, ({ one }) => ({
  map: one(maps, { fields: [exportJobs.mapId], references: [maps.id] }),
  requestedBy: one(users, {
    fields: [exportJobs.requestedBy],
    references: [users.id],
  }),
}));

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  map: one(maps, { fields: [schedules.mapId], references: [maps.id] }),
  createdBy: one(users, {
    fields: [schedules.createdBy],
    references: [users.id],
  }),
  parameters: many(scheduleParameters),
  results: many(scheduledResults),
}));

export const scheduleParametersRelations = relations(scheduleParameters, ({ one }) => ({
  schedule: one(schedules, {
    fields: [scheduleParameters.scheduleId],
    references: [schedules.id],
  }),
}));

export const scheduledResultsRelations = relations(scheduledResults, ({ one }) => ({
  schedule: one(schedules, {
    fields: [scheduledResults.scheduleId],
    references: [schedules.id],
  }),
}));

export const securityPoliciesRelations = relations(
  securityPolicies,
  ({ many }) => ({
    rules: many(securityPolicyRules),
    assignments: many(securityPolicyAssignments),
  }),
);

export const securityPolicyRulesRelations = relations(securityPolicyRules, ({ one }) => ({
  policy: one(securityPolicies, {
    fields: [securityPolicyRules.policyId],
    references: [securityPolicies.id],
  }),
}));

export const securityPolicyAssignmentsRelations = relations(
  securityPolicyAssignments,
  ({ one }) => ({
    policy: one(securityPolicies, {
      fields: [securityPolicyAssignments.policyId],
      references: [securityPolicies.id],
    }),
    user: one(users, {
      fields: [securityPolicyAssignments.userId],
      references: [users.id],
    }),
  }),
);

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id],
  }),
}));

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type DataSource = typeof dataSources.$inferSelect;
export type NewDataSource = typeof dataSources.$inferInsert;
export type BusinessArea = typeof businessAreas.$inferSelect;
export type NewBusinessArea = typeof businessAreas.$inferInsert;
export type UserBusinessAreaGrant = typeof userBusinessAreaGrants.$inferSelect;
export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Join = typeof joins.$inferSelect;
export type Hierarchy = typeof hierarchies.$inferSelect;
export type HierarchyLevel = typeof hierarchyLevels.$inferSelect;
export type CustomFunction = typeof customFunctions.$inferSelect;
export type Map = typeof maps.$inferSelect;
export type NewMap = typeof maps.$inferInsert;
export type MapItem = typeof mapItems.$inferSelect;
export type MapCondition = typeof mapConditions.$inferSelect;
export type MapParameter = typeof mapParameters.$inferSelect;
export type MapCalculatedField = typeof mapCalculatedFields.$inferSelect;
export type MapShare = typeof mapShares.$inferSelect;
export type QueryExecutionLog = typeof queryExecutionLog.$inferSelect;
export type ExportJob = typeof exportJobs.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type ScheduleParameter = typeof scheduleParameters.$inferSelect;
export type ScheduledResult = typeof scheduledResults.$inferSelect;
export type SecurityPolicy = typeof securityPolicies.$inferSelect;
export type SecurityPolicyRule = typeof securityPolicyRules.$inferSelect;
export type SecurityPolicyAssignment =
  typeof securityPolicyAssignments.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
