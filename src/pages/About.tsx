/**
 * src/pages/About.tsx
 * 关于页（PRD §6.4.5 / §12.1 / §12.3）
 *  - 说明数据存储位置与清理方式
 *  - 解释 AI 洞察是本地规则引擎
 *  - 隐私边界（V1.4 账号系统可选）
 */
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Heart, Shield, Brain, Database, Wrench, Users, Github, ArrowLeft, Sparkles } from 'lucide-react';
import { Card, CardTitle } from '../shared/ui/Card';

export function About() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <Link
        to="/settings"
        className="inline-flex items-center gap-1 text-sm text-fog hover:text-ink transition"
      >
        <ArrowLeft size={14} />
        {t('about.backToSettings')}
      </Link>

      {/* Hero */}
      <div className="text-center pt-2 pb-4">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-lavender-300 to-coral-300 mb-3">
          <Heart size={24} className="text-white" fill="white" strokeWidth={0} />
        </div>
        <h1 className="text-2xl font-semibold">{t('about.title')}</h1>
        <p className="text-sm text-fog mt-1">{t('about.tagline')}</p>
      </div>

      {/* 版本信息 */}
      <Card variant="flat" className="text-center">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-fog">{t('about.version')}</p>
            <p className="font-semibold tabular-nums mt-1">{t('about.versionValue')}</p>
          </div>
          <div>
            <p className="text-xs text-fog">{t('about.schemaVersion')}</p>
            <p className="font-semibold tabular-nums mt-1">{t('about.schemaVersionValue')}</p>
          </div>
          <div>
            <p className="text-xs text-fog">{t('about.lastUpdated')}</p>
            <p className="font-semibold tabular-nums mt-1">2026-07-28</p>
          </div>
        </div>
      </Card>

      {/* 隐私承诺 */}
      <Card>
        <div className="flex items-start gap-3 mb-3">
          <Shield size={18} className="text-lavender-500 mt-0.5 shrink-0" />
          <CardTitle>{t('about.privacyTitle')}</CardTitle>
        </div>
        <ul className="space-y-2 text-sm text-ink">
          <li className="flex gap-2">
            <span className="text-lavender-500 shrink-0">·</span>
            <span>{t('about.privacyPoint1')}</span>
          </li>
          <li className="flex gap-2">
            <span className="text-lavender-500 shrink-0">·</span>
            <span>{t('about.privacyPoint2')}</span>
          </li>
          <li className="flex gap-2">
            <span className="text-lavender-500 shrink-0">·</span>
            <span>{t('about.privacyPoint3')}</span>
          </li>
        </ul>
      </Card>

      {/* AI 洞察 */}
      <Card>
        <div className="flex items-start gap-3 mb-3">
          <Brain size={18} className="text-lavender-500 mt-0.5 shrink-0" />
          <CardTitle>{t('about.aiTitle')}</CardTitle>
        </div>
        <div className="flex gap-2 text-sm text-ink">
          <Sparkles size={14} className="text-lavender-500 mt-0.5 shrink-0" />
          <p>{t('about.aiDesc')}</p>
        </div>
      </Card>

      {/* 数据存储 */}
      <Card>
        <div className="flex items-start gap-3 mb-3">
          <Database size={18} className="text-lavender-500 mt-0.5 shrink-0" />
          <CardTitle>{t('about.storageTitle')}</CardTitle>
        </div>
        <ul className="space-y-2 text-sm text-ink">
          <li className="flex gap-2">
            <span className="text-lavender-500 shrink-0">·</span>
            <span>{t('about.storageLocation')}</span>
          </li>
          <li className="flex gap-2">
            <span className="text-lavender-500 shrink-0">·</span>
            <span>{t('about.storageFormat')}</span>
          </li>
          <li className="flex gap-2">
            <span className="text-lavender-500 shrink-0">·</span>
            <span>{t('about.storageClear')}</span>
          </li>
        </ul>
      </Card>

      {/* 账号系统 (V1.4) */}
      <Card>
        <div className="flex items-start gap-3 mb-3">
          <Users size={18} className="text-lavender-500 mt-0.5 shrink-0" />
          <CardTitle>{t('about.accountTitle')}</CardTitle>
        </div>
        <div className="space-y-2 text-sm text-ink">
          <p>{t('about.accountDesc')}</p>
          <p className="text-xs text-fog">{t('about.accountFlow')}</p>
          <p className="text-xs text-fog">{t('about.accountPrivacy')}</p>
        </div>
      </Card>

      {/* 技术栈 */}
      <Card>
        <div className="flex items-start gap-3 mb-3">
          <Wrench size={18} className="text-lavender-500 mt-0.5 shrink-0" />
          <CardTitle>{t('about.buildTitle')}</CardTitle>
        </div>
        <p className="text-sm text-ink font-mono">{t('about.buildDesc')}</p>
      </Card>

      {/* 致谢 */}
      <Card>
        <div className="flex items-start gap-3 mb-3">
          <Heart size={18} className="text-lavender-500 mt-0.5 shrink-0" />
          <CardTitle>{t('about.thanksTitle')}</CardTitle>
        </div>
        <p className="text-sm text-ink">{t('about.thanksDesc')}</p>
      </Card>

      {/* 源代码 */}
      <Card>
        <div className="flex items-start gap-3 mb-3">
          <Github size={18} className="text-lavender-500 mt-0.5 shrink-0" />
          <CardTitle>{t('about.repoTitle')}</CardTitle>
        </div>
        <a
          href="https://github.com/ruisheng2266/lumi"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-lavender-500 hover:text-lavender-600 underline"
        >
          github.com/ruisheng2266/lumi →
        </a>
      </Card>
    </div>
  );
}