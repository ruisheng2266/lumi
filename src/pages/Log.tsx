/**
 * src/pages/Log.tsx
 * 健康日记页面：按日期倒序展示所有日志，支持新增 / 编辑 / 删除。
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, BookHeart, Pencil } from 'lucide-react';
import { Card } from '../shared/ui/Card';
import { Button } from '../shared/ui/Button';
import { dailyLogRepo, type DailyLog } from '../shared/db/client';
import { today, fmtShort, fromISO } from '../shared/lib/date';
import { LogEditSheet } from '../features/LogEditSheet';

export function Log() {
  const { t } = useTranslation();
  const [editingLog, setEditingLog] = useState<DailyLog | 'new' | null>(null);
  const [newDate, setNewDate] = useState<string>('');

  const logs = useLiveQuery(() => dailyLogRepo.list(), []);

  function handleNew() {
    setNewDate(today().toISOString().slice(0, 10));
    setEditingLog('new');
  }

  if (logs === undefined) {
    return <div className="text-fog text-center py-12">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-5">
      {/* 标题 + 新增按钮 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('logList.title')}</h1>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={16} />}
          onClick={handleNew}
        >
          {t('common.edit') /* placeholder, will use save/add */}
        </Button>
      </div>

      {logs.length === 0 ? (
        <Card variant="flat" className="text-center py-8">
          <BookHeart size={32} className="text-lavender-300 mx-auto mb-3" />
          <p className="text-fog text-sm">{t('logList.empty')}</p>
        </Card>
      ) : (
        <Card variant="flat" className="divide-y divide-lavender-50">
          {logs.map((log) => (
            <button
              key={log.id}
              type="button"
              onClick={() => setEditingLog(log)}
              className="w-full text-left py-3 px-1 hover:bg-lavender-50 transition flex items-start gap-3 first:pt-1"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink tabular-nums">
                  {fmtShort(fromISO(log.date))}
                </p>
                <div className="flex gap-3 mt-1 text-xs text-fog tabular-nums">
                  {log.mood && <span>{t(`mood.${log.mood}` as 'mood.1')}</span>}
                  {log.energy && <span>{t(`energyLabel.${log.energy}` as 'energyLabel.1')}</span>}
                  {log.sleepHours != null && <span>{log.sleepHours}h</span>}
                </div>
                {log.symptoms && log.symptoms.length > 0 && (
                  <p className="text-xs text-fog mt-0.5 truncate">
                    {log.symptoms.map((s) => t(`symptoms.${s}` as 'symptoms.cramps')).join(' · ')}
                  </p>
                )}
                {log.notes && (
                  <p className="text-xs text-fog mt-0.5 truncate">{log.notes}</p>
                )}
              </div>
              <Pencil size={14} className="text-fog shrink-0 mt-1" />
            </button>
          ))}
        </Card>
      )}

      {/* 编辑/新增 Sheet */}
      <LogEditSheet
        open={editingLog !== null}
        onClose={() => { setEditingLog(null); setNewDate(''); }}
        log={editingLog === 'new' ? undefined : (editingLog ?? undefined)}
        date={editingLog === 'new' ? newDate : (editingLog?.date ?? newDate)}
      />
    </div>
  );
}