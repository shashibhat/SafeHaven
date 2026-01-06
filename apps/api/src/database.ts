import sqlite3 from 'sqlite3';
import { Database as SQLiteDatabase } from 'sqlite3';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

export class Database {
  private db: SQLiteDatabase;

  constructor(dbPath: string) {
    this.db = new sqlite3.Database(dbPath);
  }

  async initialize(): Promise<void> {
    const migrationsPath = path.resolve(__dirname, '../../../migrations');
    const migrationFiles = await fs.readdir(migrationsPath);

    await this.exec(
      'CREATE TABLE IF NOT EXISTS __migrations (name TEXT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
    );

    // Sort migration files by name
    migrationFiles.sort();

    for (const file of migrationFiles) {
      if (!file.endsWith('.sql')) continue;

      const applied = await this.get<{ name: string }>(
        'SELECT name FROM __migrations WHERE name = ? LIMIT 1',
        [file]
      );
      if (applied) {
        continue;
      }

      let sql = await fs.readFile(path.join(migrationsPath, file), 'utf-8');
      // Make migration idempotent
      sql = sql
        .replace(/CREATE TABLE\s+/gi, 'CREATE TABLE IF NOT EXISTS ')
        .replace(/CREATE INDEX\s+/gi, 'CREATE INDEX IF NOT EXISTS ')
        .replace(/INSERT INTO\s+/gi, 'INSERT OR IGNORE INTO ');

      await this.exec(sql);
      await this.run('INSERT INTO __migrations (name) VALUES (?)', [file]);
      console.log(`Applied migration: ${file}`);
    }
  }

  async exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  }

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  async run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

let dbInstance: Database | null = null;

export const getDatabase = (): Database => {
  if (!dbInstance) {
    const defaultPath = path.resolve(__dirname, '../../../data/security.db');
    const dbPath = process.env.DATABASE_PATH || defaultPath;
    const dir = path.dirname(dbPath);
    try {
      require('fs').mkdirSync(dir, { recursive: true });
    } catch {}
    dbInstance = new Database(dbPath);
  }
  return dbInstance;
};
