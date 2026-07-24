import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '../shared/ui/Sheet';
import { Button } from '../shared/ui/Button';
import { Chip } from '../shared/ui/Chip';
import { dailyLogRepo } from '../shared/db/client';
import { today, toISODate } from '../shared/lib/date';

const SYMPTOM_KEYS = [
  'cramps', 'headache', 'bloating', 'discharge',
  'breast', 'nausea', 'appetite', 'fever',
  'sleepy', 'insomnia', 'acne', 'constipated', 'diarrhea',
] as const;

interface LogSheetProps {
  open: boolean;
  onClose: () => void;
}

export function LogSheet({ open, onClose }: LogSheetProps) {
  const { t } = useTranslation();
  type Rating = 1 | 2 | 3 | 4 | 5;
  const [mood, setMood] = useState<Rating | undefined>();
  const [energy, setEnergy] = useState<Rating | undefined>();
  const [sleep, setSleep] = useState<number | undefined>(7.5);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  function reset() {
    setMood(undefined);
    setEnergy(undefined);
    setSleep(7.5);
    setSymptoms([]);
    setNotes('');
  }

  async function handleSave() {
    const date = toISODate(today());
    await dailyLogRepo.upsertByDate(date, {
      mood,
      energy,
      sleepHours: sleep,
      symptoms: symptoms.length ? symptoms : undefined,
      notes: notes.trim() || undefined,
    });
    reset();
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('log.title')}>
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
                <span className="text-sm font-medium text-coral-600">
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

        {/* 保存按钮 */}
        <div className="flex gap-3 pt-2">
          <Button variant="ghost" fullWidth onClick={() => { reset(); onClose(); }}>
            {t('common.cancel')}
          </Button>
          <Button fullWidth onClick={handleSave}>
            {t('log.save')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}