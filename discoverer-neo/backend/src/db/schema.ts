/**
 * The backend's view of the database.
 *
 * The 20 tables shared with the migrator are **not declared here**. They live
 * in `@discoverer-neo/core/db/schema` as their single definition and are
 * re-exported below, so the two workspaces cannot drift: there is only one
 * declaration to drift from. Adding a `pgTable` call here for any of them
 * re-introduces exactly the hazard the move removed — don't.
 *
 * What *is* declared here: the 10 runtime-only tables the migrator never
 * writes (map shares, query execution log, export jobs, schedules, schedule
 * parameters, scheduled results, the three security-policy tables and the
 * audit log), their enums, and every `relations()` block — relations span
 * both halves, so they belong on the side that can see both.
 *
 * Neither file is the DDL. `backend/drizzle/*.sql` is.
 */

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
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// Shared tables and enums — single definition in @discoverer-neo/core.
export * from '@discoverer-neo/core/db/schema';

import {
  users,
  dataSources,
  businessAreas,
  userBusinessAreaGrants,
  folders,
  items,
  joins,
  hierarchies,
  hierarchyLevels,
  maps,
  mapItems,
  mapConditions,
  mapParameters,
  mapCalculatedFields,
  mapConditionalFormats,
  mapLayouts,
  mapPageSetup,
  mapTotals,
} from '@discoverer-neo/core/db/schema';
import type { customFunctions } from '@discoverer-neo/core/db/schema';


// ---------------------------------------------------------------------------
// Enums used only by the runtime-only tables below
// ---------------------------------------------------------------------------

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
  mapTotals: many(mapTotals),
  mapConditionalFormats: many(mapConditionalFormats),
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

export const mapLayoutsRelations = relations(mapLayouts, ({ one }) => ({
  map: one(maps, { fields: [mapLayouts.mapId], references: [maps.id] }),
}));

export const mapTotalsRelations = relations(mapTotals, ({ one }) => ({
  map: one(maps, { fields: [mapTotals.mapId], references: [maps.id] }),
  mapItem: one(mapItems, {
    fields: [mapTotals.mapItemId],
    references: [mapItems.id],
    relationName: 'mapTotalColumn',
  }),
  breakMapItem: one(mapItems, {
    fields: [mapTotals.breakMapItemId],
    references: [mapItems.id],
    relationName: 'mapTotalBreakColumn',
  }),
  mapCalculatedField: one(mapCalculatedFields, {
    fields: [mapTotals.mapCalculatedFieldId],
    references: [mapCalculatedFields.id],
  }),
}));

export const mapPageSetupRelations = relations(mapPageSetup, ({ one }) => ({
  map: one(maps, { fields: [mapPageSetup.mapId], references: [maps.id] }),
}));

export const mapConditionalFormatsRelations = relations(
  mapConditionalFormats,
  ({ one }) => ({
    map: one(maps, {
      fields: [mapConditionalFormats.mapId],
      references: [maps.id],
    }),
    mapItem: one(mapItems, {
      fields: [mapConditionalFormats.mapItemId],
      references: [mapItems.id],
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
export type MapLayout = typeof mapLayouts.$inferSelect;
export type MapTotal = typeof mapTotals.$inferSelect;
export type MapPageSetup = typeof mapPageSetup.$inferSelect;
export type MapConditionalFormat = typeof mapConditionalFormats.$inferSelect;
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
