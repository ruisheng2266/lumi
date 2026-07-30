/**
 * src/db.ts
 * Dexie schema（LumiDB v1，PRD §7）
 */
import Dexie, { type Table } from 'dexie';

export interface Period {
  id?: number;
  startDate: string; // 'YYYY-MM-DD'
  endDate?: string;
  flow?: 'light' | 'medium' | 'heavy';
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DailyLog {
  id?: number;
  date: string; // 'YYYY-MM-DD'（唯一）
  mood?: 1 | 2 | 3 | 4 | 5;
  energy?: 1 | 2 | 3 | 4 | 5;
  sleepHours?: number;
  /** 基础体温（℃），备孕模式录入（v0.5） */
  bbt?: number;
  symptoms?: string[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  id?: number;
  displayName?: string;
  avgCycleLen: number;
  avgPeriodLen: number;
  createdAt: number;
  updatedAt: number;
}

export interface Setting<T = unknown> {
  key: string;
  value: T;
}

export class LumiDB extends Dexie {
  periods!: Table<Period, number>;
  dailyLogs!: Table<DailyLog, number>;
  userProfile!: Table<UserProfile, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super('LumiDB');

    // v1 schema
    this.version(1).stores({
      periods: '++id, startDate, endDate, createdAt',
      dailyLogs: '++id, &date, createdAt, updatedAt',
      userProfile: '++id',
      settings: '&key',
    });
  }
}

export const db = new LumiDB();

// Repository: Periods
export const periodRepo = {
  async add(p: Omit<Period, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = Date.now();
    return await db.periods.add({ ...p, createdAt: now, updatedAt: now });
  },
  async list(): Promise<Period[]> {
    return await db.periods.orderBy('startDate').reverse().toArray();
  },
  async update(id: number, patch: Partial<Period>) {
    return await db.periods.update(id, { ...patch, updatedAt: Date.now() });
  },
  async remove(id: number) {
    return await db.periods.delete(id);
  },
};

// Repository: DailyLogs
export const dailyLogRepo = {
  async upsertByDate(date: string, log: Omit<DailyLog, 'id' | 'date' | 'createdAt' | 'updatedAt'>) {
    const now = Date.now();
    const existing = await db.dailyLogs.where('date').equals(date).first();
    if (existing?.id) {
      await db.dailyLogs.update(existing.id, { ...log, updatedAt: now });
      return existing.id;
    }
    return await db.dailyLogs.add({ ...log, date, createdAt: now, updatedAt: now });
  },
  async getByDate(date: string) {
    return await db.dailyLogs.where('date').equals(date).first();
  },
  async list() {
    return await db.dailyLogs.orderBy('date').reverse().toArray();
  },
  async remove(id: number) {
    return await db.dailyLogs.delete(id);
  },
};

// Repository: UserProfile
export const userProfileRepo = {
  async get(): Promise<UserProfile | undefined> {
    const list = await db.userProfile.toArray();
    return list[0];
  },
  async upsert(p: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>) {
    const existing = await this.get();
    const now = Date.now();
    if (existing?.id) {
      await db.userProfile.update(existing.id, { ...p, updatedAt: now });
      return existing.id;
    }
    return await db.userProfile.add({ ...p, createdAt: now, updatedAt: now });
  },
};

// Repository: Settings
export const settingsRepo = {
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const s = await db.settings.get(key);
    return s?.value as T | undefined;
  },
  async set<T = unknown>(key: string, value: T) {
    return await db.settings.put({ key, value });
  },
};