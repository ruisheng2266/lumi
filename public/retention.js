const $ = (id) => document.getElementById(id);
const API = '/api/admin/retention';

// 从 URL ?code= 预填
const urlCode = new URL(location.href).searchParams.get('code');
if (urlCode) $('code').value = urlCode;

function setStatus(msg, isErr) {
  const el = $('status');
  el.innerHTML = msg ? `<div class="${isErr ? 'err' : 'muted'}">${msg}</div>` : '';
}

function drawChart(curve) {
  const svg = $('chart');
  const W = 1000, H = 200, pad = 28;
  const pts = curve.filter((r) => r.day <= 90); // 只看前 90 天，避免长尾压扁
  if (pts.length === 0) { svg.innerHTML = ''; return; }
  const maxDay = Math.max(...pts.map((p) => p.day), 1);
  const maxPct = 100;
  const x = (d) => pad + (d / maxDay) * (W - pad * 2);
  const y = (p) => H - pad - (p / maxPct) * (H - pad * 2);
  let path = '';
  pts.forEach((p, i) => { path += (i === 0 ? 'M' : 'L') + x(p.day).toFixed(1) + ' ' + y(p.retentionPct).toFixed(1) + ' '; });
  const area = path + `L ${x(maxDay).toFixed(1)} ${H - pad} L ${x(0).toFixed(1)} ${H - pad} Z`;
  let dots = '';
  pts.forEach((p) => {
    dots += `<circle cx="${x(p.day).toFixed(1)}" cy="${y(p.retentionPct).toFixed(1)}" r="3" fill="var(--bar)"></circle>`;
  });
  const grid = [0, 25, 50, 75, 100].map((g) =>
    `<line x1="${pad}" y1="${y(g).toFixed(1)}" x2="${W - pad}" y2="${y(g).toFixed(1)}" stroke="var(--border)" stroke-width="1"></line>` +
    `<text x="2" y="${(y(g) + 4).toFixed(1)}" fill="var(--muted)" font-size="10">${g}%</text>`
  ).join('');
  svg.innerHTML = `<path d="${area}" fill="var(--accent-soft)"></path><path d="${path}" fill="none" stroke="var(--bar)" stroke-width="2"></path>${grid}${dots}`;
}

async function load() {
  const code = $('code').value.trim();
  if (!code) { setStatus('请先输入 ADMIN_CODE', true); return; }
  $('load').disabled = true;
  setStatus('加载中…');
  try {
    const res = await fetch(`${API}?code=${encodeURIComponent(code)}`, { cache: 'no-store' });
    if (res.status === 401) { setStatus('ADMIN_CODE 错误或无权限', true); return; }
    if (!res.ok) { const e = await res.json().catch(() => ({})); setStatus('查询失败：' + (e.error || res.status), true); return; }
    const d = await res.json();
    render(d);
    setStatus('更新于 ' + new Date(d.generated_at).toLocaleString());
  } catch (e) {
    setStatus('网络错误：' + e.message, true);
  } finally {
    $('load').disabled = false;
  }
}

function render(d) {
  $('kpis').style.display = '';
  $('k-total').textContent = d.summary.total_installs.toLocaleString();
  $('k-events').textContent = d.summary.total_events.toLocaleString();
  $('k-7d').textContent = d.summary.active_7d.toLocaleString();
  $('k-30d').textContent = d.summary.active_30d.toLocaleString();

  $('curveCard').style.display = '';
  drawChart(d.retentionCurve);
  const k = [1, 7, 30].map((n) => {
    const r = d.retentionCurve.find((x) => x.day === n);
    return r ? `D${n}: ${r.retentionPct}%` : `D${n}: –`;
  });
  $('curveLegend').textContent = '同期群规模 ' + (d.cohortSize || 0).toLocaleString() + ' · ' + k.join('  ·  ');

  $('cohortCard').style.display = '';
  const ct = $('cohortTable').querySelector('tbody');
  ct.innerHTML = d.cohorts.map((c) => `<tr><td>${c.cohort_day}</td><td class="num">${c.installs.toLocaleString()}</td></tr>`).join('');

  $('eventCard').style.display = '';
  const et = $('eventTable').querySelector('tbody');
  et.innerHTML = d.topEvents.map((e) => `<tr><td>${e.name}</td><td class="num">${e.count.toLocaleString()}</td><td class="num">${e.installs.toLocaleString()}</td></tr>`).join('');
}

$('load').addEventListener('click', load);
$('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
if (urlCode) load();
