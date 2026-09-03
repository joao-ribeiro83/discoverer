/**
 * Test fixtures shipped with the migrate package (`@discoverer-neo/core/testing`).
 *
 * These exist so other workspaces — currently the backend's migration-service
 * tests — can drive the migration pipeline hermetically, with a mock Oracle
 * source and an in-memory target, instead of duplicating the fixtures.
 */

export * from './mock-eul.js';
export * from './fake-writer.js';
export * from './workbook-fixture.js';
