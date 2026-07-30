/**
 * src/shared/lib/pdf.ts
 * 真·PDF 一键导出（v0.4 a11y/报告收尾）。
 *
 * 采用 html2canvas 将报告 DOM 栅格化为图片，再用 jsPDF 嵌入 A4 多页 PDF。
 * 选择栅格化而非纯文本排版，是为了在不塞入数 MB 中文字体的前提下，
 * 正确渲染中文并保留现有报告样式；jsPDF / html2canvas 均通过动态 import
 * 加载，避免拖慢 PWA 首屏。
 *
 * 全程本地完成，不产生任何网络请求。
 */

export interface PdfExportOptions {
  filename: string;
  /** 栅格化倍率，默认 2（视网膜清晰） */
  scale?: number;
}

/**
 * 将一个 DOM 元素导出为分页 A4 PDF 并触发下载。
 */
export async function exportElementToPdf(
  el: HTMLElement,
  opts: PdfExportOptions,
): Promise<void> {
  const scale = opts.scale ?? 2;

  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const canvas = await html2canvas(el, {
    scale,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // 图片宽度撑满页面，高度按原始比例换算
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;

  let heightLeft = imgH;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
  heightLeft -= pageH;

  // 内容超过一页时，逐页平移图片续接
  while (heightLeft > 0) {
    position -= pageH;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
    heightLeft -= pageH;
  }

  pdf.save(opts.filename);
}
