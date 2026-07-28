/**
 * src/features/DayDetailSheet.tsx
 * 日历点击日期后的统一入口：展示该日的月经 / 日记，
 * 提供编辑 / 删除 / 新增 操作。
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Droplet, BookHeart, Pencil, Plus } from 'lucide-react';
import { Sheet } from '../shared/ui/Sheet';
import { Button } from '../shared/ui/Button';
import { periodRepo, dailyLogRepo, type Period, type DailyLog } from '../shared/db/client';
import { toISODate, fmt, fromISO } from '../shared/lib/date';
import { PeriodEditSheet } from './PeriodEditSheet';
import { LogEditSheet } from './LogEditSheet';

interface DayDetailSheetProps {
  open: boolean;
  onClose: () => void;
  /** 选中的日期（Date 对象） */
  date: Date | null;
}

export function DayDetailSheet({ open, onClose, date }: DayDetailSheetProps) {
  const { t } = useTranslation();
  const [periodEdit, setPeriodEdit] = useState<Period | 'new' | null>(null);
  const [logEdit, setLogEdit] = useState<DailyLog | 'new' | null>(null);

  const isoDate = date ? toISODate(date) : null;

  // 查询该日的所有 period（可能多条）
  const periods = useLiveQuery(
    () => (isoDate ? periodRepo.list().then((all) =>
      all.filter((p) => p.startDate <= (isoDate) && (!p.endDate || p.endDate >= isoDate))
    ) : Promise.resolve([] as Period[])),
    [isoDate],
  );

  // 查询该日的 log（唯一）
  const log = useLiveQuery(
    () => (isoDate ? dailyLogRepo.getByDate(isoDate) : Promise.resolve(undefined)),
    [isoDate],
  );

  // 关闭所有子 sheet 时同步关闭主 sheet
  useEffect(() => {
    if (!open) {
      setPeriodEdit(null);
      setLogEdit(null);
    }
  }, [open]);

  if (!date) return null;

  const titleDate = fmt(fromISO(toISODate(date)), 'PPP');

  return (
    <>
      <Sheet
        open={open && !periodEdit && !logEdit}
        onClose={onClose}
        title={t('day.sheetTitle', { date: titleDate })}
      >
        <div className="space-y-4">
          {/* 月经 */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-fog flex items-center gap-2">
                <Droplet size={16} className="text-coral-500" />
                {t('phases.menstrual')}
              </h3>
              <button
                type="button"
                onClick={() => setPeriodEdit('new')}
                className="text-xs text-lavender-500 hover:text-lavender-600 inline-flex items-center gap-1"
              >
                <Plus size={14} />
                {t('day.addPeriod')}
              </button>
            </div>
            {periods === undefined ? (
              <p className="text-sm text-fog">{t('common.loading')}</p>
            ) : periods.length === 0 ? (
              <p className="text-xs text-fog">{t('day.empty')}</p>
            ) : (
              <ul className="space-y-2">
                {periods.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setPeriodEdit(p)}
                      className="w-full text-left rounded-lg bg-coral-50 px-4 py-3 hover:bg-coral-100 transition flex items-center gap-3"
                    >
                      <Droplet size={16} className="text-coral-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium tabular-nums text-ink">
                          {p.startDate}{p.endDate ? ` → ${p.endDate}` : ' → …'}
                        </p>
                        {p.flow && (
                          <p className="text-xs text-fog">
                            {t(`flow.${p.flow}`)}
                          </p>
                        )}
                      </div>
                      <Pencil size={14} className="text-fog shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 日记 */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-fog flex items-center gap-2">
                <BookHeart size={16} className="text-lavender-500" />
                {t('pages.logTitle')}
              </h3>
              {!log && (
                <button
                  type="button"
                  onClick={() => setLogEdit('new')}
                  className="text-xs text-lavender-500 hover:text-lavender-600 inline-flex items-center gap-1"
                >
                  <Plus size={14} />
                  {t('day.addLog')}
                </button>
              )}
            </div>
            {log === undefined ? (
              <p className="text-sm text-fog">{t('common.loading')}</p>
            ) : log ? (
              <button
                type="button"
                onClick={() => setLogEdit(log)}
                className="w-full text-left rounded-lg bg-lavender-50 px-4 py-3 hover:bg-lavender-100 transition flex items-center gap-3"
              >
                <BookHeart size={16} className="text-lavender-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex gap-3 text-sm text-ink tabular-nums">
                    {log.mood && <span>{t(`mood.${log.mood}` as 'mood.1')}</span>}
                    {log.energy && <span>{t(`energyLabel.${log.energy}` as 'energyLabel.1')}</span>}
                    {log.sleepHours != null && <span>{log.sleepHours}h</span>}
                  </div>
                  {log.symptoms && log.symptoms.length > 0 && (
                    <p className="text-xs text-fog mt-1 truncate">
                      {log.symptoms.map((s) => t(`symptoms.${s}` as 'symptoms.cramps')).join(' · ')}
                    </p>
                  )}
                  {log.notes && (
                    <p className="text-xs text-fog mt-1 truncate">{log.notes}</p>
                  )}
                </div>
                <Pencil size={14} className="text-fog shrink-0" />
              </button>
            ) : (
              <p className="text-xs text-fog">{t('day.empty')}</p>
            )}
          </section>

          <div className="pt-2">
            <Button variant="ghost" fullWidth onClick={onClose}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      </Sheet>

      <PeriodEditSheet
        open={periodEdit !== null}
        onClose={() => setPeriodEdit(null)}
        period={periodEdit === 'new' ? undefined : periodEdit ?? undefined}
        defaultStartDate={toISODate(date)}
      />

      <LogEditSheet
        open={logEdit !== null}
        onClose={() => setLogEdit(null)}
        log={logEdit === 'new' ? undefined : logEdit ?? undefined}
        date={toISODate(date)}
      />
    </>
  );
}