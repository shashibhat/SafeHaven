import sqlite3 from 'sqlite3';
import { Database as SQLiteDatabase } from 'sqlite3';
import { Camera } from '@security-system/shared';

export class Database {
  private db: SQLiteDatabase;

  constructor(dbPath: string) {
    this.db = new sqlite3.Database(dbPath);
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
    const dbPath = process.env.DATABASE_PATH || './data/security.db';
    dbInstance = new Database(dbPath);
  }
  return dbInstance;
};