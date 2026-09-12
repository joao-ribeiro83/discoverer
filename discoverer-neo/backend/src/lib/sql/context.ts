import type { Folder, Item } from '../../db/schema.js';
import { SqlGenerationError, type MapDefinition } from '../../types/sql.js';
import { quoteIdentifier } from './identifiers.js';
import { parseFormula } from './formula-parser.js';

/**
 * Shared state for one SQL generation run: folder → alias assignment,
 * item → SQL expression resolution (including nested formulas), and
 * tracking of which folders the query actually touches.
 */
export class GenerationContext {
  private aliases = new globalThis.Map<string, string>();
  private folderById = new globalThis.Map<string, Folder>();
  /** Items addressable from formulas, keyed by UPPERCASE item name. */
  private formulaItemsByName = new globalThis.Map<
    string,
    { item: Item; folder: Folder }
  >();
  /** Guards against circular formula references. */
  private resolutionStack: string[] = [];
  /**
   * The folders the plan admits, or null when this context is deriving that
   * set in the first place (`effectiveFolderSet`).
   */
  private admitted: Set<string> | null;

  containsAggregate = false;

  /**
   * @param admittedFolderIds the query plan's folder set. When given, `aliasFor`
   * may only NAME a folder the plan already contains — it stops being the thing
   * that decides membership (D-018). Omit it only where the set is still being
   * derived.
   */
  constructor(
    private def: MapDefinition,
    admittedFolderIds?: readonly string[],
  ) {
    this.admitted = admittedFolderIds ? new Set(admittedFolderIds) : null;
    for (const { folder } of def.items) this.registerFolder(folder);
    // A condition on a calculated field carries no folder of its own — the
    // formula it resolves through references items whose OWN entries (in
    // `def.items`, `def.formulaItems`) already registered theirs.
    for (const { folder } of def.conditions) if (folder) this.registerFolder(folder);
    for (const entry of def.formulaItems) {
      this.registerFolder(entry.folder);
      this.formulaItemsByName.set(entry.item.name.toUpperCase(), entry);
    }
    for (const j of def.joins) {
      this.registerFolder(j.leftFolder);
      this.registerFolder(j.rightFolder);
    }
  }

  private registerFolder(folder: Folder): void {
    if (!this.folderById.has(folder.id)) {
      this.folderById.set(folder.id, folder);
    }
  }

  getFolder(folderId: string): Folder {
    const folder = this.folderById.get(folderId);
    if (!folder) {
      throw new SqlGenerationError(`Unknown folder "${folderId}"`);
    }
    return folder;
  }

  /**
   * Assign (or return) the alias for a folder.
   *
   * **Naming only.** Before Phase 3.3 this method also decided which folders
   * the query touched: the FROM clause read the accumulated keys back out and
   * took the first one as its root, so the root was whichever clause builder
   * happened to alias a folder first. A planner placed ahead of generation then
   * had no folder set to plan over, and re-derived one by its own means — which
   * is how the two derivations that produced the Phase 1.1 RLS bypass came to
   * disagree. The plan now supplies the set; this only hands out names.
   */
  aliasFor(folderId: string): string {
    const existing = this.aliases.get(folderId);
    if (existing) return existing;
    const folder = this.getFolder(folderId);
    if (this.admitted && !this.admitted.has(folderId)) {
      throw new SqlGenerationError(
        `Folder "${folder.name}" is not in the query plan's folder set`,
      );
    }
    const alias = `f${this.aliases.size + 1}`;
    this.aliases.set(folderId, alias);
    return alias;
  }

  /**
   * Folders that have been given an alias so far, in first-use order.
   *
   * This is generation state, not a property of the map. `effectiveFolderSet`
   * reads it to DERIVE the plan's folder set; nothing downstream of the planner
   * should ask a half-built context which folders the query uses.
   */
  usedFolderIds(): string[] {
    return [...this.aliases.keys()];
  }

  /**
   * SQL expression for a metadata item: a qualified column reference for
   * plain column items, or the parsed formula for calculated items.
   */
  itemExpression(item: Item, folder: Folder): string {
    if (item.formula && item.formula.trim()) {
      if (this.resolutionStack.includes(item.id)) {
        throw new SqlGenerationError(
          `Circular formula reference involving item "${item.name}"`,
        );
      }
      this.resolutionStack.push(item.id);
      try {
        const parsed = parseFormula(item.formula, (name) =>
          this.resolveFormulaReference(name),
        );
        if (parsed.containsAggregate) this.containsAggregate = true;
        return `(${parsed.sql})`;
      } finally {
        this.resolutionStack.pop();
      }
    }

    if (item.columnName) {
      const alias = this.aliasFor(folder.id);
      return `${alias}.${quoteIdentifier(item.columnName)}`;
    }

    throw new SqlGenerationError(
      `Item "${item.name}" has neither a column nor a formula`,
    );
  }

  /**
   * `itemExpression`, plus whether *this* item's own expression aggregates.
   *
   * `containsAggregate` on the context is cumulative — once any formula in the
   * run aggregates it stays set — which answers "does the statement need a
   * GROUP BY" but not "may I wrap this expression in SUM()". A total over a
   * calculation that already reads `SUM(AMOUNT)` must be emitted unwrapped, so
   * `totals.ts` asks per item and this narrows the flag to one call.
   */
  itemExpressionInfo(
    item: Item,
    folder: Folder,
  ): { sql: string; containsAggregate: boolean } {
    const before = this.containsAggregate;
    this.containsAggregate = false;
    let local = false;
    try {
      const sql = this.itemExpression(item, folder);
      local = this.containsAggregate;
      return { sql, containsAggregate: local };
    } finally {
      this.containsAggregate = before || local;
    }
  }

  /** Resolver used by formula parsing: item name → SQL expression. */
  resolveFormulaReference(name: string): string | null {
    const entry = this.formulaItemsByName.get(name.toUpperCase());
    if (!entry) return null;
    return this.itemExpression(entry.item, entry.folder);
  }
}
