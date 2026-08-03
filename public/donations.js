const $ = (id) => document.getElementById(id);
const API = '/api/admin/donations';

// 从 URL ?code= 预填
const urlCode = new URL(location.href).searchParams.get('code');
if (urlCode) $('code').value = urlCode;

function setStatus(msg, isErr) {
  const el = $('status');
  el.innerHTML = msg ? `<div class="${isErr ? 'err' : 'muted'}">${msg}</div>` : '';
}

async function load() {
  const code = $('code').value.trim();
  if (!code) { setStatus('请先输入 ADMIN_CODE', true); return; }
  $('load').disabled = true;
  setStatus('加载中…');
  try {
    const res = await fetch(`${API}?code=${encodeURIComponent(code)}`, { cache: 'no-store' });
    if (res.status === 401) { setStatus('ADMIN_CODE 错误或无权限', true); return; }
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      setStatus('查询失败：' + (e.error || res.status) + (e.detail ? '（' + e.detail + '）' : ''), true);
      return;
    }
    const d = await res.json();
    render(d);
    setStatus('更新于 ' + new Date(d.generated_at).toLocaleString());
  } catch (e) {
    setStatus('网络错误：' + e.message, true);
  } finally {
    $('load').disabled = false;
  }
}

const fmt = (n) => (n == null ? '–' : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }));
const fmtTime = (ts) => new Date(ts).toLocaleString();

function render(d) {
  $('kpis').style.display = '';
  $('k-count').textContent = fmt(d.total.count);
  $('k-usd').textContent = '$' + fmt(d.total.total_usd);
  $('k-30c').textContent = fmt(d.last30.count);
  $('k-30u').textContent = '$' + fmt(d.last30.sum_usd);

  if (d.byCurrency && d.byCurrency.length) {
    $('curCard').style.display = '';
    const ct = $('curTable').querySelector('tbody');
    ct.innerHTML = d.byCurrency
      .map((c) => `<tr><td>${c.currency}</td><td class="num">${fmt(c.count)}</td><td class="num">${fmt(c.sum_amount)}</td></tr>`)
      .join('');
  }

  if (d.byMonth && d.byMonth.length) {
    $('monthCard').style.display = '';
    const mt = $('monthTable').querySelector('tbody');
    mt.innerHTML = d.byMonth
      .map((m) => `<tr><td>${m.month}</td><td class="num">${fmt(m.count)}</td><td class="num">$${fmt(m.sum_usd)}</td></tr>`)
      .join('');
  }

  if (d.recent && d.recent.length) {
    $('recentCard').style.display = '';
    const rt = $('recentTable').querySelector('tbody');
    rt.innerHTML = d.recent
      .map((r) => `<tr><td>${fmtTime(r.ts)}</td><td>${r.currency}</td><td class="num">${fmt(r.amount)}</td></tr>`)
      .join('');
  }
}

$('load').addEventListener('click', load);
$('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
if (urlCode) load();
