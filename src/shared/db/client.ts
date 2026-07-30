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

/** 洞察分类开关偏好（PRD §7 / 审计 #3）：key 为洞察分类名，enabled 表示是否展示 */
export interface InsightPref {
  key: string;
  enabled: boolean;
}

/** 特殊生理场景事件类型（v0.4 审计项：特殊生理场景） */
export type LifeEventType =
  | 'pregnancy' // 怀孕
  | 'miscarriage' // 流产 / 小产
  | 'birth' // 分娩
  | 'hysterectomy' // 子宫切除
  | 'menopause' // 绝经
  | 'birthControlStart' // 开始避孕（如 IUD）
  | 'birthControlStop'; // 停止避孕

/** 特殊生理场景事件（不影响健康日记，仅用于调整预测与展示） */
export interface LifeEvent {
  id?: number;
  type: LifeEventType;
  date: string; // 'YYYY-MM-DD'
  endDate?: string; // 主要用于 pregnancy 标记结束（分娩/流产另用独立事件）
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export class LumiDB extends Dexie {
  periods!: Table<Period, number>;
  dailyLogs!: Table<DailyLog, number>;
  userProfile!: Table<UserProfile, number>;
  settings!: Table<Setting, string>;
  insightPrefs!: Table<InsightPref, string>;
  lifeEvents!: Table<LifeEvent, number>;

  constructor() {
    super('LumiDB');

    // v1 schema
    this.version(1).stores({
      periods: '++id, startDate, endDate, createdAt',
      dailyLogs: '++id, &date, createdAt, updatedAt',
      userProfile: '++id',
      settings: '&key',
    });

    // v2 schema: 增加洞察分类偏好表（审计 #3）
    this.version(2).stores({
      insightPrefs: '&key',
    });

    // v3 schema: 增加特殊生理场景事件表（v0.4）
    this.version(3).stores({
      lifeEvents: '++id, date, type, createdAt',
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

// Repository: InsightPrefs (洞察分类开关持久化)
export const insightPrefRepo = {
  async getAll(): Promise<Record<string, boolean>> {
    const all = await db.insightPrefs.toArray();
    const map: Record<string, boolean> = {};
    for (const p of all) map[p.key] = p.enabled;
    return map;
  },
  async get(key: string): Promise<boolean | undefined> {
    const p = await db.insightPrefs.get(key);
    return p?.enabled;
  },
  async set(key: string, enabled: boolean) {
    return await db.insightPrefs.put({ key, enabled });
  },
};

// Repository: LifeEvents (特殊生理场景)
export const lifeEventRepo = {
  async add(e: Omit<LifeEvent, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = Date.now();
    return await db.lifeEvents.add({ ...e, createdAt: now, updatedAt: now });
  },
  async list(): Promise<LifeEvent[]> {
    return await db.lifeEvents.orderBy('date').reverse().toArray();
  },
  async update(id: number, patch: Partial<LifeEvent>) {
    return await db.lifeEvents.update(id, { ...patch, updatedAt: Date.now() });
  },
  async remove(id: number) {
    return await db.lifeEvents.delete(id);
  },
};