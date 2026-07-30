/**
 * src/test/a11y.test.tsx
 * 自动无障碍审计（v0.4）：用 axe-core 在 jsdom 中对主要页面跑 WCAG 规则。
 *
 * 说明：jsdom 不做布局，故「颜色对比度(color-contrast)」无法在此判定，
 * 该维度已在代码中按 WCAG 2.1 AA 手工核算（见本次提交说明），此处禁用该规则，
 * 仅断言结构/标签/ARIA/标题/landmark 等可在无布局环境下判定的规则为零违规。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import axe from 'axe-core';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from '../app/AppShell';
import { Today } from '../pages/Today';
import { Insights } from '../pages/Insights';
import { Settings } from '../pages/Settings';
import { Calendar } from '../pages/Calendar';
import { Log } from '../pages/Log';
import { DoctorReport } from '../pages/DoctorReport';
import { Education } from '../pages/Education';
import { settingsRepo } from '../shared/db/client';

afterEach(cleanup);

async function audit(node: ReactNode, path: string) {
  // Today 在未引导时会重定向到 /onboarding；测试库为空会导致重定向无匹配路由。
  // 种入 onboarded 标志，让页面正常渲染。
  await settingsRepo.set('onboarded', true);

  const { container } = render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={node} />
          <Route path="/report" element={node} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

  // 等待页面内容（含 h1）渲染出来
  await waitFor(() => {
    expect(container.querySelector('h1')).toBeTruthy();
  });

  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });

  if (results.violations.length > 0) {
    // 便于排查：把违规项打印出来
    const summary = results.violations.map(
      (v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.help}`,
    );
    console.error('[a11y] violations:\n' + summary.join('\n'));
  }

  expect(results.violations).toEqual([]);
}

describe('a11y audit (axe-core)', () => {
  it('Today 页面', async () => {
    await audit(<Today />, '/');
  });
  it('Insights 页面', async () => {
    await audit(<Insights />, '/');
  });
  it('Settings 页面', async () => {
    await audit(<Settings />, '/');
  });
  it('Calendar 页面', async () => {
    await audit(<Calendar />, '/');
  });
  it('Log 页面', async () => {
    await audit(<Log />, '/');
  });
  it('DoctorReport 页面', async () => {
    await audit(<DoctorReport />, '/report');
  });
  it('Education 页面', async () => {
    await audit(<Education />, '/');
  });
});
