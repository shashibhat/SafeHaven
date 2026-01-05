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
    const migrationsPath = path.join(__dirname, '../../migrations');
    const migrationFiles = await fs.readdir(migrationsPath);
    
    // Sort migration files by name
    migrationFiles.sort();
    
    for (const file of migrationFiles) {
      if (file.endsWith('.sql')) {
        const sql = await fs.readFile(path.join(migrationsPath, file), 'utf-8');
        await this.exec(sql);
        console.log(`Applied migration: ${file}`);
      }
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
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/security.db');
    dbInstance = new Database(dbPath);
  }
  return dbInstance;
};