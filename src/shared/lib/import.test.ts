/**
 * src/shared/lib/import.test.ts
 * 竞品数据导入解析单元测试（v0.4）
 */
import { describe, it, expect } from 'vitest';
import {
  parseDate,
  parseCSV,
  parseGenericCSV,
  parseLumiJSON,
  detectAndParse,
  mapFlow,
  mapSymptoms,
} from './import';

describe('parseDate', () => {
  it('parses ISO with dash', () => {
    expect(parseDate('2026-01-31')).toBe('2026-01-31');
  });
  it('parses ISO with slash', () => {
    expect(parseDate('2026/02/05')).toBe('2026-02-05');
  });
  it('parses US M/D/Y (first segment <= 12)', () => {
    expect(parseDate('02/05/2026')).toBe('2026-02-05');
  });
  it('parses D/M/Y when first segment > 12', () => {
    expect(parseDate('31/01/2026')).toBe('2026-01-31');
  });
  it('parses Chinese format', () => {
    expect(parseDate('2026年7月24日')).toBe('2026-07-24');
  });
  it('returns null for blank/invalid', () => {
    expect(parseDate('')).toBeNull();
    expect(parseDate('not a date')).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });
});

describe('mapFlow', () => {
  it('maps light synonyms', () => {
    expect(mapFlow('light')).toBe('light');
    expect(mapFlow('少')).toBe('light');
    expect(mapFlow('spotting')).toBe('light');
  });
  it('maps heavy synonyms', () => {
    expect(mapFlow('heavy')).toBe('heavy');
    expect(mapFlow('多')).toBe('heavy');
  });
  it('defaults to medium', () => {
    expect(mapFlow('medium')).toBe('medium');
    expect(mapFlow('中')).toBe('medium');
    expect(mapFlow(undefined)).toBeUndefined();
  });
});

describe('mapSymptoms', () => {
  it('maps English comma list', () => {
    expect(mapSymptoms('cramps, headache')).toEqual(['cramps', 'headache']);
  });
  it('maps Chinese semicolon list', () => {
    expect(mapSymptoms('经痛；头痛')).toEqual(['cramps', 'headache']);
  });
  it('ignores unknown tokens', () => {
    expect(mapSymptoms(' unicorn , cramps ')).toEqual(['cramps']);
  });
  it('returns undefined when blank', () => {
    expect(mapSymptoms('')).toBeUndefined();
  });
});

describe('parseCSV', () => {
  it('handles quoted fields with commas', () => {
    const rows = parseCSV('a,b,c\n1,"x,y",2');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1', 'x,y', '2'],
    ]);
  });
  it('handles escaped quotes', () => {
    const rows = parseCSV('a\n"she said ""hi"""');
    expect(rows[1][0]).toBe('she said "hi"');
  });
});

describe('parseGenericCSV', () => {
  const csv = [
    'date,period start,flow,mood,symptoms,notes',
    '2026-01-01,2026-01-01,heavy,5,经痛;头痛,第一天',
    '2026-01-05,,,,失眠,',
    '2026-02-01,2026-02-01,medium,3,,',
  ].join('\n');

  it('detects period and log rows correctly', () => {
    const r = parseGenericCSV(csv);
    expect(r.format).toBe('generic-csv');
    // row1: period + log; row2: log only (no phantom period); row3: period + log
    expect(r.periods).toHaveLength(2);
    expect(r.dailyLogs).toHaveLength(3);
    expect(r.rowCount).toBe(3);
  });

  it('maps symptoms and mood on the first row', () => {
    const r = parseGenericCSV(csv);
    const log0 = r.dailyLogs.find((l) => l.date === '2026-01-01');
    expect(log0?.mood).toBe(5);
    expect(log0?.symptoms).toEqual(['cramps', 'headache']);
    expect(log0?.notes).toBe('第一天');
  });

  it('does not create a phantom period for a symptom-only row', () => {
    const r = parseGenericCSV(csv);
    const hasPhantom = r.periods.some((p) => p.startDate === '2026-01-05');
    expect(hasPhantom).toBe(false);
  });

  it('collects warnings for unrecognized columns', () => {
    const r = parseGenericCSV('date,mystery,flow\n2026-01-01,,heavy');
    expect(r.warnings.some((w) => w.includes('mystery'))).toBe(true);
  });

  it('reports no data for header-only file', () => {
    const r = parseGenericCSV('date,flow\n');
    expect(r.rowCount).toBe(0);
  });
});

describe('parseLumiJSON', () => {
  const json = JSON.stringify({
    meta: { schemaVersion: 1, appVersion: '0.3.1' },
    profile: { avgCycleLen: 29, avgPeriodLen: 5 },
    periods: [{ startDate: '2026-01-01', endDate: '2026-01-05', flow: 'medium' }],
    dailyLogs: [{ date: '2026-01-02', mood: 4, symptoms: ['cramps'] }],
    settings: { language: 'zh-CN' },
  });

  it('round-trips Lumi export into a preview', () => {
    const r = parseLumiJSON(json);
    expect(r.format).toBe('lumi-json');
    expect(r.periods).toHaveLength(1);
    expect(r.dailyLogs).toHaveLength(1);
    expect(r.profile?.avgCycleLen).toBe(29);
  });

  it('returns unknown for malformed JSON', () => {
    const r = parseLumiJSON('{not json');
    expect(r.format).toBe('unknown');
  });

  it('returns unknown when shape is wrong', () => {
    const r = parseLumiJSON('{"foo":1}');
    expect(r.format).toBe('unknown');
  });
});

describe('detectAndParse', () => {
  it('detects Lumi JSON', () => {
    const r = detectAndParse('{"periods":[],"dailyLogs":[]}', 'backup.json');
    expect(r.format).toBe('lumi-json');
  });
  it('detects CSV', () => {
    const r = detectAndParse('date,flow\n2026-01-01,heavy', 'export.csv');
    expect(r.format).toBe('generic-csv');
  });
  it('returns unknown for garbage', () => {
    const r = detectAndParse('hello world');
    expect(r.format).toBe('unknown');
  });
});
