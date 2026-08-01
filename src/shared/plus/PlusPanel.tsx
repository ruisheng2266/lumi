/**
 * src/shared/plus/PlusPanel.tsx
 * Phase 3 Plus 面板：展示当前方案 + 升级（Founder 一次性 / Plus 订阅 / 激活码兑换）。
 *
 * 仅登录后可见（方案绑定账号）。
 * 支付流程（沙箱优先）：后端返回 approveUrl → 新标签页打开 PayPal 完成支付 →
 *   - Founder：回 Settings 点"我已完成支付"调 capture-order 捕获并写入 founder；
 *   - Plus：订阅由 webhook 异步写入 plus，前端轮询 /api/entitlement 直至 plan=plus。
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Crown, Gift, Check, AlertCircle } from 'lucide-react';
import { Card, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { useAuth } from '../auth/store';
import { useEntitlement, useEntitlementStore } from './store';

type Mode = 'idle' | 'founder_pending' | 'plus_pending';

export function PlusPanel() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const { plan, expiresAt, loading: entLoading, refresh } = useEntitlement();

  const [mode, setMode] = useState<Mode>('idle');
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  if (!user) return null;

  function errText(err: string): string {
    switch (err) {
      case 'paypal_not_configured':
      case 'paypal_plus_plan_missing':
        return t('plus.paypalNotConfigured');
      case 'redeem_invalid':
        return t('plus.redeemInvalid');
      case 'redeem_used':
        return t('plus.redeemUsed');
      case 'redeem_expired':
        return t('plus.redeemExpired');
      case 'order_mismatch':
        return t('plus.orderMismatch');
      default:
        return t('plus.genericError');
    }
  }

  async function handleBuyFounder() {
    setProcessing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/billing/create-order', { method: 'POST', credentials: 'include' });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (res.status === 503) throw new Error('paypal_not_configured');
      if (!res.ok) throw new Error((data.error as string) || 'billing_error');
      setPendingOrderId(data.orderId as string);
      setMode('founder_pending');
      if (data.approveUrl) window.open(data.approveUrl as string, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setMessage({ kind: 'err', text: errText((e as Error).message) });
    } finally {
      setProcessing(false);
    }
  }

  async function handleCaptureFounder() {
    if (!pendingOrderId) return;
    setProcessing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/billing/capture-order', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: pendingOrderId }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) throw new Error((data.error as string) || 'billing_error');
      await refresh();
      setMode('idle');
      setPendingOrderId(null);
    } catch (e) {
      setMessage({ kind: 'err', text: errText((e as Error).message) });
    } finally {
      setProcessing(false);
    }
  }

  async function handleSubscribePlus() {
    setProcessing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/billing/create-subscription', { method: 'POST', credentials: 'include' });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (res.status === 503) throw new Error('paypal_plus_plan_missing');
      if (!res.ok) throw new Error((data.error as string) || 'billing_error');
      setMode('plus_pending');
      if (data.approveUrl) window.open(data.approveUrl as string, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setMessage({ kind: 'err', text: errText((e as Error).message) });
    } finally {
      setProcessing(false);
    }
  }

  async function handleRefreshSubscription() {
    setProcessing(true);
    try {
      for (let i = 0; i < 10; i++) {
        await refresh();
        const cur = useEntitlementStore.getState().plan;
        if (cur === 'plus' || cur === 'founder') {
          setMode('idle');
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      setMessage({ kind: 'err', text: t('plus.subscriptionPending') });
    } finally {
      setProcessing(false);
    }
  }

  async function handleRedeem() {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setProcessing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/billing/redeem', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c }),
      });
      if (res.status === 404) throw new Error('redeem_invalid');
      if (res.status === 409) throw new Error('redeem_used');
      if (res.status === 410) throw new Error('redeem_expired');
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        throw new Error((data.error as string) || 'billing_error');
      }
      await refresh();
      setCode('');
    } catch (e) {
      setMessage({ kind: 'err', text: errText((e as Error).message) });
    } finally {
      setProcessing(false);
    }
  }

  const planLabel =
    plan === 'founder' ? t('plus.planFounder') : plan === 'plus' ? t('plus.planPlus') : t('plus.planFree');

  return (
    <section>
      <CardTitle>{t('plus.title')}</CardTitle>
      <Card className="space-y-4">
        {/* 当前方案 */}
        <div className="flex items-center gap-3">
          <Sparkles
            size={20}
            className={
              plan === 'free' ? 'text-fog mt-0.5 shrink-0' : 'text-lavender-500 mt-0.5 shrink-0'
            }
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium">{t('plus.currentPlan')}</p>
            <p className="text-xs text-fog">
              {planLabel}
              {expiresAt
                ? ` · ${t('plus.expiresAt', { date: new Date(expiresAt).toLocaleDateString() })}`
                : ''}
            </p>
          </div>
        </div>

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

        {plan === 'free' ? (
          <>
            {/* Founder 一次性 */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Crown size={16} className="text-lavender-500 shrink-0" />
                <p className="text-sm font-medium">{t('plus.founder')}</p>
              </div>
              <p className="text-xs text-fog leading-relaxed">{t('plus.founderDesc')}</p>
              <p className="text-xs text-lavender-600">{t('plus.founderPrice')}</p>
              {mode === 'founder_pending' ? (
                <Button
                  variant="primary"
                  fullWidth
                  leftIcon={<Check size={16} />}
                  onClick={handleCaptureFounder}
                  disabled={processing}
                >
                  {processing ? t('plus.processing') : t('plus.completePayment')}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  fullWidth
                  leftIcon={<Crown size={16} />}
                  onClick={handleBuyFounder}
                  disabled={processing || entLoading}
                >
                  {processing ? t('plus.processing') : t('plus.buyFounder')}
                </Button>
              )}
            </div>

            {/* Plus 订阅 */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-lavender-500 shrink-0" />
                <p className="text-sm font-medium">{t('plus.plus')}</p>
              </div>
              <p className="text-xs text-fog leading-relaxed">{t('plus.plusDesc')}</p>
              <p className="text-xs text-lavender-600">{t('plus.plusPrice')}</p>
              {mode === 'plus_pending' ? (
                <Button
                  variant="ghost"
                  fullWidth
                  leftIcon={<Sparkles size={16} />}
                  onClick={handleRefreshSubscription}
                  disabled={processing}
                >
                  {processing ? t('plus.processing') : t('plus.refreshStatus')}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  fullWidth
                  leftIcon={<Sparkles size={16} />}
                  onClick={handleSubscribePlus}
                  disabled={processing || entLoading}
                >
                  {processing ? t('plus.processing') : t('plus.subscribePlus')}
                </Button>
              )}
            </div>

            {/* 激活码兑换 */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Gift size={16} className="text-lavender-500 shrink-0" />
                <p className="text-sm font-medium">{t('plus.redeemTitle')}</p>
              </div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t('plus.redeemPlaceholder')}
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-lavender-300 uppercase"
                aria-label={t('plus.redeemTitle')}
              />
              <Button
                variant="ghost"
                fullWidth
                leftIcon={<Gift size={16} />}
                onClick={handleRedeem}
                disabled={processing || !code.trim()}
              >
                {processing ? t('plus.processing') : t('plus.redeemButton')}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-start gap-2 rounded-lg bg-lavender-50 p-3 text-sm text-lavender-700">
            <Check size={16} className="mt-0.5 shrink-0" />
            <span>{t('plus.activatedPlan', { plan: planLabel })}</span>
          </div>
        )}

        <p className="text-xs text-fog leading-relaxed">{t('plus.redLine')}</p>
      </Card>
    </section>
  );
}
