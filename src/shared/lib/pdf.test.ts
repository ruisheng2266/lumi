/**
 * src/shared/lib/pdf.test.ts
 * PDF 导出工具的单测（v0.4）：mock html2canvas / jsPDF，验证接线与分页逻辑。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('html2canvas', () => ({
  default: vi.fn(async () => ({
    height: 1200,
    width: 800,
    toDataURL: () => 'data:image/png;base64,AAAA',
  })),
}));

vi.mock('jspdf', () => {
  const addImage = vi.fn();
  const addPage = vi.fn();
  const save = vi.fn();
  return {
    default: class {
      internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
      addImage = addImage;
      addPage = addPage;
      save = save;
    },
    __addImage: addImage,
    __addPage: addPage,
    __save: save,
  };
});

import { exportElementToPdf } from './pdf';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('exportElementToPdf', () => {
  it('栅格化元素并以指定文件名保存 PDF', async () => {
    const el = document.createElement('div');
    await exportElementToPdf(el, { filename: 'report.pdf' });

    const jspdf = (await import('jspdf')) as any;
    expect(jspdf.__save).toHaveBeenCalledWith('report.pdf');
    expect(jspdf.__addImage).toHaveBeenCalled();
    expect((await import('html2canvas')).default).toHaveBeenCalledWith(el, expect.any(Object));
  });

  it('内容超过一页 A4 时自动分页', async () => {
    const el = document.createElement('div');
    await exportElementToPdf(el, { filename: 'long.pdf' });

    const jspdf = (await import('jspdf')) as any;
    // 画布 1200×800 → 图片高 1200*210/800 = 315mm > 297mm → 第 2 页
    expect(jspdf.__addPage).toHaveBeenCalledTimes(1);
    expect(jspdf.__addImage).toHaveBeenCalledTimes(2);
  });
});
