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

  containsAggregate = false;

  constructor(private def: MapDefinition) {
    for (const { folder } of def.items) this.registerFolder(folder);
    for (const { folder } of def.conditions) this.registerFolder(folder);
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

  /** Assign (or return) the alias for a folder; marks the folder as used. */
  aliasFor(folderId: string): string {
    const existing = this.aliases.get(folderId);
    if (existing) return existing;
    this.getFolder(folderId);
    const alias = `f${this.aliases.size + 1}`;
    this.aliases.set(folderId, alias);
    return alias;
  }

  /** Folders referenced by the query, in first-use order. */
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

  /** Resolver used by formula parsing: item name → SQL expression. */
  resolveFormulaReference(name: string): string | null {
    const entry = this.formulaItemsByName.get(name.toUpperCase());
    if (!entry) return null;
    return this.itemExpression(entry.item, entry.folder);
  }
}
