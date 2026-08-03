/**
 * src/shared/donate/DonatePanel.tsx
 * 打赏（Donation）面板：面向所有用户（含未登录）。
 * 海外 PayPal 一次性捐赠（复用 /api/billing/create-donation + capture-donation），
 * 国内微信/支付宝收款码（真实收款码图片）。打赏不解锁任何功能，
 * 成功后本地写入「💜 已支持」标记（localStorage，明确不解锁功能）。
 *
 * 地区分流：根据「显示语言」推断国内/海外，将对应支付方式置顶高亮，
 * 另一种支付作为「其他支付方式」保留（隐私优先，不做 geo-IP）。
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Coffee, Heart, Check, AlertCircle } from 'lucide-react';
import { Card, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { useLanguage } from '../i18n/useLanguage';

const AMOUNTS = ['0.5', '1', '3', '5'];
const SUPPORTED_KEY = 'lumi_donation_supported';
const QR: Record<'wechat' | 'alipay', string> = {
  wechat: '/donate/wechat.png',
  alipay: '/donate/alipay.jpg',
};

type Region = 'domestic' | 'overseas';

/**
 * 地区分流：隐私优先，仅依据「显示语言」推断，不做 geo-IP / 不读 IP。
 * zh-* 视为国内（微信/支付宝 ¥），其余视为海外（PayPal $）。
 * 用户在设置中切换语言时分会同步变化，且两种支付方式始终都保留。
 */
function regionFromLocale(locale: string): Region {
  return locale.toLowerCase().startsWith('zh') ? 'domestic' : 'overseas';
}

export function DonatePanel() {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const region = regionFromLocale(locale);
  const regionLabel = region === 'domestic' ? t('donate.regionDomestic') : t('donate.regionOverseas');

  const [supported, setSupported] = useState(false);
  const [amount, setAmount] = useState<string>('1');
  const [custom, setCustom] = useState('');
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [qrOpen, setQrOpen] = useState<null | 'wechat' | 'alipay'>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    try {
      setSupported(localStorage.getItem(SUPPORTED_KEY) === '1');
    } catch {
      /* localStorage 不可用时忽略 */
    }
  }, []);

  function markSupported() {
    try {
      localStorage.setItem(SUPPORTED_KEY, '1');
    } catch {
      /* ignore */
    }
    setSupported(true);
  }

  const effectiveAmount = custom.trim() ? custom.trim() : amount;

  function errText(err: string): string {
    switch (err) {
      case 'paypal_not_configured':
        return t('plus.paypalNotConfigured');
      case 'invalid_amount':
        return t('donate.customAmount');
      default:
        return t('plus.genericError');
    }
  }

  async function handleDonate() {
    setProcessing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/billing/create-donation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountUsd: effectiveAmount }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (res.status === 503) throw new Error('paypal_not_configured');
      if (!res.ok) throw new Error((data.error as string) || 'billing_error');
      setPendingOrderId(data.orderId as string);
      if (data.approveUrl) window.open(data.approveUrl as string, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setMessage({ kind: 'err', text: errText((e as Error).message) });
    } finally {
      setProcessing(false);
    }
  }

  async function handleCapture() {
    if (!pendingOrderId) return;
    setProcessing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/billing/capture-donation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: pendingOrderId }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) throw new Error((data.error as string) || 'billing_error');
      markSupported();
      setPendingOrderId(null);
      setMessage({ kind: 'ok', text: t('donate.thanks') });
    } catch (e) {
      setMessage({ kind: 'err', text: errText((e as Error).message) });
    } finally {
      setProcessing(false);
    }
  }

  function handleQrDonated() {
    markSupported();
    setQrOpen(null);
    setMessage({ kind: 'ok', text: t('donate.thanks') });
  }

  // 海外 PayPal（USD）
  const paypalBlock = (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <p className="text-sm font-medium">{t('donate.paypalTitle')}</p>
      <p className="text-xs text-fog">{t('donate.paypalDesc')}</p>
      <p className="text-xs text-fog">{t('donate.amountLabel')}</p>
      <div className="flex flex-wrap gap-2">
        {AMOUNTS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => {
              setAmount(a);
              setCustom('');
            }}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              !custom && amount === a
                ? 'border-lavender-400 bg-lavender-50 text-lavender-600'
                : 'border-border text-fog hover:border-lavender-300'
            }`}
          >
            ${a}
          </button>
        ))}
      </div>
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        placeholder={t('donate.customAmount')}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-lavender-300"
        aria-label={t('donate.customAmount')}
      />
      {pendingOrderId ? (
        <Button
          variant="primary"
          fullWidth
          leftIcon={<Check size={16} />}
          onClick={handleCapture}
          disabled={processing}
        >
          {processing ? t('plus.processing') : t('donate.thanksReturn')}
        </Button>
      ) : (
        <Button variant="primary" fullWidth onClick={handleDonate} disabled={processing}>
          {processing ? t('plus.processing') : t('donate.donateButton', { amount: `$${effectiveAmount}` })}
        </Button>
      )}
    </div>
  );

  // 国内微信 / 支付宝（¥）
  const domesticBlock = (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <p className="text-sm font-medium">{t('donate.domesticTitle')}</p>
      <p className="text-xs text-fog">{t('donate.domesticDesc')}</p>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => setQrOpen('wechat')}>
          {t('donate.wechat')}
        </Button>
        <Button variant="ghost" onClick={() => setQrOpen('alipay')}>
          {t('donate.alipay')}
        </Button>
      </div>
    </div>
  );

  const primaryBlock = region === 'domestic' ? domesticBlock : paypalBlock;
  const secondaryBlock = region === 'domestic' ? paypalBlock : domesticBlock;

  return (
    <section>
      <CardTitle>{t('donate.title')}</CardTitle>
      <Card className="space-y-4">
        {/* 标题 + 已支持角标 */}
        <div className="flex items-center gap-2">
          <Coffee size={18} className="text-lavender-500 shrink-0" />
          <p className="font-medium">{t('donate.heading')}</p>
          {supported && (
            <span className="inline-flex items-center gap-1 rounded-full bg-lavender-50 px-2 py-0.5 text-xs text-lavender-600">
              <Heart size={12} /> {t('donate.supportedBadge')}
            </span>
          )}
        </div>
        <p className="text-xs text-fog leading-relaxed">{t('donate.desc')}</p>

        {/* 地区分流提示（依据显示语言自动推荐） */}
        <p className="text-xs text-fog">{t('donate.regionAuto', { region: regionLabel })}</p>

        {message && (
          <div
            className={`flex items-start gap-2 rounded-lg p-3 text-xs ${
              message.kind === 'ok' ? 'bg-lavender-50 text-lavender-600' : 'bg-coral-50 text-coral-600'
            }`}
          >
            {message.kind === 'ok' ? (
              <Check size={14} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* 地区对应主支付方式 */}
        {primaryBlock}

        {/* 其他支付方式（始终保留，便于跨地区用户） */}
        <div className="space-y-2 border-t border-dashed border-border pt-3">
          <p className="text-xs text-fog">{t('donate.otherMethods')}</p>
          {secondaryBlock}
        </div>

        <p className="text-xs text-fog leading-relaxed">{t('donate.redLineNote')}</p>
      </Card>

      {/* 国内收款码弹层 */}
      <Sheet
        open={qrOpen !== null}
        onClose={() => setQrOpen(null)}
        title={qrOpen === 'wechat' ? t('donate.wechat') : qrOpen === 'alipay' ? t('donate.alipay') : ''}
      >
        {qrOpen && (
          <div className="space-y-3">
            <img
              src={QR[qrOpen]}
              alt={qrOpen}
              className="mx-auto h-56 w-56 rounded-lg border border-border"
            />
            <p className="text-center text-xs text-fog">{t('donate.scanTip')}</p>
            <Button variant="primary" fullWidth leftIcon={<Heart size={16} />} onClick={handleQrDonated}>
              {t('donate.iDonated')}
            </Button>
          </div>
        )}
      </Sheet>
    </section>
  );
}
