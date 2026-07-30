/**
 * src/features/LogEditSheet.tsx
 * 编辑 / 新增 / 删除 每日健康日志
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Sheet } from '../shared/ui/Sheet';
import { Button } from '../shared/ui/Button';
import { Chip } from '../shared/ui/Chip';
import { dailyLogRepo, type DailyLog } from '../shared/db/client';

const SYMPTOM_KEYS = [
  'cramps', 'headache', 'bloating', 'discharge',
  'breast', 'nausea', 'appetite', 'fever',
  'sleepy', 'insomnia', 'acne', 'constipated', 'diarrhea',
] as const;

interface LogEditSheetProps {
  open: boolean;
  onClose: () => void;
  /** 传入则编辑；不传则新增 */
  log?: DailyLog;
  /** 新增或定位的目标日期 */
  date: string;
  onSaved?: () => void;
  onDeleted?: () => void;
}

export function LogEditSheet({
  open,
  onClose,
  log,
  date,
  onSaved,
  onDeleted,
}: LogEditSheetProps) {
  const { t } = useTranslation();
  const isEdit = !!log;
  type Rating = 1 | 2 | 3 | 4 | 5;

  const [mood, setMood] = useState<Rating | undefined>();
  const [energy, setEnergy] = useState<Rating | undefined>();
  const [sleep, setSleep] = useState<number | undefined>(7.5);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync state when sheet opens
  useEffect(() => {
    if (!open) return;
    if (log) {
      setMood(log.mood);
      setEnergy(log.energy);
      setSleep(log.sleepHours);
      setSymptoms(log.symptoms ?? []);
      setNotes(log.notes ?? '');
    } else {
      setMood(undefined);
      setEnergy(undefined);
      setSleep(7.5);
      setSymptoms([]);
      setNotes('');
    }
    setConfirmDelete(false);
  }, [open, log]);

  async function handleSave() {
    setSaving(true);
    try {
      await dailyLogRepo.upsertByDate(date, {
        mood,
        energy,
        sleepHours: sleep,
        symptoms: symptoms.length ? symptoms : undefined,
        notes: notes.trim() || undefined,
      });
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!log?.id) return;
    setSaving(true);
    try {
      await dailyLogRepo.remove(log.id);
      onDeleted?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Sheet
        open={open && !confirmDelete}
        onClose={onClose}
        title={isEdit ? t('logEdit.editTitle') : t('logEdit.addTitle')}
      >
        <div className="space-y-5">
          {/* 心情 */}
          <section>
            <label className="block text-sm font-medium text-fog mb-2">{t('log.mood')}</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setMood(mood === n ? undefined : (n as Rating))}
                  className={`flex-1 h-12 rounded-lg text-2xl transition ${
                    mood === n ? 'bg-lavender-300 ring-2 ring-lavender-200' : 'bg-lavender-50 hover:bg-lavender-100'
                  }`}
                >
                  {t(`mood.${n}` as 'mood.1')}
                </button>
              ))}
            </div>
            {mood && <p className="text-xs text-fog mt-1">{t(`moodLabel.${mood}` as 'moodLabel.1')}</p>}
          </section>

          {/* 精力 */}
          <section>
            <label className="block text-sm font-medium text-fog mb-2">{t('log.energy')}</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setEnergy(energy === n ? undefined : (n as Rating))}
                  className={`flex-1 h-10 rounded-lg transition ${
                    energy === n ? 'bg-coral-300 ring-2 ring-coral-200' : 'bg-coral-50 hover:bg-coral-100'
                  }`}
                >
                  <span className="text-sm font-medium text-ink">
                    {t(`energyLabel.${n}` as 'energyLabel.1')}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* 睡眠 */}
          <section>
            <label className="block text-sm font-medium text-fog mb-2">{t('log.sleep')}</label>
            <div className="flex items-baseline gap-3">
              <input
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={sleep ?? ''}
                onChange={(e) => setSleep(e.target.value === '' ? undefined : Number(e.target.value))}
                className="flex-1 rounded-lg border border-lavender-100 bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-lavender-300 tabular-nums"
              />
              <span className="text-sm text-fog">{t('log.hours')}</span>
            </div>
          </section>

          {/* 症状 */}
          <section>
            <label className="block text-sm font-medium text-fog mb-2">{t('log.symptoms')}</label>
            <div className="flex flex-wrap gap-2">
              {SYMPTOM_KEYS.map((key) => (
                <Chip
                  key={key}
                  selected={symptoms.includes(key)}
                  onClick={() =>
                    setSymptoms(symptoms.includes(key) ? symptoms.filter((s) => s !== key) : [...symptoms, key])
                  }
                >
                  {t(`symptoms.${key}` as 'symptoms.cramps')}
                </Chip>
              ))}
            </div>
          </section>

          {/* 备注 */}
          <section>
            <label className="block text-sm font-medium text-fog mb-2">{t('log.notes')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('log.notesPlaceholder')}
              rows={3}
              maxLength={500}
              className="w-full rounded-lg border border-lavender-100 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-lavender-300 resize-none"
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
                {t('logEdit.delete')}
              </Button>
            ) : (
              <Button variant="ghost" fullWidth onClick={onClose}>
                {t('common.cancel')}
              </Button>
            )}
            <Button fullWidth onClick={handleSave} disabled={saving}>
              {t('log.save')}
            </Button>
          </div>
        </div>
      </Sheet>

      {/* 删除确认 */}
      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('logEdit.deleteConfirmTitle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink leading-relaxed">{t('logEdit.deleteConfirmDesc')}</p>
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