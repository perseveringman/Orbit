export type SqliteColumnType = 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';

export interface SqliteColumnDef {
  readonly name: string;
  readonly type: SqliteColumnType;
  readonly notNull?: boolean;
  readonly primaryKey?: boolean;
  readonly defaultValue?: string;
  readonly references?: string;
}

export interface SqliteIndexDef {
  readonly name: string;
  readonly columns: readonly string[];
  readonly unique?: boolean;
}

export interface SqliteTableDef {
  readonly name: string;
  readonly columns: readonly SqliteColumnDef[];
  readonly indexes?: readonly SqliteIndexDef[];
  readonly uniqueConstraints?: readonly (readonly string[])[];
}

export interface TableModule {
  readonly tableName: string;
  readonly createTableSql: string;
  readonly createIndexSqls: readonly string[];
}
