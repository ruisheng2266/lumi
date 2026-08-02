/**
 * src/features/PeriodEditSheet.tsx
 * 编辑 / 新增 / 删除 月经记录
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Sheet } from '../shared/ui/Sheet';
import { Button } from '../shared/ui/Button';
import { Chip } from '../shared/ui/Chip';
import { periodRepo, type Period } from '../shared/db/client';
import { today, toISODate } from '../shared/lib/date';
import { subDays } from 'date-fns';
import { track } from '../shared/analytics';

type Flow = 'light' | 'medium' | 'heavy';

interface PeriodEditSheetProps {
  open: boolean;
  onClose: () => void;
  /** 传入则编辑；不传则新增 */
  period?: Period;
  /** 新增时的默认开始日期（默认今天） */
  defaultStartDate?: string;
  onSaved?: () => void;
  onDeleted?: () => void;
}

/**
 * 快速日期选择器：最近 30 天的快捷选项
 */
function DateQuickPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const today_ = today();
  const options = [0, 1, 2, 3, 5, 7, 14, 21, 28, 30].map((daysAgo) => {
    const date = subDays(today_, daysAgo);
    return { daysAgo, date: toISODate(date) };
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-fog">{t('onboarding.pickRecent')}</p>
      <div className="grid grid-cols-5 gap-2">
        {options.map(({ daysAgo, date }) => (
          <button
            key={daysAgo}
            onClick={() => onChange(date)}
            className={`rounded-lg px-3 py-3 text-sm transition ${
              value === date
              ? 'bg-lavender-600 text-white'
              : 'bg-lavender-50 hover:bg-lavender-100'
            }`}
          >
            {daysAgo === 0 ? t('common.today') : `-${daysAgo}d`}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PeriodEditSheet({
  open,
  onClose,
  period,
  defaultStartDate,
  onSaved,
  onDeleted,
}: PeriodEditSheetProps) {
  const { t } = useTranslation();
  const isEdit = !!period;

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [flow, setFlow] = useState<Flow | undefined>(undefined);
  const [notes, setNotes] = useState<string>('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync state when sheet opens
  useEffect(() => {
    if (!open) return;
    if (period) {
      setStartDate(period.startDate);
      setEndDate(period.endDate ?? '');
      setFlow(period.flow);
      setNotes(period.notes ?? '');
    } else {
      setStartDate(defaultStartDate ?? toISODate(today()));
      setEndDate('');
      setFlow(undefined);
      setNotes('');
    }
    setConfirmDelete(false);
  }, [open, period, defaultStartDate]);

  const isInvalidRange = !!endDate && endDate < startDate;

  async function handleSave() {
    if (isInvalidRange) return;
    setSaving(true);
    try {
      const payload = {
        startDate,
        endDate: endDate || undefined,
        flow,
        notes: notes.trim() || undefined,
      };
      if (isEdit && period?.id) {
        await periodRepo.update(period.id, payload);
      } else {
        await periodRepo.add(payload);
        track('period_added');
      }
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!period?.id) return;
    setSaving(true);
    try {
      await periodRepo.remove(period.id);
      onDeleted?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Sheet
        open={open && !showStartPicker && !showEndPicker && !confirmDelete}
        onClose={onClose}
        title={isEdit ? t('periodEdit.editTitle') : t('periodEdit.addTitle')}
      >
        <div className="space-y-5">
          {/* 开始日期 */}
          <section>
            <label className="block text-sm font-medium text-fog mb-2">
              {t('periodEdit.startDate')}
            </label>
            <button
              type="button"
              onClick={() => setShowStartPicker(true)}
              className="w-full text-left rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-lavender-300 tabular-nums"
            >
              {startDate || '—'}
            </button>
          </section>

          {/* 结束日期 */}
          <section>
            <label className="block text-sm font-medium text-fog mb-2">
              {t('periodEdit.endDate')}
            </label>
            <button
              type="button"
              onClick={() => setShowEndPicker(true)}
              className={`w-full text-left rounded-lg border bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-lavender-300 tabular-nums ${
                isInvalidRange ? 'border-coral-300' : 'border-border'
              }`}
            >
              {endDate || <span className="text-fog">—</span>}
            </button>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-fog">{t('periodEdit.endDateHint')}</p>
              {endDate && (
                <button
                  type="button"
                  onClick={() => setEndDate('')}
                  className="text-xs text-fog hover:text-ink underline"
                >
                  {t('common.cancel')}
                </button>
              )}
            </div>
            {isInvalidRange && (
              <p className="text-xs text-danger mt-1">{t('periodEdit.invalidRange')}</p>
            )}
          </section>

          {/* 流量 */}
          <section>
            <label className="block text-sm font-medium text-fog mb-2">
              {t('periodEdit.flow')}
            </label>
            <div className="flex gap-2">
              {(['light', 'medium', 'heavy'] as Flow[]).map((f) => (
                <Chip
                  key={f}
                  selected={flow === f}
                  onClick={() => setFlow(flow === f ? undefined : f)}
                >
                  {t(`periodEdit.flow${f[0].toUpperCase()}${f.slice(1)}`)}
                </Chip>
              ))}
            </div>
          </section>

          {/* 备注 */}
          <section>
            <label className="block text-sm font-medium text-fog mb-2">
              {t('periodEdit.notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('periodEdit.notesPlaceholder')}
              rows={3}
              maxLength={500}
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-lavender-300 resize-none"
            />
          </section>

          {/* 按钮 */}
          <div className="flex gap-3 pt-2">
            {isEdit ? (
              <Button
                variant="danger"
                leftIcon={<Trash2 size={18} />}
                onClick={() => setConfirmDelete(true)}
              >
                {t('periodEdit.delete')}
              </Button>
            ) : (
              <Button variant="ghost" fullWidth onClick={onClose}>
                {t('common.cancel')}
              </Button>
            )}
            <Button
              fullWidth
              onClick={handleSave}
              disabled={isInvalidRange || saving || !startDate}
            >
              {t('periodEdit.save')}
            </Button>
          </div>
        </div>
      </Sheet>

      {/* 开始日期选择器 */}
      <Sheet
        open={showStartPicker}
        onClose={() => setShowStartPicker(false)}
        title={t('periodEdit.startDate')}
      >
        <DateQuickPicker value={startDate} onChange={(d) => { setStartDate(d); setShowStartPicker(false); }} />
      </Sheet>

      {/* 结束日期选择器 */}
      <Sheet
        open={showEndPicker}
        onClose={() => setShowEndPicker(false)}
        title={t('periodEdit.endDate')}
      >
        <DateQuickPicker value={endDate || toISODate(today())} onChange={(d) => { setEndDate(d); setShowEndPicker(false); }} />
      </Sheet>

      {/* 删除确认 */}
      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('periodEdit.deleteConfirmTitle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink leading-relaxed">{t('periodEdit.deleteConfirmDesc')}</p>
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setConfirmDelete(false)}>
              {t('confirm.no')}
            </Button>
            <Button variant="danger" fullWidth onClick={handleDelete} disabled={saving}>
              {t('confirm.yes')}
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}