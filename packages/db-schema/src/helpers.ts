import type { SqliteIndexDef, SqliteTableDef, TableModule } from './types.js';

export function renderCreateTableSql(table: SqliteTableDef): string {
  const pkCols = table.columns.filter((c) => c.primaryKey).map((c) => c.name);
  const compositePk = pkCols.length > 1;

  const colDefs = table.columns.map((col) => {
    const parts: string[] = [col.name, col.type];
    if (col.primaryKey && !compositePk) parts.push('PRIMARY KEY');
    if (col.notNull || (compositePk && col.primaryKey)) parts.push('NOT NULL');
    if (col.defaultValue !== undefined) parts.push(`DEFAULT ${col.defaultValue}`);
    if (col.references) parts.push(`REFERENCES ${col.references}`);
    return parts.join(' ');
  });

  if (compositePk) {
    colDefs.push(`PRIMARY KEY (${pkCols.join(', ')})`);
  }

  if (table.uniqueConstraints) {
    for (const cols of table.uniqueConstraints) {
      colDefs.push(`UNIQUE(${cols.join(', ')})`);
    }
  }

  return `CREATE TABLE IF NOT EXISTS ${table.name} (${colDefs.join(', ')});`;
}

export function renderCreateIndexSql(tableName: string, index: SqliteIndexDef): string {
  const unique = index.unique ? 'UNIQUE ' : '';
  return `CREATE ${unique}INDEX IF NOT EXISTS ${index.name} ON ${tableName} (${index.columns.join(', ')});`;
}

export function tableFromDef(def: SqliteTableDef): TableModule {
  return {
    tableName: def.name,
    createTableSql: renderCreateTableSql(def),
    createIndexSqls: (def.indexes ?? []).map((idx) => renderCreateIndexSql(def.name, idx)),
  };
}
