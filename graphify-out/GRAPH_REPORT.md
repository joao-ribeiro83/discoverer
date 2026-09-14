# Graph Report - discoverer-neo  (2026-09-11)

## Corpus Check
- 554 files · ~2,921,775 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4361 nodes · 10274 edges · 241 communities (129 shown, 96 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 216 edges (avg confidence: 0.84)
- Token cost: 112,656 input · 0 output

## Community Hubs (Navigation)
- Frontend Lib
- Frontend Pages 1
- Frontend Components Map Builder
- Migrate Services 1
- Migrate Services 2
- Frontend Pages 2
- Migrate Database
- Frontend Pages 3
- Backend Tests Integration 1
- Migrate Services 3
- Migrate Types
- Backend Lib Sql 1
- Backend Services 1
- Backend Services 2
- Backend Workers
- Frontend Components Ui
- Backend Services 3
- Backend Services 4
- Migrate Services Transformers
- Backend Database
- Backend Services 5
- Migrate Semantics
- Backend Services 6
- Backend Services 7
- Migrate Root 1
- Frontend Root 1
- Backend Services 8
- Backend Tests Integration 2
- Frontend Components Data Table
- Docs Developer Guide 1
- Backend Services Exporters
- Frontend Pages 4
- Migrate Services 4
- Backend Root 1
- Migrate Services 5
- Backend Services 9
- Backend Root 2
- Frontend E2e
- Backend Scripts 1
- Migrate Testing 1
- Backend Lib Sql 2
- Backend Services 10
- Frontend Providers
- Backend Services 11
- Migrate Testing 2
- Backend Tests 1
- Backend Services 12
- Migrate Scripts 1
- Migrate Services 6
- Migrate Scripts 2
- Migrate Services 7
- Backend Services 13
- Docs User Guide
- Backend Root 3
- Docs Spanish Docs Admin Guide 1
- Backend Services 14
- Backend Services 15
- Docs French Docs User Guide
- Backend Services 16
- Migrate Services 8
- Frontend Root 2
- Migrate Services 9
- Backend Services 17
- Backend Tests Integration 3
- Docs Api
- Frontend Root 3
- Backend Tests Integration 4
- Backend Services 18
- Backend Tests 2
- Project Root Config 1
- Project Root Config 2
- Migrate Root 2
- Backend Services 19
- Migrate Services 10
- Backend Root 4
- Backend Services 20
- Docs Master Plan Checkpoints 1
- Docs Migration
- Frontend Root 4
- Migrate Root 3
- Backend Tests Integration 5
- Migrate Root 4
- Project Root Config 3
- Backend Lib Sql 3
- Docs Troubleshooting
- Project Root Config 4
- Backend Middleware
- Backend Services 21
- Backend Scripts 2
- Docs Admin Guide
- Docs Master Plan Checkpoints 2
- Migrate Scripts 3
- Backend Plugins 1
- Backend Tests 3
- Docs French Docs Admin Guide 1
- Docs Master Plan Checkpoints 3
- Backend Tests Integration 6
- Docs Portuguese Docs Admin Guide 1
- Frontend Root 5
- Frontend Hooks
- Migrate Root 5
- Backend Services 22
- Migrate Services 11
- Docs Decisions
- Docs Master Plan Checkpoints 4
- Docs Portuguese Docs Admin Guide 2
- Frontend Root 6
- Frontend Test 1
- Migrate Root 6
- Scripts Root 1
- Backend Root 5
- Backend Scripts 3
- Docs Master Plan Checkpoints 5
- Backend Plugins 2
- Migrate Scripts 4
- Frontend Pages 5
- Migrate Root 7
- Migrate Services 12
- Docs I18n
- Migrate Services 13
- Backend Tests Setup
- Docs French Docs Admin Guide 2
- Docs Developer Guide 2
- Frontend Root 7
- Backend Services 23
- Backend Tests 4
- Docs Developer Guide 3
- Docs Developer Guide 4
- Frontend Components Parameters
- Project Root Config 5
- Backend Tests 5
- Docs Spanish Docs Admin Guide 2
- Docs French Docs Admin Guide 3
- Docs Developer Guide 5
- Frontend Root 8
- Scripts Root 2
- Scripts Root 3
- Frontend Root 9
- Project Root Config 6
- Frontend Root 10
- Frontend Root 11
- Frontend Root 12
- Frontend Root 13
- Docs Deployment 1
- Docs Deployment 2
- Docs Deployment 3
- Docs Developer Guide 6
- Docs Developer Guide 7
- Docs Spanish Docs Admin Guide 3
- Frontend Root 14
- Frontend Root 15
- Frontend Root 16
- Frontend Root 17
- Frontend Root 18
- Frontend Root 19
- Frontend Root 20
- Frontend Root 21
- Frontend Root 22
- Frontend Root 23
- Frontend Root 24
- Frontend Root 25
- Frontend Root 26
- Frontend Root 27
- Frontend Root 28
- Frontend Root 29
- Frontend Root 30
- Frontend Root 31
- Frontend Root 32
- Frontend Root 33
- Docs Deployment 4
- Docs Deployment 5
- Docs Deployment 6
- Docs Deployment 7
- Docs Deployment 8
- Docs Deployment 9
- Docs Deployment 10
- Docs Deployment 11
- Docs Deployment 12
- Docs Deployment 13
- Docs Developer Guide 8
- Docs Developer Guide 9
- Docs Developer Guide 10
- Docs Developer Guide 11
- Docs Developer Guide 12
- Docs Developer Guide 13
- Docs Developer Guide 14
- Docs Developer Guide 15
- Docs Developer Guide 16
- Docs Developer Guide 17
- Docs Developer Guide 18
- Docs Developer Guide 19
- Docs Developer Guide 20
- Docs Developer Guide 21
- Docs Developer Guide 22
- Docs Developer Guide 23
- Docs Developer Guide 24
- Docs Developer Guide 25
- Docs Developer Guide 26
- Docs Developer Guide 27
- Docs Developer Guide 28
- Docs Developer Guide 29
- Docs Developer Guide 30
- Docs Developer Guide 31
- Docs Developer Guide 32
- Docs Developer Guide 33
- Docs Developer Guide 34
- Docs Developer Guide 35
- Docs Spanish Docs Admin Guide 4
- Docs Spanish Docs Admin Guide 5
- Docs Spanish Docs Admin Guide 6
- Docs Spanish Docs Admin Guide 7
- Docs Spanish Docs Admin Guide 8
- Docs Spanish Docs Admin Guide 9
- Docs Spanish Docs Admin Guide 10
- Docs Spanish Docs Admin Guide 11
- Docs Spanish Docs Admin Guide 12
- Docs Spanish Docs User Guide 1
- Docs Spanish Docs User Guide 2
- Docs Spanish Docs User Guide 3
- Docs Spanish Docs User Guide 4
- Docs Spanish Docs User Guide 5
- Project Root Config 11
- Project Root Config 12
- Project Root Config 13
- Project Root Config 14

## God Nodes (most connected - your core abstractions)
1. `cn()` - 104 edges
2. `db` - 64 edges
3. `hashPassword()` - 55 edges
4. `buildApp()` - 52 edges
5. `useToast()` - 52 edges
6. `getErrorMessage()` - 52 edges
7. `SqlGenerationError` - 50 edges
8. `apiClient` - 43 edges
9. `runMigration()` - 42 edges
10. `useMapBuilderStore` - 40 edges

## Surprising Connections (you probably didn't know these)
- `user_business_area_grants Unique Index Fix (permission_level added)` --conceptually_related_to--> `User Management (Roles & Business Area Permissions)`  [INFERRED]
  INTEGRATION_TEST_REPORT.md → docs/admin-guide/user-management.md
- `POST /api/migration/reimport-maps (maps-only re-import)` --semantically_similar_to--> `POST /api/migration/reimport-maps Endpoint`  [INFERRED] [semantically similar]
  README.md → docs/api/endpoints.md
- `docker-compose.dev.yml Development Overlay` --semantically_similar_to--> `docker-compose.prod.yml Production Compose (Nginx TLS front)`  [INFERRED] [semantically similar]
  docker-compose.dev.yml → docker-compose.prod.yml
- `Business-Area Tree Virtualization (useVirtualizer)` --conceptually_related_to--> `Metadata Management (BA/Folder/Item/Join/Hierarchy hierarchy)`  [INFERRED]
  PERFORMANCE.md → docs/admin-guide/metadata-management.md
- `Redis Metadata Read-Through Cache` --shares_data_with--> `Metadata Management (BA/Folder/Item/Join/Hierarchy hierarchy)`  [EXTRACTED]
  PERFORMANCE.md → docs/admin-guide/metadata-management.md

## Import Cycles
- 4-file cycle: `backend/src/db/index.ts -> backend/src/plugins/metrics.ts -> backend/src/services/oracle-connection-pool.ts -> backend/src/services/data-source.service.ts -> backend/src/db/index.ts`

## Hyperedges (group relationships)
- **EUL/.DIS Workbook Migration and Formula-Resolution Flow** — readme_eul_migration, migrate_eul_schema_ground_truth, migrate_src_services_workbook_parser, docs_admin_guide_custom_functions_migrated_formula_resolution [EXTRACTED 0.90]
- **Query-planner refusal system spanning troubleshooting and execution UI** — discoverer_neo_docs_fr_fr_troubleshooting_refusals, discoverer_neo_docs_fr_fr_troubleshooting_refusals_no_join_path, discoverer_neo_docs_fr_fr_troubleshooting_refusals_fan_trap, discoverer_neo_docs_fr_fr_user_guide_executing_maps_refusal_panel [EXTRACTED 0.90]
- **Audit-log credential leak and its fix (substring redaction rule, purge migration, regression test)** — discoverer_neo_docs_fr_fr_admin_guide_security_audit_redaction, discoverer_neo_docs_fr_fr_admin_guide_security_audit_redaction_migration, backend_src_plugins_audit, backend_src___tests___audit_redaction_test [EXTRACTED 0.95]
- **Targeted Re-import Pattern (Joins and Maps)** — discoverer_neo_docs_master_plan_checkpoints_phase_3_2_checkpoint_reimport_joins_tool, discoverer_neo_docs_migration_migration_tool_reimport_maps, discoverer_neo_docs_migration_troubleshooting_maps_without_layout [INFERRED 0.75]
- **Calculation-referencing-calculation: refusal codes vs. the dump/parser chain finding** — docs_troubleshooting_formula_refusals_expansion_too_deep, docs_troubleshooting_formula_refusals_calculation_cycle, migrate_src_scripts_readme_calculation_chain_reference [INFERRED 0.80]
- **Discoverer Neo Credential-Protection Pattern (encrypt, redact, rotate)** — docs_admin_guide_data_sources, docs_admin_guide_security_credential_redaction, docs_deployment_configuration_encryption_key_rotation [INFERRED 0.80]
- **Fan-Trap Detection and Refusal System** — docs_developer_guide_architecture_query_planner, docs_developer_guide_architecture_fan_trap_decision_procedure, docs_es_es_troubleshooting_refusals_fan_trap_codes, docs_developer_guide_testing_five_seam_tests [INFERRED 0.85]
- **Fan-Trap Guard Design, Enablement and Verification** — discoverer_neo_docs_master_plan_checkpoints_phase_3_3_checkpoint_fan_trap_guard, discoverer_neo_docs_master_plan_checkpoints_phase_3_4_checkpoint_multi_folder_generation, discoverer_neo_docs_master_plan_checkpoints_phase_3_4_checkpoint_verify_fan_trap_m67, discoverer_neo_docs_migration_verify_planner_live_check [INFERRED 0.85]
- **Formula Token Rendering and Compilation Pipeline** — discoverer_neo_docs_master_plan_checkpoints_phase_4_2_checkpoint_builtin_codes_renderer, discoverer_neo_docs_master_plan_checkpoints_phase_4_3_checkpoint_custom_function_rendering, discoverer_neo_docs_master_plan_checkpoints_phase_4_4_checkpoint_calculation_expansion, discoverer_neo_docs_master_plan_checkpoints_phase_4_5_checkpoint_compile_run_seam2 [INFERRED 0.85]
- **Deriving join predicates from KEY_CONS plus the EXPRESSIONS token tree** — migrate_eul_schema_ground_truth_key_cons, migrate_eul_schema_ground_truth_expressions, migrate_eul_schema_ground_truth_token_language [INFERRED 0.85]
- **Multi-Layer Access Control System** — docs_developer_guide_architecture_two_authorisation_gates, docs_developer_guide_architecture_permission_model, docs_es_es_admin_guide_security_rls, docs_es_es_admin_guide_user_management_ba_permissions [INFERRED 0.85]
- **es-ES / fr-FR / pt-PT terminology-governance triad (Power BI/Tableau/Microsoft reference baselines)** — discoverer_neo_docs_i18n_glossary_es_es, discoverer_neo_docs_i18n_glossary_fr_fr, discoverer_neo_docs_i18n_glossary_pt_pt [INFERRED 0.85]
- **Shared @discoverer-neo/core Schema Architecture** — docs_developer_guide_architecture_one_schema_two_workspaces, docs_developer_guide_architecture_core_package, docs_developer_guide_backend_db_schema, docs_developer_guide_development_migrate_rebuild [INFERRED 0.85]
- **Declined rather than wrong: worksheet & calculation refusal design** — docs_troubleshooting_refusals, docs_troubleshooting_formula_refusals, docs_user_guide_executing_maps [INFERRED 0.85]
- **Folder Sharing Across Business Areas Feature** — decision1_folder_business_area_many_to_many, docs_admin_guide_metadata_management_folder_sharing, docs_api_endpoints_folders [INFERRED 0.90]
- **FULL join removal kept consistent across translations (D-038)** — docs_es_es_admin_guide_metadata_management_join_types, docs_fr_fr_admin_guide_metadata_management_join_types, docs_pt_pt_admin_guide_metadata_management_join_types [INFERRED 0.85]

## Communities (241 total, 96 thin omitted)

### Community 0 - "Frontend Lib"
Cohesion: 0.03
Nodes (93): ERROR_KIND_KEY, ExecutionPanelProps, TERMINAL_JOB_STATUSES, ExecutionRefusal(), nameList(), Props, PlanPreflight(), api (+85 more)

### Community 1 - "Frontend Pages 1"
Cohesion: 0.04
Nodes (79): AuditLogPage, BusinessAreasPage, ChangePasswordPage, CustomFunctionsPage, DataSourcesPage, FoldersPage, HierarchiesPage, ItemsPage (+71 more)

### Community 2 - "Frontend Components Map Builder"
Cohesion: 0.04
Nodes (81): BusinessAreaTree(), ItemNode, Row, TreeItemDragData, TreeRow(), ColumnConfigDialog(), FormState, isNumericType() (+73 more)

### Community 3 - "Migrate Services 1"
Cohesion: 0.04
Nodes (73): TargetTable, findOrphans(), validateEulData(), assertTargetSchema(), DEFAULT_HOST_BUSINESS_AREA, EMPTY_COUNTS(), itemLabelKey(), MapReimportCounts (+65 more)

### Community 4 - "Migrate Services 2"
Cohesion: 0.04
Nodes (95): CONDITION_EXP_TYPES, SECURITY_MANAGER_EXP_TYPES, WorkbookInfo, WorkbookSheet, DEFAULT_ITEM_EXP_TYPES, aggregateFunctionOf(), applyRecords(), axisTypeOf() (+87 more)

### Community 5 - "Frontend Pages 2"
Cohesion: 0.09
Nodes (64): AdminPageWrapper(), AdminPageWrapperProps, CreateEditDialog(), CreateEditDialogProps, DataTable(), DeleteConfirmDialog(), DeleteConfirmDialogProps, AGG_FUNCTIONS (+56 more)

### Community 6 - "Migrate Database"
Cohesion: 0.03
Nodes (71): TargetDatabase, MIGRATION_LOG_DDL, migrationLog, NewMigrationLogRow, AGG_FUNCTION_CHECK(), businessAreas, colorPaletteEnum, conditionTypeEnum (+63 more)

### Community 7 - "Frontend Pages 3"
Cohesion: 0.04
Nodes (53): FolderSharingDialog(), ExecutionPanel(), downloadBlob(), downloadXml(), safeFilename(), triggerDownload(), ShareDialog(), needsParameterPrompt() (+45 more)

### Community 8 - "Backend Tests Integration 1"
Cohesion: 0.04
Nodes (30): exportJobs, MapPageSetup, mapShares, hashPassword(), verifyPassword(), authorize(), authorizeAdmin, Role (+22 more)

### Community 9 - "Migrate Services 3"
Cohesion: 0.05
Nodes (56): defaultedColumns(), BA_COLUMNS, BA_OBJ_LINK_COLUMNS, coerceValue(), ColumnSpec, dbFlag(), DOC_COLUMNS, DOC_CONTENT_COLUMNS (+48 more)

### Community 10 - "Migrate Types"
Cohesion: 0.05
Nodes (63): EulFullData, EulReadResult, OpenedEul, openEul(), ParsedWorkbook, parseWorkbookContent(), parseWorkbooks(), readBusinessAreas() (+55 more)

### Community 11 - "Backend Lib Sql 1"
Cohesion: 0.08
Nodes (50): GenerationContext, effectiveFolderSet, FLIPPED_JOIN, isRowChanging(), JoinPathEdge, JoinPathFolder, spanningJoinPath(), ItemResolver (+42 more)

### Community 12 - "Backend Services 1"
Cohesion: 0.06
Nodes (59): securityRelevantFolderIds(), TotalsPlanEntry, CalculatedFieldSchema, ExecuteBodySchema, handleExecutionError(), HistoryQuerySchema, idParamsSchema, jobParamsSchema (+51 more)

### Community 13 - "Backend Services 2"
Cohesion: 0.06
Nodes (64): MapConditionalFormat, MapLayout, MapShare, dashboardRoutes(), CreateShareBodySchema, mapShareRoutes(), ShareParamSchema, SharePermissionEnum (+56 more)

### Community 14 - "Backend Workers"
Cohesion: 0.06
Nodes (41): buildApp(), assertProductionSecrets(), Config, EnvSchema, INSECURE_DEFAULTS, parsed, recordExportOutcome(), recordScheduleOutcome() (+33 more)

### Community 15 - "Frontend Components Ui"
Cohesion: 0.06
Nodes (54): Header(), Layout(), RouteFallback(), MobileSidebar(), adminNavItems, mainNavItems, mapsNavItems, NavSection() (+46 more)

### Community 16 - "Backend Services 3"
Cohesion: 0.06
Nodes (52): CalculatedFieldSchema, ExportBodySchema, exportRoutes(), idParamsSchema, jobParamsSchema, listQuerySchema, loadOwnJob(), toResponse() (+44 more)

### Community 17 - "Backend Services 4"
Cohesion: 0.08
Nodes (48): addMonths(), CalculatedColumn, CalculatedFieldError, callFunction(), coerceToDate(), ColumnRef, CompareOp, compareValues() (+40 more)

### Community 18 - "Migrate Services Transformers"
Cohesion: 0.05
Nodes (61): axisTypeForPlacement(), buildPageSetup(), indexTotalColumns(), indexWorksheetSorts(), inferParameterType(), makeBindName(), MapConditionRow, MapConditionRowsResult (+53 more)

### Community 19 - "Backend Database"
Cohesion: 0.03
Nodes (53): AuditLogEntry, auditLogRelations, businessAreasRelations, dataSourcesRelations, executionStatusEnum, exportFormatEnum, ExportJob, exportJobsRelations (+45 more)

### Community 20 - "Backend Services 5"
Cohesion: 0.06
Nodes (52): NewFolder, cached(), invalidate(), invalidateAll(), metadataKeys, recordCacheHit(), recordCacheMiss(), BaIdParamSchema (+44 more)

### Community 21 - "Migrate Semantics"
Cohesion: 0.08
Nodes (43): AGGREGATE_FUNCTIONS, containsAggregateCall(), isAllowedFunction(), SCALAR_FUNCTIONS, UNREAGGREGABLE_FUNCTIONS, builtinCode, BY_CODE, DisplayShape (+35 more)

### Community 22 - "Backend Services 6"
Cohesion: 0.08
Nodes (35): CreateBodySchema, historyQuerySchema, idParamsSchema, loadOwnSchedule(), mapIdParamsSchema, ParameterValueSchema, resultParamsSchema, scheduleRoutes() (+27 more)

### Community 23 - "Backend Services 7"
Cohesion: 0.07
Nodes (48): SecurityPolicy, SecurityPolicyAssignment, SecurityPolicyRule, ALIAS_TOKEN_RE, CONTEXT_BIND_NAMES, ContextBindName, FORBIDDEN_KEYWORDS, maskNested() (+40 more)

### Community 24 - "Migrate Root 1"
Cohesion: 0.08
Nodes (42): CliDeps, CliIO, CliUsageError, commandAnalyze(), commandExport(), commandReimportJoins(), commandRun(), commandValidate() (+34 more)

### Community 25 - "Frontend Root 1"
Cohesion: 0.04
Nodes (49): @axe-core/playwright, eslint-config-prettier, eslint-plugin-react-hooks, eslint-plugin-react-refresh, devDependencies, @axe-core/playwright, eslint-config-prettier, eslint-plugin-react-hooks (+41 more)

### Community 26 - "Backend Services 8"
Cohesion: 0.08
Nodes (40): errorResponse, JobParamsSchema, looseData, looseDataArray, migrationRoutes(), normalizeVersion(), ReimportMapsBodySchema, RunBodySchema (+32 more)

### Community 27 - "Backend Tests Integration 2"
Cohesion: 0.07
Nodes (30): securityPolicies, securityPolicyAssignments, securityPolicyRules, JoinType, defaultDeps(), defaultRecordExecution(), captureSql(), cleanup() (+22 more)

### Community 28 - "Frontend Components Data Table"
Cohesion: 0.10
Nodes (41): crosstabAxes, CrosstabTable(), renderValue(), CrosstabTableProps, keyOf(), partsOf(), RowRecord, alignmentClass() (+33 more)

### Community 29 - "Docs Developer Guide 1"
Cohesion: 0.07
Nodes (45): Docker Deployment Guide, Monitoring and Health Checks Guide, SSL/TLS Setup Guide, Let's Encrypt / Certbot, Architecture Overview, Allowlist (AGGREGATE_FUNCTIONS/SCALAR_FUNCTIONS), Fan-Trap Decision Procedure, Formula Renderer (semantics/) (+37 more)

### Community 30 - "Backend Services Exporters"
Cohesion: 0.10
Nodes (27): EXPORT_JOB_OPTIONS, defaultWriteExportFile(), formatDate(), toText(), writeCsv(), rows(), computeWidths(), convertDateMask() (+19 more)

### Community 31 - "Frontend Pages 4"
Cohesion: 0.08
Nodes (33): DataTableProps, CellValue(), Table, TableBody, TableCaption, TableCell, TableFooter, TableHead (+25 more)

### Community 32 - "Migrate Services 4"
Cohesion: 0.11
Nodes (37): commandVerify(), CompileVerdict, checkFormulaCompileRate(), checkMeasureSet(), checkPlannerLive(), checkReconciliation(), checkReferentialClosure(), checkSqlGeneration() (+29 more)

### Community 33 - "Backend Root 1"
Cohesion: 0.05
Nodes (41): dependencies, bcryptjs, bullmq, cron-parser, @discoverer-neo/core, exceljs, fast-csv, fastify (+33 more)

### Community 34 - "Migrate Services 5"
Cohesion: 0.08
Nodes (35): CORPUS_PATH, main(), createBindCollector(), displayMatches(), rootUnwrapped(), FormulaBucket, AgreementResult, AgreementSample (+27 more)

### Community 35 - "Backend Services 9"
Cohesion: 0.10
Nodes (31): validateFormula(), buildPagination(), PaginationResult, refusalError(), bucketFor(), main(), REASONS, main() (+23 more)

### Community 36 - "Backend Root 2"
Cohesion: 0.05
Nodes (38): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+30 more)

### Community 37 - "Frontend E2e"
Cohesion: 0.11
Nodes (25): AXE_TAGS, PAGES, AUTH_USER, base64url(), BUSINESS_AREA, BUSINESS_AREA_2, DATA_SOURCE, EXECUTE_RESULT (+17 more)

### Community 38 - "Backend Scripts 1"
Cohesion: 0.12
Nodes (24): Database, db, pool, rawQuery, decrypt(), decryptWith(), deriveKey(), encrypt() (+16 more)

### Community 39 - "Migrate Testing 1"
Cohesion: 0.12
Nodes (32): createEulSchemaAdapter(), assertSafeIdentifier(), chooseOwner(), detectEulVersionFromExecutor(), EulDetectionError, versionsPresent(), catalogFor(), emptyTables() (+24 more)

### Community 40 - "Backend Lib Sql 2"
Cohesion: 0.10
Nodes (36): FromClauseOptions, axisItemFolders(), axisMapItemIds(), buildBranches(), buildGraph(), collectMeasures(), deriveFolderSet(), FanCandidate (+28 more)

### Community 41 - "Backend Services 10"
Cohesion: 0.09
Nodes (31): cacheOperationsTotal, dbQueryDuration, exportJobDuration, exportJobsTotal, exportQueueDepth, httpErrorsTotal, httpRequestDuration, oraclePoolAcquisitionTimeouts (+23 more)

### Community 42 - "Frontend Providers"
Cohesion: 0.08
Nodes (22): App(), ErrorBoundary, Props, State, Toaster(), queryClient, applyThemeAttribute(), isSupportedTheme() (+14 more)

### Community 43 - "Backend Services 11"
Cohesion: 0.10
Nodes (32): BusinessArea, NewBusinessArea, UserBusinessAreaGrant, businessAreaSchema, businessAreasRoutes(), CreateBodySchema, errorResponse, GrantBodySchema (+24 more)

### Community 44 - "Migrate Testing 2"
Cohesion: 0.12
Nodes (19): CONDITION_OPERATOR_TABLE, buildConditionTokens(), buildWorkbookFixture(), encodeScalar(), encodeStringLength(), FIXTURE_CLASS, FIXTURE_NUMBER, FIXTURE_TAG (+11 more)

### Community 45 - "Backend Tests 1"
Cohesion: 0.15
Nodes (32): Folder, Join, JoinPredicate, Map, MapCalculatedField, MapCondition, MapItem, MapParameter (+24 more)

### Community 46 - "Backend Services 12"
Cohesion: 0.11
Nodes (32): enqueueManualTrigger(), removeScheduleJob(), RUN_SCHEDULE_JOB, SCHEDULE_JOB_OPTIONS, schedulerQueue(), upsertScheduleJob(), buildScheduleResultFilePath(), CreateScheduleInput (+24 more)

### Community 47 - "Migrate Scripts 1"
Cohesion: 0.10
Nodes (32): ALL_DATE_SHAPES, ALL_SHAPES, candidatesFor(), clobberSignals, CodeFit, CORPUS_DIR, CORPUS_PATH, DateShape (+24 more)

### Community 48 - "Migrate Services 6"
Cohesion: 0.08
Nodes (32): assessComplexity(), collectWarnings(), COMPLEXITY_THRESHOLDS, COMPLEXITY_WEIGHTS, ComplexityAssessment, ComplexityFactor, ComplexityScore, countByType() (+24 more)

### Community 49 - "Migrate Scripts 2"
Cohesion: 0.10
Nodes (29): anonymiseDisplay(), anonymiseIo(), buildIdentifierMap(), buildReplacer(), CORPUS_DIR, CORPUS_PATH, DEFAULT_DUMPS_DIR, escapeRe() (+21 more)

### Community 50 - "Migrate Services 7"
Cohesion: 0.16
Nodes (30): capped(), diffCalculations(), expandedTokens(), diffFunctionReferences(), diffItemReferences(), diffJoins(), diffParameters(), diffPrivateFilters() (+22 more)

### Community 51 - "Backend Services 13"
Cohesion: 0.12
Nodes (25): NewItem, CreateBodySchema, FolderIdParamSchema, IdParamSchema, ImportBodySchema, importResultSchema, itemRoutes(), itemSchema (+17 more)

### Community 52 - "Docs User Guide"
Cohesion: 0.14
Nodes (28): Export Formats (XLSX/CSV), Executar Mapas (pt-PT User Guide), Exportar Dados (pt-PT User Guide), Introdução ao Discoverer Neo (pt-PT), Agendar Mapas (pt-PT User Guide), Definições (pt-PT User Guide), Partilhar Mapas (pt-PT User Guide), Why a Worksheet Was Declined (Troubleshooting) (+20 more)

### Community 53 - "Backend Root 3"
Cohesion: 0.07
Nodes (27): scripts, build, db:generate, db:migrate, db:push, db:seed, db:test:reset, db:test:setup (+19 more)

### Community 54 - "Docs Spanish Docs Admin Guide 1"
Cohesion: 0.15
Nodes (27): Área de negocio, Gestión de metadatos (ES), Carpeta, Compartir una carpeta entre áreas de negocio, Jerarquía, Elemento, Combinación, Tipos de combinación (+19 more)

### Community 55 - "Backend Services 14"
Cohesion: 0.14
Nodes (23): Hierarchy, HierarchyLevel, requireBusinessAreaAccess(), BaIdParamSchema, CreateBodySchema, errorResponse, hierarchyLevelSchema, hierarchyRoutes() (+15 more)

### Community 56 - "Backend Services 15"
Cohesion: 0.15
Nodes (24): BaIdParamSchema, CreateBodySchema, FolderIdParamSchema, IdParamSchema, joinRoutes(), joinSchema, joinSuggestionSchema, JoinTypeEnum (+16 more)

### Community 57 - "Docs French Docs User Guide"
Cohesion: 0.11
Nodes (26): Configuración (Página de ajustes, es-ES), Preferencias de idioma, Preferencias de tema, Uso compartido de mapas (es-ES), Niveles de permiso (VIEW/EDIT/EXPORT), Público frente a privado, Création de cartes (fr-FR), Champs calculés (expressions SQL) (+18 more)

### Community 58 - "Backend Services 16"
Cohesion: 0.14
Nodes (22): CustomFunction, CreateBodySchema, customFunctionRoutes(), customFunctionSchema, errorResponse, FunctionTypeEnum, IdParamSchema, ParameterSchema (+14 more)

### Community 59 - "Migrate Services 8"
Cohesion: 0.16
Nodes (19): source(), calculationResolver(), expandCalculations(), walk(), FunctionBinding, ItemBinding, CompileScope, compileStoredFormula() (+11 more)

### Community 60 - "Frontend Root 2"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, baseUrl, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+16 more)

### Community 61 - "Migrate Services 9"
Cohesion: 0.11
Nodes (22): buildEntry(), DumpItemUsage, EulFilterReferenceEntry, EulFunctionReferenceEntry, EulItemReferenceEntry, EulJoinReferenceEntry, EulPrivateFilterEntry, EulPrivateItemEntry (+14 more)

### Community 62 - "Backend Services 17"
Cohesion: 0.16
Nodes (19): buildPromptParameters(), isAbsent(), loadParameterDefinitions(), normalizeParamType(), pad2(), pad4(), PARAM_TYPES, ParameterDefinition (+11 more)

### Community 63 - "Backend Tests Integration 3"
Cohesion: 0.35
Nodes (12): authenticatedRequest(), cleanupIntegrationUsers(), closeApp(), createAdminWithToken(), createTestBusinessArea(), createTestFolder(), createTestItem(), createTestUser() (+4 more)

### Community 64 - "Docs Api"
Cohesion: 0.11
Nodes (23): JWT Bearer Authentication Guide, Redis Token Blacklist on Logout, API Endpoints Reference, Auth Endpoints (login/refresh/logout/me), Business Areas Endpoints, Data Sources Endpoints, Exports Endpoints (async export jobs), Health Check Endpoints (+15 more)

### Community 65 - "Frontend Root 3"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+14 more)

### Community 66 - "Backend Tests Integration 4"
Cohesion: 0.12
Nodes (14): Item, ExecuteOptions, assertSqlContains(), CalcFieldSpec, ConditionSpec, CreateMapConfig, execDeps(), executeTestMap() (+6 more)

### Community 67 - "Backend Services 18"
Cohesion: 0.16
Nodes (20): User, CreateBodySchema, errorResponse, IdParamSchema, RoleEnum, UpdateBodySchema, userRoutes(), userSchema (+12 more)

### Community 68 - "Backend Tests 2"
Cohesion: 0.21
Nodes (17): buildGroupByClause(), DDL, headerLinesFixture(), mkCondition(), mkDef(), mkFolder(), mkItem(), mkJoin() (+9 more)

### Community 69 - "Project Root Config 1"
Cohesion: 0.09
Nodes (21): allowScripts, esbuild@0.25.12, esbuild@0.28.1, oracledb@6.10.0, description, engines, node, npm (+13 more)

### Community 70 - "Project Root Config 2"
Cohesion: 0.09
Nodes (21): ES2024, compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, lib, module (+13 more)

### Community 71 - "Migrate Root 2"
Cohesion: 0.10
Nodes (21): @types/node, @types/oracledb, @types/pg, @types/node, @types/oracledb, @types/pg, devDependencies, jest (+13 more)

### Community 72 - "Backend Services 19"
Cohesion: 0.14
Nodes (19): auditRoutes(), EntityParamsSchema, entrySchema, errorResponse, QuerySchema, StatsQuerySchema, UserParamsSchema, UserQuerySchema (+11 more)

### Community 73 - "Migrate Services 10"
Cohesion: 0.18
Nodes (16): RunCommandOptions, ReadEulOptions, readFolders(), itemKey(), JoinReimportDb, JoinReimportOptions, JoinReimportResult, reimportJoins() (+8 more)

### Community 74 - "Backend Root 4"
Cohesion: 0.10
Nodes (20): devDependencies, bs-logger, drizzle-kit, jest, lodash.memoize, prettier, ts-jest, tsx (+12 more)

### Community 75 - "Backend Services 20"
Cohesion: 0.19
Nodes (18): DataSource, NewDataSource, CreateBodySchema, dataSourcesRoutes(), IdParamSchema, safeDataSourceSchema, UpdateBodySchema, ConnectionTestResult (+10 more)

### Community 76 - "Docs Master Plan Checkpoints 1"
Cohesion: 0.14
Nodes (20): Phase 3.1 Checkpoint: Populate the Measure Set, agg_function CHECK Constraint, items.agg_function Completeness Gap, Measure Set (agg_function), Migration-Verify Seam 5, Phase 3.3 Checkpoint: Fan-Trap Guard Query Planner, Effective Folder Set (D-115), Fan-Trap Guard (+12 more)

### Community 77 - "Docs Migration"
Cohesion: 0.12
Nodes (20): Migrating from Oracle Discoverer 4-11, Manual-Migration-Required Items, Workbook-to-Map Mapping, Migration Tool (dn-migrate) Reference, dn-migrate CLI Commands, One Migration Per Database Rule, Thin vs Thick Oracle Connection Mode, Migration Troubleshooting (+12 more)

### Community 78 - "Frontend Root 4"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, composite, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution (+11 more)

### Community 79 - "Migrate Root 3"
Cohesion: 0.11
Nodes (19): drizzle-orm, oracledb, drizzle-orm, oracledb, dependencies, drizzle-orm, oracledb, pg (+11 more)

### Community 80 - "Backend Tests Integration 5"
Cohesion: 0.11
Nodes (7): auditLog, createTestUser(), cleanupMigratedRows(), createUser(), idLike(), MIGRATED_BA_NAMES, MIGRATED_EMAILS

### Community 81 - "Migrate Root 4"
Cohesion: 0.16
Nodes (19): CLAUDE.md Pointer to EUL Ground Truth, EUL_SCHEMA_GROUND_TRUTH.md (verified EUL schema reference), ACCESS_PRIVS — privileges/grants table, EUL5_BAS / EUL4_BAS — Business Areas table, Parameter name vs bind_name derivation, The .DIS workbook body container format (DOC_DOCUMENT), DOCUMENTS — workbooks table, EUL_USERS — users table (+11 more)

### Community 82 - "Project Root Config 3"
Cohesion: 0.14
Nodes (18): Docker Build & Push CI Workflow, docker-compose.yml Base/General-Purpose Compose, docker-compose.dev.yml Development Overlay, docker-compose.prod.yml Production Compose (Nginx TLS front), Managing Data Sources (Oracle/PostgreSQL), Oracle Thin vs Thick Connection Mode, isSensitiveKey Credential Redaction Rule in Audit Log, Backup and Restore Strategy (+10 more)

### Community 84 - "Docs Troubleshooting"
Cohesion: 0.14
Nodes (18): Why a Calculation Was Declined, BAD_ARITY refusal (unexpected argument count), CALCULATION_CYCLE refusal (calculation loop), DATE_WITH_TIME refusal (date carries a time component), EXPANSION_TOO_DEEP / EXPANSION_TOO_LARGE refusal (calculation chain limits), INVALID_IDENTIFIER refusal (illegal Oracle identifier), NO_SOURCE_TOKENS refusal (missing token tree from old migration), NOT_IN_ALLOWLIST refusal (SQL function outside emit allowlist) (+10 more)

### Community 85 - "Project Root Config 4"
Cohesion: 0.12
Nodes (17): eslint, globals, typescript, typescript-eslint, eslint, typescript, devDependencies, eslint (+9 more)

### Community 86 - "Backend Middleware"
Cohesion: 0.21
Nodes (16): attachBusinessAreaPermissions(), businessAreasOfFolder(), fastify, FastifyInstance, hierarchyBusinessAreaIds(), itemBusinessAreaIds(), joinBusinessAreaIds(), OwnedEntity (+8 more)

### Community 87 - "Backend Services 21"
Cohesion: 0.16
Nodes (14): COLOR_PALETTE_VALUES, errorResponse, LOCALE_VALUES, preferencesSchema, THEME_VALUES, UpdateBodySchema, userPreferencesRoutes(), ColorPalette (+6 more)

### Community 88 - "Backend Scripts 2"
Cohesion: 0.14
Nodes (14): condition, def, detail, fail(), filterItem, generated, itemById, mapItem (+6 more)

### Community 89 - "Docs Admin Guide"
Cohesion: 0.16
Nodes (16): Decision 1: Folder↔Business Area Is Many-to-Many (owning + shares), Decision 3: Grantees Can Be Database Roles (users.is_role), Audit Logging (Admin Guide), Metadata Management (BA/Folder/Item/Join/Hierarchy hierarchy), Sharing a Folder Across Business Areas, Join Settings: Outer-on-Detail/Master, One-to-One, Mandatory, Oracle Introspection (Auto-Discover Tables/Views), Security Policies (Row-Level Security) (+8 more)

### Community 90 - "Docs Master Plan Checkpoints 2"
Cohesion: 0.15
Nodes (16): Phase 4.2 Checkpoint: Top-10 Formula Renderer, Built-in Codes Renderer (20 Codes), displayMatches Comparator, No Precedence Table Decision (D-051), Phase 4.2 Quarantine Histogram, Shared Function Allowlist, Phase 4.3 Checkpoint: The Tail, Custom Functions, Date Literals, Clean-Subset 99% Gate (+8 more)

### Community 91 - "Migrate Scripts 3"
Cohesion: 0.23
Nodes (14): emptyTally(), fmtPct(), initThickModeIfConfigured(), main(), Manifest, parseArgs(), printSectionSummary(), emptyExpansionTally() (+6 more)

### Community 92 - "Backend Plugins 1"
Cohesion: 0.19
Nodes (11): ACTION_SEGMENTS, AuditPluginOptions, DEFAULT_EXCLUDE_PREFIXES, deriveEntity(), extractLoginUserId(), extractResponseId(), isSensitiveKey(), MUTATING_METHODS (+3 more)

### Community 93 - "Backend Tests 3"
Cohesion: 0.29
Nodes (14): estateDef(), fromClauseFor(), mkDef(), mkFolder(), mkItem(), mkJoin(), mkMap(), mkMapItem() (+6 more)

### Community 94 - "Docs French Docs Admin Guide 1"
Cohesion: 0.16
Nodes (14): backend/src/__tests__/audit-redaction.test.ts (fixes the redaction rule), Journalisation d'audit (fr-FR), Conservation et export des journaux d'audit, Types d'événement d'audit (MAP, USER, SECURITY_POLICY, ...), Stratégies de sécurité (fr-FR), Expurgation des identifiants dans le journal d'audit (règle isSensitiveKey par sous-chaîne), Migration 0011_purge_audit_log_credentials, Contexte de sécurité utilisateur (SYS_CONTEXT paires clé-valeur) (+6 more)

### Community 95 - "Docs Master Plan Checkpoints 3"
Cohesion: 0.15
Nodes (14): backend/src/__tests__/sql-generator.test.ts (D-014 MULTI_FOLDER_AGGREGATE refusal test), map-execution.ts (KIND_STATUS, FORBIDDEN execution-error kind), Pourquoi une feuille a été refusée (fr-FR), Pièges en éventail FAN_TRAP_R1-R4, FAN_TRAP_REAGG, NO_JOIN_PATH (dossiers non reliés), Panneau de refus (ambre, distinct du panneau d'erreur rouge), Phase 2.2 checkpoint — Wire Run, and the error surface, The client does not guess entitlement — only 'no output columns' is a client-side disabled reason (+6 more)

### Community 96 - "Backend Tests Integration 6"
Cohesion: 0.14
Nodes (5): ScheduledResultRecord, FakeResultStore, FakeScheduleStore, makeDeps(), makePrepared()

### Community 97 - "Docs Portuguese Docs Admin Guide 1"
Cohesion: 0.14
Nodes (14): Migrated-With-Caveats Items, Registo de Auditoria, Audit Event Types, Audit Retention and Export, Políticas de Segurança, Audit Log Credential Redaction Rule, Security Context Values, Row-Level Security Policies (+6 more)

### Community 98 - "Frontend Root 5"
Cohesion: 0.15
Nodes (13): axios, dependencies, axios, monaco-editor, @monaco-editor/react, react-hook-form, recharts, zustand (+5 more)

### Community 99 - "Frontend Hooks"
Cohesion: 0.22
Nodes (12): ToastActionElement, Action, dispatch(), genId(), listeners, memoryState, queueRemove(), reducer() (+4 more)

### Community 100 - "Migrate Root 5"
Cohesion: 0.15
Nodes (13): default, types, exports, ./db/schema, ./migration, ./semantics, ./testing, default (+5 more)

### Community 101 - "Backend Services 22"
Cohesion: 0.24
Nodes (9): buildCredentialCsv(), CredentialFileResult, credentialsDir(), CredentialSweepResult, csvCell(), sweepCredentialFiles(), writeCredentialFile(), NOW (+1 more)

### Community 102 - "Migrate Services 11"
Cohesion: 0.35
Nodes (10): buildConnectString(), EulConnectionError, getConnection(), getPool(), initThickModeOnce(), isAlreadyInitialized(), loadOracleDb(), OracleDbModule (+2 more)

### Community 103 - "Docs Decisions"
Cohesion: 0.22
Nodes (11): Decision 0: CO/CI Item-Type Labels Were Inverted (bug fix), Decision 2: Hierarchies Are a Tree, Not Numbered Levels, Decision 4: Folder Types — Neo Keeps a Richer Vocabulary, Decision 5: Measure Named by Workbook, Aggregate by the EUL, Decision 6: Formulas Rendered from Token Tree, Never Re-Parsed from Display Form, Decision 7: Calculation-Referencing-Calculation Expanded at Render Time, Custom Functions (SQL/PLSQL), Migrated Formula Function-Call Resolution (token → workbook element → registry) (+3 more)

### Community 104 - "Docs Master Plan Checkpoints 4"
Cohesion: 0.24
Nodes (11): Phase 4.4 Checkpoint: Calculation Expansion and CI Gate, Calculation-Reference Expansion (expand.ts), CI Gate (formula-corpus-agreement), D-059 Four-Bucket Partition, Phase 4.5 Checkpoint: Compile the Estate, BE-05 ORA-00979 Fix, Compile Run (Seam 2), Dual Storage (D-055) (+3 more)

### Community 105 - "Docs Portuguese Docs Admin Guide 2"
Cohesion: 0.22
Nodes (11): Migrated User Accounts and Temporary Passwords, Migration Credentials File, Temporary Password Provisioning, Gestão de Utilizadores, Business Area Permission Levels, Database Roles vs People, Temporary Password Workflow, Permission Model / User Roles (+3 more)

### Community 106 - "Frontend Root 6"
Cohesion: 0.18
Nodes (11): scripts, analyze, build, dev, e2e, e2e:ui, format, lint (+3 more)

### Community 108 - "Migrate Root 6"
Cohesion: 0.18
Nodes (11): scripts, build, cli, dev, fit-codes, lint, rebuild-corpus, render-corpus (+3 more)

### Community 109 - "Scripts Root 1"
Cohesion: 0.29
Nodes (10): checkLocale(), checkNamespace(), collectKeySet(), __dirname, getByPath(), loadJson(), locales, LOCALES_DIR (+2 more)

### Community 110 - "Backend Root 5"
Cohesion: 0.20
Nodes (9): description, engines, node, name, overrides, uuid, private, type (+1 more)

### Community 111 - "Backend Scripts 3"
Cohesion: 0.25
Nodes (7): adminClient(), dbName, ensureDatabase(), here, MIGRATIONS_DIR, recreate, url

### Community 112 - "Docs Master Plan Checkpoints 5"
Cohesion: 0.25
Nodes (9): Phase 3.2 Checkpoint: The Join Model, Characterisation Tests (from-clause.test.ts), Join Orientation Fix (D-040), Join Predicates Model (joins + join_predicates), Join Type Derivation Table, dn-migrate reimport-joins Tool, EUL Migration Pipeline, Maps Re-import Tool (+1 more)

### Community 113 - "Backend Plugins 2"
Cohesion: 0.25
Nodes (6): fastify, @fastify/jwt, FastifyInstance, FastifyJWT, JwtPayload, PASSWORD_CHANGE_EXEMPT_ROUTES

### Community 114 - "Migrate Scripts 4"
Cohesion: 0.32
Nodes (8): export-datasource-password.ts — throwaway plaintext password exporter, export-workbook-bytes.ts — throwaway DOC_DOCUMENT byte exporter, list-eul-documents.ts — read-only EUL document manifest generator, diff-corpus.ts — CLI diffing dumped corpus against the parser, dump-corpus.ps1 — batch-drives d4wkdmp.exe over a live EUL, Workbook Parser Verification Harness README, d4wkdmp-differ.ts — compares dump against parseWorkbookDocument output, d4wkdmp-dump-parser.ts — parses d4wkdmp -f text output

### Community 115 - "Frontend Pages 5"
Cohesion: 0.29
Nodes (4): HierarchiesPage(), addLevel(), openEdit(), newDraftKey()

### Community 116 - "Migrate Root 7"
Cohesion: 0.25
Nodes (7): bin, dn-migrate, description, name, private, type, version

### Community 117 - "Migrate Services 12"
Cohesion: 0.43
Nodes (8): columnDisplayName(), diffSheets(), emptyTally(), normalize(), sheetUsage(), tallyOne(), worksheetAxis(), worksheetSortItems()

### Community 118 - "Docs I18n"
Cohesion: 0.33
Nodes (7): Glosario es-ES, Término 'Combinación' (Join) — referencia Microsoft SQL Server es-ES, Término 'Mapa' (es-ES, deliberadamente no 'Informe' ni 'Panel'), Glossaire fr-FR, Terme « Carte » (fr-FR, deliberadamente pas « Rapport » ni « Tableau de bord »), Glossário pt-PT, Termo «Mapa» (pt-PT, deliberadamente não «Relatório» nem «Painel»)

### Community 119 - "Migrate Services 13"
Cohesion: 0.48
Nodes (5): generateTemporaryPassword(), pick(), ProvisionedCredential, shuffle(), TEMPORARY_PASSWORD_LENGTH

### Community 120 - "Backend Tests Setup"
Cohesion: 0.80
Nodes (4): databaseNameOf(), DEFAULT_TEST_DATABASE_URL, isTestDatabaseUrl(), resolveTestDatabaseUrl()

### Community 121 - "Docs French Docs Admin Guide 2"
Cohesion: 0.33
Nodes (6): Sources de données (fr-FR), Chiffrement des connexions (AES-256-GCM, ENCRYPTION_KEY), Regroupement de connexions (ORACLE_POOL_*), Mode Thin vs Thick (client Oracle), Introspection Oracle (fr-FR), Correspondance des types de données Oracle → génériques

### Community 122 - "Docs Developer Guide 2"
Cohesion: 0.33
Nodes (6): assertDataEntitlement (Data Gate), canAccessMap (Object Gate), resolveSecurityPredicates (Rows Gate), Two Authorisation Gates, Row-Level Security (RLS), SYS_CONTEXT Predicate

### Community 123 - "Frontend Root 7"
Cohesion: 0.33
Nodes (5): description, name, private, type, version

### Community 125 - "Backend Tests 4"
Cohesion: 0.40
Nodes (3): BACKEND_SCHEMA, CORE_SCHEMA, SHARED_TABLES

### Community 126 - "Docs Developer Guide 3"
Cohesion: 0.50
Nodes (5): @discoverer-neo/core Package, One Schema, Two Workspaces, backend/src/db/schema.ts Re-export, migrate/ Needs Rebuild, backend/src Does Not, @discoverer-neo/core Resolves to Source in Tests

### Community 127 - "Docs Developer Guide 4"
Cohesion: 0.40
Nodes (5): JWT Authentication Flow, Axios API Client, Password Management / Temporary Passwords, Login, Temporary Password First Login

### Community 129 - "Project Root Config 5"
Cohesion: 0.50
Nodes (4): @eslint/js, @eslint/js, @eslint/js, @eslint/js

### Community 131 - "Docs Spanish Docs Admin Guide 2"
Cohesion: 0.50
Nodes (4): Oracle Instant Client (Thick Mode Build Arg), Oracle Data Source (Optional), Oracle Thick Mode (Legacy 11.2+), Oracle Thin Mode (Default)

### Community 132 - "Docs French Docs Admin Guide 3"
Cohesion: 0.67
Nodes (3): Fonctions personnalisées (fr-FR), Limites des fonctions personnalisées (pas d'effets de bord, valeur de retour unique), Fonctions SQL vs PLSQL

### Community 133 - "Docs Developer Guide 5"
Cohesion: 0.67
Nodes (3): Redis Cache & Job Queue, Background Workers (export.worker.ts), Async / Background Execution

## Ambiguous Edges - Review These
- `Log Levels (fatal..trace)` → `Cron Expressions`  [AMBIGUOUS]
  docs/es-ES/user-guide/scheduling.md · relation: semantically_similar_to
- `Items Endpoints` → `OpenAPI Specification (openapi.yaml)`  [AMBIGUOUS]
  docs/api/openapi.yaml · relation: references
- `POST /api/migration/reimport-maps Endpoint` → `OpenAPI Specification (openapi.yaml)`  [AMBIGUOUS]
  docs/api/openapi.yaml · relation: references
- `Discoverer Neo Documentation Index` → `Discoverer Neo Project README`  [AMBIGUOUS]
  README.md · relation: references

## Knowledge Gaps
- **1248 isolated node(s):** `SetLocaleOptions`, `Resources`, `JwtPayload`, `AuditFilterState`, `FormValues` (+1243 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1628 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **96 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Log Levels (fatal..trace)` and `Cron Expressions`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `Items Endpoints` and `OpenAPI Specification (openapi.yaml)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `POST /api/migration/reimport-maps Endpoint` and `OpenAPI Specification (openapi.yaml)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Discoverer Neo Documentation Index` and `Discoverer Neo Project README`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `Phase 2.2 checkpoint — Wire Run, and the error surface` connect `Docs Master Plan Checkpoints 3` to `Frontend Pages 1`, `Frontend Pages 2`, `Frontend Components Ui`?**
  _High betweenness centrality (0.248) - this node is a cross-community bridge._
- **Why does `Expurgation des identifiants dans le journal d'audit (règle isSensitiveKey par sous-chaîne)` connect `Docs French Docs Admin Guide 1` to `Backend Plugins 1`, `Docs Master Plan Checkpoints 3`?**
  _High betweenness centrality (0.248) - this node is a cross-community bridge._
- **Why does `Panneau de refus (ambre, distinct du panneau d'erreur rouge)` connect `Docs Master Plan Checkpoints 3` to `Docs French Docs User Guide`?**
  _High betweenness centrality (0.248) - this node is a cross-community bridge._