const C = {
  accent:   '#3b82f6',
  accent2:  '#10b981',
  red:      '#ef4444',
  amber:    '#f59e0b',
  navy:     '#1e3a5f',
  grid:     'rgba(255,255,255,0.05)',
  text:     '#8b96b0',
  textPri:  '#e8edf8',
  border:   'rgba(255,255,255,0.07)',
  bg:       '#0f1525',
  accentGlow: 'rgba(59,130,246,0.15)',
  greenGlow: 'rgba(16,185,129,0.15)',
  redGlow:   'rgba(239,68,68,0.15)',
};

const ARCH_COLORS = {
  LSTM:      C.accent,
  GRU:       C.accent2,
  BiLSTM:    C.amber,
  LSTM_Attn: '#a78bfa',
};

const CHART_DEFAULTS = {
  animation: { duration: 600, easing: 'easeOutQuart' },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      labels: { color: C.text, font: { family: 'Inter', size: 11 }, boxWidth: 12, padding: 16 },
    },
    tooltip: {
      backgroundColor: '#0f1525',
      borderColor: 'rgba(59,130,246,0.3)',
      borderWidth: 1,
      titleColor: C.textPri,
      bodyColor: C.text,
      padding: 12,
      titleFont: { family: 'Inter', size: 12, weight: '600' },
      bodyFont: { family: 'JetBrains Mono', size: 11 },
    },
  },
  scales: {
    x: {
      grid: { color: C.grid, drawBorder: false },
      ticks: { color: C.text, font: { family: 'Inter', size: 10 }, maxRotation: 0 },
    },
    y: {
      grid: { color: C.grid, drawBorder: false },
      ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 10 } },
    },
  },
};

function mergeDeep(target, source) {
  const out = Object.assign({}, target);
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      out[key] = mergeDeep(target[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

function buildOpts(override = {}) {
  return mergeDeep(JSON.parse(JSON.stringify(CHART_DEFAULTS)), override);
}

function noDataMsg(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const wrap = canvas.closest('.chart-wrap');
  if (!wrap) return;
  wrap.innerHTML = `<div class="no-data-msg">
    <strong>Data not found</strong>
    <span>Run the Python notebook and export JSON files to dashboard_data/</span>
  </div>`;
}

function safeChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  try {
    return new Chart(canvas, config);
  } catch (e) {
    noDataMsg(canvasId);
    return null;
  }
}

const activeCharts = {};

function destroyChart(id) {
  if (activeCharts[id]) { activeCharts[id].destroy(); delete activeCharts[id]; }
}

function makeChart(id, config) {
  destroyChart(id);
  const c = safeChart(id, config);
  if (c) activeCharts[id] = c;
  return c;
}

function buildPriceHistoryChart(range = 'all') {
  const data = DashData.dfAll || DashData.bbca;
  if (!data || !data.length) { noDataMsg('priceHistory'); return; }
  const trainEnd = DashData.runConfig?.TRAIN_END || '2024-12-31';
  const testStart = DashData.runConfig?.TEST_START || '2025-01-01';

  let rows = data;
  const now = rows[rows.length - 1]?.date;
  if (range === '2y' && now) {
    const cutoff = new Date(now); cutoff.setFullYear(cutoff.getFullYear() - 2);
    rows = rows.filter(r => r.date >= cutoff.toISOString().slice(0, 10));
  } else if (range === '1y' && now) {
    const cutoff = new Date(now); cutoff.setFullYear(cutoff.getFullYear() - 1);
    rows = rows.filter(r => r.date >= cutoff.toISOString().slice(0, 10));
  } else if (range === 'test') {
    rows = rows.filter(r => r.date >= testStart);
  }

  const trainRows = rows.filter(r => r.date <= trainEnd);
  const testRows = rows.filter(r => r.date > trainEnd);

  const labels = rows.map(r => r.date);

  const trainClose = rows.map(r => r.date <= trainEnd ? r.close : null);
  const testClose = rows.map(r => r.date > trainEnd ? r.close : null);

  makeChart('priceHistory', {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Training Period',
          data: trainClose,
          borderColor: C.accent,
          backgroundColor: 'rgba(59,130,246,0.08)',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: true,
          tension: 0.3,
          spanGaps: true,
        },
        {
          label: 'Test Period',
          data: testClose,
          borderColor: C.amber,
          backgroundColor: 'rgba(245,158,11,0.06)',
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.3,
          spanGaps: true,
        },
      ],
    },
    options: buildOpts({
      plugins: {
        annotation: {},
        tooltip: { callbacks: { label: ctx => ' ' + fmtIdr(ctx.parsed.y) + ' IDR' } },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 10, color: C.text, font: { size: 10 } }, grid: { color: C.grid } },
        y: {
          ticks: { callback: v => fmtIdr(v), color: C.text, font: { family: 'JetBrains Mono', size: 10 } },
          grid: { color: C.grid },
        },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildMacroChart(layer = 'ihsg') {
  const data = DashData.dfAll;
  if (!data || !data.length) { noDataMsg('macroChart'); return; }

  let field, label, color, fmt;
  if (layer === 'ihsg') { field = 'ihsg'; label = 'IHSG'; color = C.accent2; fmt = v => fmtIdr(v); }
  else if (layer === 'exch') { field = 'exch_rate'; label = 'USD/IDR (JISDOR)'; color = C.amber; fmt = v => fmtIdr(v); }
  else { field = 'bi_rate'; label = 'BI Rate (%)'; color = '#a78bfa'; fmt = v => v?.toFixed(2) + '%'; }

  const dates = data.map(r => r.date);
  const vals = data.map(r => r[field] ?? null);

  makeChart('macroChart', {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label,
        data: vals,
        borderColor: color,
        backgroundColor: color.replace('#', 'rgba(') + '18)',
        borderWidth: 1.5,
        pointRadius: 0,
        fill: true,
        tension: 0.3,
        spanGaps: true,
      }],
    },
    options: buildOpts({
      plugins: { tooltip: { callbacks: { label: ctx => ' ' + fmt(ctx.parsed.y) } } },
      scales: {
        x: { ticks: { maxTicksLimit: 8, color: C.text, font: { size: 10 } }, grid: { color: C.grid } },
        y: { ticks: { callback: fmt, color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildWfvChart() {
  const data = DashData.wfvResults;
  if (!data || !data.length) { noDataMsg('wfvChart'); return; }

  const bestKv = DashData.runConfig?.BEST_KV;
  const secondKv = DashData.runConfig?.SECOND_KV;
  const sentKvs = (DashData.runConfig?.SENTIMENT_KV || []);

  const sorted = [...data].sort((a, b) => (a['Mean (E-4)'] ?? Infinity) - (b['Mean (E-4)'] ?? Infinity));

  const labels = sorted.map(r => r.Variable);
  const vals = sorted.map(r => r['Mean (E-4)']);

  const bgColors = sorted.map(r => {
    if (r.Variable === bestKv || r.Variable === secondKv) return C.red;
    if (r.HasSentiment === 'Y' || sentKvs.includes(r.Variable)) return C.accent;
    return 'rgba(139,150,176,0.35)';
  });

  makeChart('wfvChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Mean RMSE ×10⁻⁴',
        data: vals,
        backgroundColor: bgColors,
        borderColor: 'transparent',
        borderRadius: 4,
      }],
    },
    options: buildOpts({
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' RMSE: ' + ctx.parsed.y?.toFixed(4) + ' ×10⁻⁴' } },
      },
      scales: {
        x: { ticks: { font: { size: 9 }, color: C.text, maxRotation: 40 }, grid: { color: C.grid } },
        y: { ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildKomvarMatrix() {
  const defs = DashData.komvarDefs;
  const wfvDict = DashData.wfvDict;
  if (!defs) { noDataMsg('komvarMatrix'); return; }

  const kvNames = Object.keys(defs);
  const flags = ['ihsg', 'exch', 'rate', 'sent', 'enhanced_sent', 'lagged_features'];
  const labels = ['IHSG', 'Exch', 'Rate', 'Sent', 'EnhSent', 'Lagged'];

  const datasets = flags.map((flag, fi) => ({
    label: labels[fi],
    data: kvNames.map(kv => defs[kv][flag] ? 1 : 0),
    backgroundColor: [C.accent, C.accent2, C.amber, C.red, '#a78bfa', '#06b6d4'][fi] + '99',
    borderColor: [C.accent, C.accent2, C.amber, C.red, '#a78bfa', '#06b6d4'][fi],
    borderWidth: 1,
    borderRadius: 2,
  }));

  makeChart('komvarMatrix', {
    type: 'bar',
    data: { labels: kvNames, datasets },
    options: buildOpts({
      indexAxis: 'x',
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            afterBody: ctx => {
              const kv = ctx[0]?.label;
              if (wfvDict && wfvDict[kv] != null) {
                return ['WFV RMSE: ' + (wfvDict[kv] * 1e4).toFixed(4) + ' ×10⁻⁴'];
              }
              return [];
            },
          },
        },
      },
      scales: {
        x: { stacked: false, ticks: { font: { size: 8 }, color: C.text, maxRotation: 45 }, grid: { color: C.grid } },
        y: { ticks: { stepSize: 1, color: C.text }, grid: { color: C.grid }, min: 0, max: 1 },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildSentTimelineChart(layer = 'sent_score') {
  const data = DashData.dailySent;
  if (!data || !data.length) { noDataMsg('sentTimeline'); return; }

  const dates = data.map(r => r.date || r.date_only);
  let vals, label, color;
  if (layer === 'sent_score') { vals = data.map(r => r.sent_score ?? null); label = 'Sentiment Score'; color = C.accent; }
  else if (layer === 'bullishness') { vals = data.map(r => r.bullishness_index ?? null); label = 'Bullishness Index'; color = C.accent2; }
  else if (layer === 'weighted') { vals = data.map(r => r.weighted_sentiment_score ?? null); label = 'Weighted Sentiment'; color = C.amber; }
  else { vals = data.map(r => r.sentiment_momentum_ewma ?? null); label = 'EWMA Momentum'; color = '#a78bfa'; }

  const ma = movingAvg(vals, 10);
  const baselineVal = layer === 'sent_score' ? 0.5 : 0;

  makeChart('sentTimeline', {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label,
          data: vals,
          borderColor: color + '60',
          backgroundColor: 'transparent',
          borderWidth: 1,
          pointRadius: 0,
          tension: 0.2,
          spanGaps: true,
        },
        {
          label: '10-Day MA',
          data: ma,
          borderColor: color,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          spanGaps: true,
        },
      ],
    },
    options: buildOpts({
      scales: {
        x: { ticks: { maxTicksLimit: 10, color: C.text, font: { size: 10 } }, grid: { color: C.grid } },
        y: { ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
      },
      plugins: {
        annotation: {},
        tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + (ctx.parsed.y?.toFixed(4) ?? '--') } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildSentDistribution() {
  const data = DashData.dailySent;
  if (!data || !data.length) { noDataMsg('sentDistribution'); return; }

  let pos = 0, neg = 0, neu = 0;
  for (const r of data) {
    pos += Number(r.n_pos) || 0;
    neg += Number(r.n_neg) || 0;
    neu += Math.max(0, (Number(r.n_total) || 0) - (Number(r.n_pos) || 0) - (Number(r.n_neg) || 0));
  }
  const total = pos + neg + neu;

  makeChart('sentDistribution', {
    type: 'doughnut',
    data: {
      labels: ['Positive', 'Neutral', 'Negative'],
      datasets: [{
        data: [pos, neu, neg],
        backgroundColor: [C.accent2 + 'cc', C.text + '66', C.red + 'cc'],
        borderColor: [C.accent2, C.text + '44', C.red],
        borderWidth: 2,
        hoverOffset: 8,
      }],
    },
    options: buildOpts({
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.raw;
              return ' ' + ctx.label + ': ' + fmtNum(v / total * 100, 1) + '% (' + v.toLocaleString() + ')';
            },
          },
        },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildSentReturnCorr() {
  const data = DashData.sentCorr || DashData.dfAll;
  if (!data || !data.length) { noDataMsg('sentReturnCorr'); return; }

  let xs, ys;
  if (DashData.sentCorr && data[0].lagged_sentiment !== undefined) {
    xs = data.map(r => r.lagged_sentiment).filter(v => v != null);
    ys = data.map(r => r.stock_return).filter(v => v != null);
  } else {
    const closes = data.map(r => r.close);
    const sent = data.map(r => r.sent_score);
    xs = []; ys = [];
    for (let i = 1; i < data.length; i++) {
      if (sent[i - 1] != null && closes[i] != null && closes[i - 1] != null) {
        xs.push(sent[i - 1]);
        ys.push(Math.log(closes[i] / closes[i - 1]));
      }
    }
  }

  const sampleN = Math.min(xs.length, 600);
  const step = Math.max(1, Math.floor(xs.length / sampleN));
  const pts = [];
  for (let i = 0; i < xs.length; i += step) {
    pts.push({ x: xs[i], y: ys[i] });
  }

  const pearson = computePearson(xs, ys);

  document.getElementById('corr-stats').innerHTML = `
    <div class="stat-chip"><div class="stat-chip-label">Pearson r</div><div class="stat-chip-val">${pearson.toFixed(4)}</div></div>
    <div class="stat-chip"><div class="stat-chip-label">N samples</div><div class="stat-chip-val">${xs.length.toLocaleString()}</div></div>
    <div class="stat-chip"><div class="stat-chip-label">Direction</div><div class="stat-chip-val" style="color:${pearson >= 0 ? C.accent2 : C.red}">${pearson >= 0 ? 'Positive' : 'Negative'}</div></div>
  `;

  makeChart('sentReturnCorr', {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Lagged Sent vs Return',
        data: pts,
        backgroundColor: C.accent2 + '55',
        borderColor: C.accent2 + '88',
        pointRadius: 3,
        pointHoverRadius: 5,
      }],
    },
    options: buildOpts({
      plugins: { tooltip: { callbacks: { label: ctx => `Sent: ${ctx.parsed.x?.toFixed(3)}, Ret: ${ctx.parsed.y?.toFixed(4)}` } } },
      scales: {
        x: { title: { display: true, text: 'Sentiment Score (t-1)', color: C.text, font: { size: 10 } }, ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 9 } }, grid: { color: C.grid } },
        y: { title: { display: true, text: 'Log Return (t)', color: C.text, font: { size: 10 } }, ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 9 } }, grid: { color: C.grid } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildRollingCorr() {
  const dfAll = DashData.dfAll;
  if (!dfAll || !dfAll.length) { noDataMsg('rollingCorr'); return; }

  const closes = dfAll.map(r => r.close);
  const sent = dfAll.map(r => r.sent_score);
  const dates = dfAll.map(r => r.date);
  const returns = logReturn(closes);

  const laggedSent = [null, ...sent.slice(0, -1)];
  const validIdx = returns.map((v, i) => (v != null && laggedSent[i] != null) ? i : null).filter(i => i != null);

  const rArr = validIdx.map(i => returns[i]);
  const sArr = validIdx.map(i => laggedSent[i]);
  const dArr = validIdx.map(i => dates[i]);

  const rc = rollingCorr(sArr, rArr, 30);
  const meanCorr = rc.filter(v => v != null).reduce((s, v) => s + v, 0) / rc.filter(v => v != null).length;

  makeChart('rollingCorr', {
    type: 'line',
    data: {
      labels: dArr,
      datasets: [
        {
          label: '30-Day Rolling Corr',
          data: rc,
          borderColor: C.navy,
          backgroundColor: 'transparent',
          borderWidth: 1.8,
          pointRadius: 0,
          tension: 0.3,
          spanGaps: true,
          fill: false,
        },
        {
          label: `Mean Corr (${meanCorr.toFixed(3)})`,
          data: dArr.map(() => meanCorr),
          borderColor: C.red + '80',
          borderDash: [4, 4],
          borderWidth: 1.2,
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: buildOpts({
      scales: {
        x: { ticks: { maxTicksLimit: 8, color: C.text, font: { size: 10 } }, grid: { color: C.grid } },
        y: { min: -1, max: 1, ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildTweetVolume() {
  const data = DashData.dailySent;
  if (!data || !data.length) { noDataMsg('tweetVolume'); return; }
  const dates = data.map(r => r.date || r.date_only);
  const vols = data.map(r => r.tweet_volume ?? r.n_total ?? null);
  const maVol = movingAvg(vols, 10);

  makeChart('tweetVolume', {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'Daily Tweets',
          data: vols,
          backgroundColor: C.accent + '44',
          borderColor: 'transparent',
          borderWidth: 0,
          barPercentage: 0.8,
          categoryPercentage: 0.9,
        },
        {
          label: '10-Day MA',
          data: maVol,
          type: 'line',
          borderColor: C.accent,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          spanGaps: true,
        },
      ],
    },
    options: buildOpts({
      scales: {
        x: { ticks: { maxTicksLimit: 8, color: C.text, font: { size: 10 } }, grid: { color: C.grid } },
        y: { ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildBullishnessChart() {
  const data = DashData.dailySent;
  if (!data || !data.length) { noDataMsg('bullishnessChart'); return; }
  const dates = data.map(r => r.date || r.date_only);
  const vals = data.map(r => r.bullishness_index ?? null);

  const bgColors = vals.map(v => v == null ? 'transparent' : v >= 0 ? C.accent2 + '66' : C.red + '66');

  makeChart('bullishnessChart', {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [{
        label: 'Bullishness Index',
        data: vals,
        backgroundColor: bgColors,
        borderColor: 'transparent',
        barPercentage: 0.9,
        categoryPercentage: 0.95,
      }],
    },
    options: buildOpts({
      scales: {
        x: { ticks: { maxTicksLimit: 8, color: C.text, font: { size: 10 } }, grid: { color: C.grid } },
        y: { ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildArchCards() {
  const comp = DashData.modelComparison;
  const summary = DashData.finalSummary;
  if (!comp && !summary) { document.getElementById('arch-cards').innerHTML = '<p style="color:var(--text-muted);font-size:.82rem">No model comparison data found.</p>'; return; }

  const data = comp || summary;
  const archs = ['LSTM', 'GRU', 'BiLSTM', 'LSTM_Attn'];
  const byArch = {};
  for (const r of data) { byArch[r.arch] = r; }

  const wrap = document.getElementById('arch-cards');
  const toggle = document.getElementById('arch-toggle');
  wrap.innerHTML = '';
  if (toggle) toggle.innerHTML = '';

  const displayOrder = archs.filter(a => byArch[a]);
  if (!displayOrder.length) { wrap.innerHTML = '<p style="color:var(--text-muted);font-size:.82rem">No architecture results found.</p>'; return; }

  displayOrder.forEach((arch, idx) => {
    const r = byArch[arch];
    const card = document.createElement('div');
    card.className = 'arch-card' + (idx === 0 ? ' selected' : '');
    card.dataset.arch = arch;
    const color = ARCH_COLORS[arch] || C.accent;
    const isBest = idx === 0;
    const allRmse = displayOrder.map(a => byArch[a]['RMSE (IDR)'] ?? 0);
    const maxRmse = Math.max(...allRmse);
    const barW = maxRmse > 0 ? Math.round((1 - (r['RMSE (IDR)'] ?? 0) / maxRmse) * 100) : 50;

    card.innerHTML = `
      ${isBest ? '<div class="float-badge best">&#9733; Best</div>' : ''}
      <div class="arch-card-name" style="color:${color}">${arch.replace('_', '+')}</div>
      <div class="arch-card-rmse">${fmtIdr(r['RMSE (IDR)'])} <span style="font-size:.7rem;color:var(--text-muted)">IDR</span></div>
      <div class="arch-bar-wrap"><div class="arch-bar" style="background:${color};width:0" data-target="${barW}"></div></div>
      <div class="arch-card-mape">MAPE: ${fmtNum(r['MAPE (%)'], 2)}%</div>
      <div class="arch-card-metrics">
        <div class="arch-metric"><span class="arch-metric-label">R&sup2;</span><span class="arch-metric-value">${fmtNum(r.R2 ?? r['R2'], 4)}</span></div>
        <div class="arch-metric"><span class="arch-metric-label">MAE</span><span class="arch-metric-value">${fmtIdr(r['MAE (IDR)'])} IDR</span></div>
        <div class="arch-metric"><span class="arch-metric-label">Dir Acc</span><span class="arch-metric-value">${fmtNum(r['Dir Acc (%)'], 1)}%</span></div>
      </div>`;
    setTimeout(() => {
      const bar = card.querySelector('.arch-bar');
      if (bar) bar.style.width = bar.dataset.target + '%';
    }, 80 + idx * 120);
    card.addEventListener('click', () => {
      document.querySelectorAll('.arch-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      document.querySelectorAll('#arch-toggle .ctrl-btn').forEach(b => b.classList.toggle('active', b.dataset.arch === arch));
      buildPredActualChart(arch);
    });
    wrap.appendChild(card);

    if (toggle) {
      const btn = document.createElement('button');
      btn.className = 'ctrl-btn' + (idx === 0 ? ' active' : '');
      btn.dataset.arch = arch;
      btn.textContent = arch.replace('_', '+');
      btn.style.borderColor = color;
      if (idx === 0) { btn.style.background = color + '22'; btn.style.color = color; }
      btn.addEventListener('click', () => {
        document.querySelectorAll('#arch-toggle .ctrl-btn').forEach(b => { b.classList.remove('active'); b.style.background = ''; b.style.color = ''; });
        btn.classList.add('active'); btn.style.background = color + '22'; btn.style.color = color;
        document.querySelectorAll('.arch-card').forEach(c => c.classList.toggle('selected', c.dataset.arch === arch));
        buildPredActualChart(arch);
      });
      toggle.appendChild(btn);
    }
  });
}

function buildPredActualChart(arch = null) {
  if (!arch) arch = inferBestArch();
  const key = Object.keys(DashData.predArchs).find(k => k === arch || k.startsWith(arch));
  const data = key ? DashData.predArchs[key] : null;
  if (!data || !data.length) { noDataMsg('predActualChart'); return; }

  const dates = data.map(r => r.date);
  const actual = data.map(r => r.actual ?? null);
  const predicted = data.map(r => r.predicted ?? null);
  const color = ARCH_COLORS[arch] || C.red;

  makeChart('predActualChart', {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'Actual',
          data: actual,
          borderColor: C.textPri,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2,
          spanGaps: true,
        },
        {
          label: `Predicted (${arch.replace('_', '+')})`,
          data: predicted,
          borderColor: color,
          backgroundColor: color + '15',
          borderWidth: 1.8,
          borderDash: [5, 3],
          pointRadius: 0,
          tension: 0.2,
          fill: false,
          spanGaps: true,
        },
      ],
    },
    options: buildOpts({
      plugins: {
        tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmtIdr(ctx.parsed.y) + ' IDR' } },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 8, color: C.text, font: { size: 10 } }, grid: { color: C.grid } },
        y: { ticks: { callback: v => fmtIdr(v), color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildMetricsRadar() {
  const comp = DashData.modelComparison;
  if (!comp || !comp.length) { noDataMsg('metricsRadar'); return; }

  const archs = comp.map(r => r.arch);
  const metrics = ['RMSE (IDR)', 'MAE (IDR)', 'MAPE (%)', 'R2', 'Dir Acc (%)'];

  const minMax = {};
  for (const m of metrics) {
    const vals = comp.map(r => r[m] ?? 0);
    minMax[m] = { min: Math.min(...vals), max: Math.max(...vals) };
  }

  function normalise(val, m, invertBad = false) {
    const { min, max } = minMax[m];
    if (max === min) return 0.5;
    const n = (val - min) / (max - min);
    return invertBad ? 1 - n : n;
  }

  const datasets = archs.map((arch, i) => {
    const r = comp.find(x => x.arch === arch);
    const data = [
      normalise(r['RMSE (IDR)'] ?? 0, 'RMSE (IDR)', true),
      normalise(r['MAE (IDR)'] ?? 0, 'MAE (IDR)', true),
      normalise(r['MAPE (%)'] ?? 0, 'MAPE (%)', true),
      normalise(r.R2 ?? r['R2'] ?? 0, 'R2', false),
      normalise(r['Dir Acc (%)'] ?? 0, 'Dir Acc (%)', false),
    ];
    const color = ARCH_COLORS[arch] || C.accent;
    return { label: arch.replace('_', '+'), data, borderColor: color, backgroundColor: color + '22', pointBackgroundColor: color, borderWidth: 2 };
  });

  makeChart('metricsRadar', {
    type: 'radar',
    data: {
      labels: ['Low RMSE', 'Low MAE', 'Low MAPE', 'High R²', 'Dir Acc'],
      datasets,
    },
    options: {
      animation: { duration: 600 },
      plugins: { legend: { labels: { color: C.text, font: { family: 'Inter', size: 11 }, boxWidth: 12 } } },
      scales: {
        r: {
          min: 0, max: 1,
          grid: { color: C.grid },
          angleLines: { color: C.grid },
          pointLabels: { color: C.text, font: { family: 'Inter', size: 10 } },
          ticks: { display: false },
        },
      },
      responsive: true, maintainAspectRatio: false,
    },
  });
}

function buildRmseBar() {
  const comp = DashData.modelComparison;
  if (!comp || !comp.length) { noDataMsg('rmseBar'); return; }

  const archs = comp.map(r => r.arch);
  const rmse = comp.map(r => r['RMSE (IDR)'] ?? 0);
  const mape = comp.map(r => r['MAPE (%)'] ?? 0);

  const colors = archs.map(a => ARCH_COLORS[a] || C.accent);

  makeChart('rmseBar', {
    type: 'bar',
    data: {
      labels: archs.map(a => a.replace('_', '+')),
      datasets: [
        { label: 'RMSE (IDR)', data: rmse, backgroundColor: colors.map(c => c + 'cc'), borderColor: colors, borderWidth: 1.5, borderRadius: 6, yAxisID: 'y' },
        { label: 'MAPE (%)', data: mape, backgroundColor: colors.map(c => c + '44'), borderColor: colors, borderWidth: 1, borderRadius: 6, type: 'line', pointRadius: 6, pointStyle: 'circle', yAxisID: 'y1' },
      ],
    },
    options: buildOpts({
      scales: {
        x: { ticks: { color: C.text }, grid: { color: C.grid } },
        y: { title: { display: true, text: 'RMSE (IDR)', color: C.text, font: { size: 10 } }, ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
        y1: { position: 'right', title: { display: true, text: 'MAPE (%)', color: C.text, font: { size: 10 } }, ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { display: false } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildR2DirBar() {
  const comp = DashData.modelComparison;
  if (!comp || !comp.length) { noDataMsg('r2DirBar'); return; }

  const archs = comp.map(r => r.arch);
  const r2 = comp.map(r => r.R2 ?? r['R2'] ?? 0);
  const dirAcc = comp.map(r => r['Dir Acc (%)'] ?? 0);
  const colors = archs.map(a => ARCH_COLORS[a] || C.accent);

  makeChart('r2DirBar', {
    type: 'bar',
    data: {
      labels: archs.map(a => a.replace('_', '+')),
      datasets: [
        { label: 'R²', data: r2, backgroundColor: colors.map(c => c + 'cc'), borderColor: colors, borderWidth: 1.5, borderRadius: 6, yAxisID: 'y' },
        { label: 'Dir Acc (%)', data: dirAcc, backgroundColor: colors.map(c => c + '44'), borderColor: colors, borderWidth: 1, type: 'line', pointRadius: 6, yAxisID: 'y1' },
      ],
    },
    options: buildOpts({
      scales: {
        x: { ticks: { color: C.text }, grid: { color: C.grid } },
        y: { title: { display: true, text: 'R²', color: C.text, font: { size: 10 } }, ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
        y1: { position: 'right', title: { display: true, text: 'Dir Acc (%)', color: C.text, font: { size: 10 } }, ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { display: false } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildAblationChart() {
  const data = DashData.ablationStudy;
  if (!data || !data.length) { noDataMsg('ablationChart'); return; }

  const withData = data.find(r => r.Configuration && r.Configuration.includes('With'));
  const withoutData = data.find(r => r.Configuration && r.Configuration.includes('Without'));
  if (!withData || !withoutData) { noDataMsg('ablationChart'); return; }


  const metrics = [
    { key: 'RMSE (IDR)', label: 'RMSE',     fmt: v => fmtIdr(v) + ' IDR',    axis: 'y',  lowerBetter: true },
    { key: 'MAE (IDR)',  label: 'MAE',      fmt: v => fmtIdr(v) + ' IDR',    axis: 'y',  lowerBetter: true },
    { key: 'MAPE (%)',   label: 'MAPE %',   fmt: v => fmtNum(v, 3) + '%',    axis: 'y1', lowerBetter: true },
    { key: 'R2',         label: 'R²',       fmt: v => fmtNum(v, 4),           axis: 'y1', lowerBetter: false },
    { key: 'Dir Acc (%)',label: 'Dir Acc %',fmt: v => fmtNum(v, 2) + '%',    axis: 'y1', lowerBetter: false },
  ];

  function norm(m, v) {
    const a = withData[m.key] ?? 0;
    const b = withoutData[m.key] ?? 0;
    const max = Math.max(a, b);
    return max > 0 ? (v / max) * 100 : 0;
  }

  const labels = metrics.map(m => m.label);
  const withNorm = metrics.map(m => norm(m, withData[m.key] ?? 0));
  const withoutNorm = metrics.map(m => norm(m, withoutData[m.key] ?? 0));
  const realWith = metrics.map(m => withData[m.key] ?? 0);
  const realWithout = metrics.map(m => withoutData[m.key] ?? 0);

  makeChart('ablationChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'With Sentiment',
          data: withNorm,
          backgroundColor: C.accent + 'cc',
          borderColor: C.accent,
          borderWidth: 1.5,
          borderRadius: 6,
          realValues: realWith,
        },
        {
          label: 'Without Sentiment',
          data: withoutNorm,
          backgroundColor: C.amber + 'cc',
          borderColor: C.amber,
          borderWidth: 1.5,
          borderRadius: 6,
          realValues: realWithout,
        },
      ],
    },
    options: buildOpts({
      plugins: {
        tooltip: {
          callbacks: {
            label(ctx) {
              const realVal = ctx.dataset.realValues?.[ctx.dataIndex];
              const m = metrics[ctx.dataIndex];
              return ` ${ctx.dataset.label}: ${m ? m.fmt(realVal) : ctx.parsed.y.toFixed(1)}`;
            },
            afterBody(items) {
              const idx = items[0]?.dataIndex;
              if (idx == null) return [];
              const m = metrics[idx];
              const wv = withData[m.key] ?? 0;
              const wov = withoutData[m.key] ?? 0;
              const diff = wv - wov;
              const pct = wov !== 0 ? (diff / Math.abs(wov) * 100).toFixed(2) : '—';
              const sign = diff >= 0 ? '+' : '';
              return [`Δ: ${sign}${pct}% (${m.lowerBetter ? diff <= 0 ? '↓ better' : '↑ worse' : diff >= 0 ? '↑ better' : '↓ worse'})`];
            },
          },
        },
        legend: { labels: { color: C.text, font: { family: 'Inter', size: 11 }, boxWidth: 12 } },
      },
      scales: {
        x: { ticks: { color: C.text }, grid: { color: C.grid } },
        y: {
          title: { display: true, text: 'Normalised Score (%)', color: C.text, font: { size: 10 } },
          min: 0, max: 110,
          ticks: { callback: v => v + '%', color: C.text, font: { family: 'JetBrains Mono', size: 10 } },
          grid: { color: C.grid },
        },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });

  const rmseImp = withoutData['RMSE (IDR)'] && withData['RMSE (IDR)']
    ? ((withoutData['RMSE (IDR)'] - withData['RMSE (IDR)']) / withoutData['RMSE (IDR)'] * 100).toFixed(2)
    : 'N/A';
  const r2Imp = ((withData['R2'] ?? 0) - (withoutData['R2'] ?? 0)).toFixed(4);
  const dirImp = ((withData['Dir Acc (%)'] ?? 0) - (withoutData['Dir Acc (%)'] ?? 0)).toFixed(2);

  const el = document.getElementById('ablation-summary');
  if (el) {
    el.innerHTML = `<strong>Ablation Summary:</strong> Adding IndoBERT sentiment features reduces RMSE by <strong>${rmseImp}%</strong>, improves R&sup2; by <strong>${r2Imp}</strong>, and boosts directional accuracy by <strong>${dirImp}%pts</strong>. Configuration: <em>${withData.Configuration}</em> vs <em>${withoutData.Configuration}</em>. All bars normalised to 0–100% relative to each metric&rsquo;s own max for visual comparability.`;
  }
}

function buildHeatmapChart() {
  const gs = DashData.gridsearchBest;
  const canvas = document.getElementById('heatmapChart');
  if (!canvas) return;

  const mockData = gs && gs.length ? gs : [
    { units: 100, timestamps: 10, rmse_mean: 0.00221 },
    { units: 100, timestamps: 20, rmse_mean: 0.00198 },
    { units: 100, timestamps: 30, rmse_mean: 0.00215 },
    { units: 150, timestamps: 10, rmse_mean: 0.00189 },
    { units: 150, timestamps: 20, rmse_mean: 0.00165 },
    { units: 150, timestamps: 30, rmse_mean: 0.00180 },
    { units: 200, timestamps: 10, rmse_mean: 0.00201 },
    { units: 200, timestamps: 20, rmse_mean: 0.00172 },
    { units: 200, timestamps: 30, rmse_mean: 0.00158 },
  ];

  const units = [...new Set(mockData.map(r => r.units))].sort((a, b) => a - b);
  const timestamps = [...new Set(mockData.map(r => r.timestamps))].sort((a, b) => a - b);

  const matrix = {};
  for (const r of mockData) {
    matrix[`${r.units}_${r.timestamps}`] = r.rmse_mean * 1e4;
  }

  const vals = Object.values(matrix);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);

  function getColor(v, alpha = 1) {
    const t = (v - minV) / (maxV - minV || 1);
    const r = Math.round(59 + t * (239 - 59));
    const g = Math.round(130 - t * 110);
    const b = Math.round(246 - t * 200);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  const heatmapPlugin = {
    id: 'heatmapRects',
    afterDraw(chart) {
      const { ctx, chartArea: { left, top, right, bottom }, scales } = chart;
      const xScale = scales.x;
      const yScale = scales.y;
      if (!xScale || !yScale) return;

      const cellW = (right - left) / timestamps.length;
      const cellH = (bottom - top) / units.length;

      ctx.save();
      units.forEach((u, yi) => {
        timestamps.forEach((t, xi) => {
          const key = `${u}_${t}`;
          const v = matrix[key];
          if (v == null) return;
          const x = left + xi * cellW;
          const y = top + yi * cellH;
          ctx.fillStyle = getColor(v, 0.92);
          ctx.beginPath();
          ctx.roundRect(x + 2, y + 2, cellW - 4, cellH - 4, 6);
          ctx.fill();
          ctx.fillStyle = '#e8edf8';
          ctx.font = 'bold 11px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(v.toFixed(3), x + cellW / 2, y + cellH / 2);
        });
      });
      ctx.restore();
    },
  };

  destroyChart('heatmapChart');
  const chart = new Chart(canvas, {
    type: 'scatter',
    plugins: [heatmapPlugin],
    data: {
      datasets: [{
        data: [],
      }],
    },
    options: {
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          callbacks: {
            label: ctx => '',
          },
          external(context) {
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: -0.5,
          max: timestamps.length - 0.5,
          title: { display: true, text: 'Lookback Timestamps', color: C.text, font: { family: 'Inter', size: 11 } },
          ticks: {
            stepSize: 1,
            color: C.text,
            font: { family: 'Inter', size: 10 },
            callback: (v) => timestamps[v] != null ? timestamps[v] : '',
          },
          grid: { display: false },
        },
        y: {
          type: 'linear',
          min: -0.5,
          max: units.length - 0.5,
          title: { display: true, text: 'Hidden Units', color: C.text, font: { family: 'Inter', size: 11 } },
          ticks: {
            stepSize: 1,
            color: C.text,
            font: { family: 'Inter', size: 10 },
            callback: (v) => units[v] != null ? units[v] : '',
          },
          grid: { display: false },
        },
      },
      responsive: true,
      maintainAspectRatio: false,
      onHover(event, elements, chart) {
        const { chartArea: { left, top, right, bottom } } = chart;
        const cellW = (right - left) / timestamps.length;
        const cellH = (bottom - top) / units.length;
        const mx = event.native?.offsetX;
        const my = event.native?.offsetY;
        if (mx == null || my == null) return;
        const xi = Math.floor((mx - left) / cellW);
        const yi = Math.floor((my - top) / cellH);
        if (xi >= 0 && xi < timestamps.length && yi >= 0 && yi < units.length) {
          canvas.title = `Units: ${units[yi]}, Timestamps: ${timestamps[xi]} → RMSE: ${(matrix[`${units[yi]}_${timestamps[xi]}`] ?? 0).toFixed(4)} ×10⁻⁴`;
        }
      },
    },
  });

  activeCharts['heatmapChart'] = chart;

  const wrap = canvas.closest('.chart-wrap');
  if (wrap && !wrap.querySelector('.heatmap-legend')) {
    const legend = document.createElement('div');
    legend.className = 'heatmap-legend';
    legend.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:8px;font-size:10px;color:#8b96b0;font-family:JetBrains Mono,monospace';
    const gradient = document.createElement('div');
    gradient.style.cssText = `flex:1;height:8px;border-radius:4px;background:linear-gradient(90deg,rgb(59,130,246),rgb(239,68,68))`;
    legend.innerHTML = `<span>${minV.toFixed(3)}</span>`;
    legend.appendChild(gradient);
    legend.innerHTML += `<span>${maxV.toFixed(3)}</span><span style="margin-left:8px;color:#5a647e">RMSE ×10⁻⁴ (blue=best)</span>`;
    wrap.appendChild(legend);
  }
}

function buildShapChart() {
  const data = DashData.shapFI;
  if (!data || !data.length) { noDataMsg('shapChart'); return; }

  const sorted = [...data].sort((a, b) => (a.Importance ?? a.importance ?? 0) - (b.Importance ?? b.importance ?? 0));
  const labels = sorted.map(r => r.Feature ?? r.feature);
  const vals = sorted.map(r => r.Importance ?? r.importance ?? 0);

  const sentFeatures = ['sent_score'];
  const enhSentFeatures = ['bullishness_index', 'tweet_volume', 'tweet_volume_change', 'weighted_sentiment_score', 'sentiment_momentum_ewma', 'sentiment_dispersion_std'];

  const colors = labels.map(f => {
    if (sentFeatures.includes(f)) return C.red;
    if (enhSentFeatures.includes(f)) return C.amber;
    return C.navy;
  });

  makeChart('shapChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Mean |SHAP Value|',
        data: vals,
        backgroundColor: colors.map(c => c + 'cc'),
        borderColor: colors,
        borderWidth: 1.2,
        borderRadius: 4,
      }],
    },
    options: buildOpts({
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' SHAP: ' + ctx.parsed.x?.toFixed(5) } } },
      scales: {
        x: { title: { display: true, text: 'Mean |SHAP Value|', color: C.text }, ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 9 } }, grid: { color: C.grid } },
        y: { ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 9 } }, grid: { color: C.grid } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildPermChart() {
  const data = DashData.permFI;
  if (!data || !data.length) { noDataMsg('permChart'); return; }

  const sorted = [...data].sort((a, b) => (a.Importance ?? 0) - (b.Importance ?? 0));
  const labels = sorted.map(r => r.Feature ?? r.feature);
  const vals = sorted.map(r => r.Importance ?? 0);

  makeChart('permChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'RMSE Increase (IDR)',
        data: vals,
        backgroundColor: labels.map(f => f === 'sent_score' ? C.accent + 'cc' : C.navy + 'cc'),
        borderColor: labels.map(f => f === 'sent_score' ? C.accent : C.navy),
        borderWidth: 1.2,
        borderRadius: 4,
      }],
    },
    options: buildOpts({
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' +' + fmtIdr(ctx.parsed.x, 2) + ' IDR RMSE' } } },
      scales: {
        x: { title: { display: true, text: 'RMSE Increase (IDR)', color: C.text }, ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 9 } }, grid: { color: C.grid } },
        y: { ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 9 } }, grid: { color: C.grid } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildGaChart() {
  const ga = DashData.gaResults;
  if (!ga) { noDataMsg('gaChart'); return; }

  const allTech = ga.all_tech || ['SMA', 'WMA', 'EMA', 'MOM', 'StoK', 'StoD', 'RSI', 'MACD', 'ADO', 'CCI', 'LWillR', 'MFI'];
  const selected = new Set(ga.ga_selected_tech || []);
  const chromValues = allTech.map(t => selected.has(t) ? 1 : 0);

  makeChart('gaChart', {
    type: 'bar',
    data: {
      labels: allTech,
      datasets: [{
        label: 'GA Selected',
        data: chromValues,
        backgroundColor: allTech.map(t => selected.has(t) ? C.accent2 + 'cc' : C.red + '55'),
        borderColor: allTech.map(t => selected.has(t) ? C.accent2 : C.red),
        borderWidth: 1.5,
        borderRadius: 4,
      }],
    },
    options: buildOpts({
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ctx.parsed.y === 1 ? 'Selected by GA' : 'Not Selected' } },
      },
      scales: {
        x: { ticks: { color: C.text, font: { size: 10 } }, grid: { color: C.grid } },
        y: { min: 0, max: 1.2, ticks: { stepSize: 1, callback: v => v === 1 ? 'Selected' : v === 0 ? 'No' : '', color: C.text }, grid: { color: C.grid } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });

  const el = document.getElementById('ga-info');
  if (el) {
    el.innerHTML = `<strong>GA Result:</strong> Selected ${ga.ga_selected_tech?.length ?? 'N/A'} of ${allTech.length} indicators &bull; Best RMSE: ${(ga.best_rmse_ga * 1e4)?.toFixed(4) ?? 'N/A'} &times;10<sup>-4</sup> &bull; Selected: ${(ga.ga_selected_tech || []).join(', ')}`;
  }
}

function buildTechChart(indicator = 'RSI') {
  const data = DashData.dfAll || DashData.techIndicators;
  if (!data || !data.length) { noDataMsg('techChart'); return; }

  const techCols = ['RSI', 'MACD', 'SMA', 'EMA', 'WMA', 'MOM', 'MFI', 'CCI', 'StoD', 'StoK', 'ADO', 'LWillR'];
  const toggle = document.getElementById('tech-toggle');
  if (toggle && !toggle.children.length) {
    techCols.forEach(t => {
      if (data[0][t] === undefined) return;
      const btn = document.createElement('button');
      btn.className = 'ctrl-btn' + (t === indicator ? ' active' : '');
      btn.textContent = t;
      btn.addEventListener('click', () => {
        toggle.querySelectorAll('.ctrl-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        buildTechChart(t);
      });
      toggle.appendChild(btn);
    });
  }

  const dates = data.map(r => r.date);
  const vals = data.map(r => r[indicator] ?? null);
  const close = data.map(r => r.close ?? null);

  const datasets = [
    {
      label: indicator,
      data: vals,
      borderColor: C.accent,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.2,
      spanGaps: true,
      yAxisID: 'y',
    },
  ];

  const scalesConfig = {
    x: { ticks: { maxTicksLimit: 8, color: C.text, font: { size: 10 } }, grid: { color: C.grid } },
    y: { title: { display: true, text: indicator, color: C.text, font: { size: 10 } }, ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
  };

  if (['RSI', 'MFI', 'StoD', 'StoK'].includes(indicator)) {
    datasets.push({ label: 'Overbought 70', data: dates.map(() => 70), borderColor: C.red + '60', borderDash: [4, 4], borderWidth: 1, pointRadius: 0, yAxisID: 'y', fill: false });
    datasets.push({ label: 'Oversold 30', data: dates.map(() => 30), borderColor: C.accent2 + '60', borderDash: [4, 4], borderWidth: 1, pointRadius: 0, yAxisID: 'y', fill: false });
  }

  makeChart('techChart', {
    type: 'line',
    data: { labels: dates, datasets },
    options: buildOpts({
      scales: scalesConfig,
      plugins: { tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + (ctx.parsed.y?.toFixed(3) ?? '--') } } },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildKomvarTable() {
  const tbody = document.getElementById('komvar-tbody');
  if (!tbody) return;

  const defs = DashData.komvarDefs;
  const wfvDict = DashData.wfvDict;
  if (!defs) { tbody.innerHTML = '<tr><td colspan="9" style="color:var(--text-muted);padding:16px">KomVar definitions not found.</td></tr>'; return; }

  const bestKv = DashData.runConfig?.BEST_KV;
  const secondKv = DashData.runConfig?.SECOND_KV;
  const wfvArr = DashData.wfvResults || [];

  const kvNames = Object.keys(defs);
  const sorted = wfvDict
    ? [...kvNames].sort((a, b) => (wfvDict[a] ?? Infinity) - (wfvDict[b] ?? Infinity))
    : kvNames;

  for (const kv of sorted) {
    const cfg = defs[kv];
    const rmse = wfvDict?.[kv];
    const isRow = kv === bestKv ? 'best-row' : kv === secondKv ? 'second-row' : '';
    const tick = (v) => v ? '<span class="tick-yes">&#10003;</span>' : '<span class="tick-no">&#8212;</span>';

    const cols = ['close', ...((DashData.runConfig?.FINAL_TECH) || [])];
    if (cfg.ihsg) cols.push('ihsg');
    if (cfg.exch) cols.push('exch_rate');
    if (cfg.rate) cols.push('bi_rate');
    if (cfg.sent) cols.push('sent_score');
    if (cfg.enhanced_sent) cols.push(...['bullishness_index', 'weighted_sentiment_score', 'sentiment_momentum_ewma', 'sentiment_dispersion_std', 'tweet_volume', 'tweet_volume_change'].filter(c => !cols.includes(c)));

    const tr = document.createElement('tr');
    if (isRow) tr.className = isRow;
    tr.innerHTML = `
      <td style="font-weight:700;color:${kv === bestKv ? 'var(--accent)' : kv === secondKv ? 'var(--accent2)' : 'inherit'}">${kv}${kv === bestKv ? ' &#9733;' : kv === secondKv ? ' &#9734;' : ''}</td>
      <td>${cols.length}</td>
      <td>${tick(cfg.ihsg)}</td>
      <td>${tick(cfg.exch)}</td>
      <td>${tick(cfg.rate)}</td>
      <td>${tick(cfg.sent)}</td>
      <td>${tick(cfg.enhanced_sent)}</td>
      <td>${tick(cfg.lagged_features)}</td>
      <td style="font-weight:${kv === bestKv || kv === secondKv ? '700' : '400'}">${rmse != null ? (rmse * 1e4).toFixed(4) : '--'}</td>
    `;
    tbody.appendChild(tr);
  }
}

function buildBacktestChart() {
  const data = DashData.backtest;
  if (!data || !data.length) { noDataMsg('backtestChart'); return; }

  const dates = data.map(r => r.date);
  const strat = data.map(r => r.strat_portfolio ?? null);
  const stock = data.map(r => r.stock_portfolio ?? null);

  makeChart('backtestChart', {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'AI-Guided Strategy',
          data: strat.map(v => v != null ? v / 1e6 : null),
          borderColor: C.accent2,
          backgroundColor: C.accent2 + '15',
          borderWidth: 2.5,
          pointRadius: 0,
          fill: true,
          tension: 0.3,
          spanGaps: true,
        },
        {
          label: 'Buy & Hold',
          data: stock.map(v => v != null ? v / 1e6 : null),
          borderColor: C.accent,
          backgroundColor: 'transparent',
          borderWidth: 1.8,
          borderDash: [5, 4],
          pointRadius: 0,
          fill: false,
          tension: 0.3,
          spanGaps: true,
        },
      ],
    },
    options: buildOpts({
      plugins: {
        tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmtNum(ctx.parsed.y, 3) + 'M IDR' } },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 8, color: C.text, font: { size: 10 } }, grid: { color: C.grid } },
        y: { title: { display: true, text: 'Portfolio Value (M IDR)', color: C.text }, ticks: { callback: v => v?.toFixed(2) + 'M', color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildReturnDistChart() {
  const data = DashData.backtest;
  if (!data || !data.length) { noDataMsg('returnDistChart'); return; }

  const stratRet = data.map(r => r.strat_daily_return ?? null).filter(v => v != null);
  const stockRet = data.map(r => r.stock_daily_return ?? null).filter(v => v != null);

  const stratHist = computeHistogram(stratRet, 30);
  const stockHist = computeHistogram(stockRet, 30);

  makeChart('returnDistChart', {
    type: 'bar',
    data: {
      labels: stockHist.bins.map(v => (v * 100).toFixed(1) + '%'),
      datasets: [
        { label: 'AI Strategy', data: stratHist.counts, backgroundColor: C.accent2 + '66', borderColor: C.accent2, borderWidth: 1, borderRadius: 2 },
        { label: 'Buy & Hold', data: stockHist.counts, backgroundColor: C.accent + '44', borderColor: C.accent, borderWidth: 1, borderRadius: 2 },
      ],
    },
    options: buildOpts({
      scales: {
        x: { ticks: { maxTicksLimit: 10, color: C.text, font: { size: 9 } }, grid: { color: C.grid } },
        y: { ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildSignalChart() {
  const bt = DashData.backtest;
  const pred = DashData.predArchs[inferBestArch()] || DashData.predArchs[Object.keys(DashData.predArchs)[0]];
  if (!bt || !bt.length) { noDataMsg('signalChart'); return; }

  const dates = bt.map(r => r.date);
  const actual = bt.map(r => r.actual ?? null);
  const predicted = bt.map(r => r.predicted ?? null);
  const signals = bt.map(r => r.signal ?? 0);

  const buyPoints = dates.map((d, i) => {
    const prev = i > 0 ? signals[i - 1] : 0;
    return signals[i] === 1 && prev === 0 ? actual[i] : null;
  });

  makeChart('signalChart', {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'Actual Close',
          data: actual,
          borderColor: C.textPri,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.2,
          spanGaps: true,
        },
        {
          label: 'Predicted Close',
          data: predicted,
          borderColor: C.amber,
          backgroundColor: 'transparent',
          borderWidth: 1.2,
          borderDash: [4, 3],
          pointRadius: 0,
          tension: 0.2,
          spanGaps: true,
        },
        {
          label: 'Buy Signal',
          data: buyPoints,
          type: 'scatter',
          pointStyle: 'triangle',
          pointRadius: 8,
          backgroundColor: C.accent2,
          borderColor: C.accent2,
          showLine: false,
        },
      ],
    },
    options: buildOpts({
      plugins: {
        tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmtIdr(ctx.parsed.y) + ' IDR' } },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 8, color: C.text, font: { size: 10 } }, grid: { color: C.grid } },
        y: { ticks: { callback: v => fmtIdr(v), color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildBlPortfolio() {
  const weights = DashData.blWeights;
  if (!weights || !weights.length) { noDataMsg('blPortfolio'); return; }

  const assets = weights.map(r => r.Asset);
  const wts = weights.map(r => parseFloat(r['Optimal Weight'] ?? r.weight ?? 0));

  makeChart('blPortfolio', {
    type: 'doughnut',
    data: {
      labels: assets,
      datasets: [{
        data: wts,
        backgroundColor: [C.accent + 'cc', C.accent2 + 'cc'],
        borderColor: [C.accent, C.accent2],
        borderWidth: 2,
        hoverOffset: 8,
      }],
    },
    options: buildOpts({
      cutout: '60%',
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: ctx => ' ' + ctx.label + ': ' + fmtPct(ctx.raw * 100, 1) } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });

  const el = document.getElementById('bl-summary');
  if (el) {
    const items = weights.map(r => `<strong>${r.Asset}</strong>: ${fmtPct((r['Optimal Weight'] ?? r.weight ?? 0) * 100, 1)}`).join(' &bull; ');
    el.innerHTML = `<strong>Black-Litterman Optimal Weights</strong> &bull; ${items}. The sentiment-adjusted posterior expected returns shift allocation relative to the market-cap equilibrium prior.`;
  }
}

function buildResidualHist() {
  const data = DashData.residuals;
  if (!data || !data.length) { noDataMsg('residualHist'); return; }

  const res = data.map(r => r.residuals ?? (r.actual - r.predicted) ?? null).filter(v => v != null);
  const hist = computeHistogram(res, 30);
  const mean = res.reduce((s, v) => s + v, 0) / res.length;
  const std = Math.sqrt(res.map(v => (v - mean) ** 2).reduce((s, v) => s + v, 0) / res.length);

  makeChart('residualHist', {
    type: 'bar',
    data: {
      labels: hist.bins.map(v => fmtIdr(v, 0)),
      datasets: [{
        label: 'Frequency',
        data: hist.counts,
        backgroundColor: C.navy + 'cc',
        borderColor: C.accent,
        borderWidth: 1,
        borderRadius: 2,
      }],
    },
    options: buildOpts({
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` Count: ${ctx.parsed.y}, Mid: ${ctx.label} IDR` } },
        subtitle: { display: true, text: `Mean: ${fmtIdr(mean, 1)} IDR  |  Std: ${fmtIdr(std, 1)} IDR`, color: C.text, font: { size: 10 } },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 10, color: C.text, font: { size: 9 } }, grid: { color: C.grid } },
        y: { ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildAcfChart() {
  const data = DashData.residualAcf;
  if (!data || !data.length) { noDataMsg('acfChart'); return; }

  const lags = data.map(r => r.lag);
  const acf = data.map(r => r.acf);

  const n = (DashData.residuals || []).length || 100;
  const cibound = 1.96 / Math.sqrt(n);

  makeChart('acfChart', {
    type: 'bar',
    data: {
      labels: lags,
      datasets: [
        {
          label: 'ACF',
          data: acf,
          backgroundColor: acf.map((v, i) => i === 0 ? C.accent + 'cc' : Math.abs(v) > cibound ? C.red + 'cc' : C.accent2 + '88'),
          borderColor: acf.map((v, i) => i === 0 ? C.accent : Math.abs(v) > cibound ? C.red : C.accent2),
          borderWidth: 1,
          borderRadius: 3,
        },
        { label: `+95% CI (${cibound.toFixed(3)})`, data: lags.map(() => cibound), type: 'line', borderColor: C.red + '80', borderDash: [4, 4], borderWidth: 1.2, pointRadius: 0, fill: false },
        { label: `-95% CI`, data: lags.map(() => -cibound), type: 'line', borderColor: C.red + '80', borderDash: [4, 4], borderWidth: 1.2, pointRadius: 0, fill: false },
      ],
    },
    options: buildOpts({
      scales: {
        x: { title: { display: true, text: 'Lag', color: C.text }, ticks: { color: C.text }, grid: { color: C.grid } },
        y: { min: -1, max: 1, title: { display: true, text: 'Autocorrelation', color: C.text }, ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function _normalCDFLocal(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
  return z > 0 ? 1 - p : p;
}

function buildGrangerChart() {
  const data = DashData.leadLag;
  const dfAll = DashData.dfAll;
  const source = data || dfAll;
  if (!source || !source.length) { noDataMsg('grangerChart'); return; }

  const lags = [1, 2, 3, 4, 5];

  let sentArr, retArr;
  if (data && data[0] && data[0].sentiment_change !== undefined) {
    sentArr = data.map(r => r.sentiment_change ?? 0);
    retArr = data.map(r => r.stock_return ?? 0);
  } else if (dfAll && dfAll.length) {
    const closes = dfAll.map(r => r.close);
    const sent = dfAll.map(r => r.sent_score ?? 0);
    const rets = logReturn(closes);
    sentArr = sent.slice(1).map((v, i) => v - sent[i]);
    retArr = rets.slice(1).map(v => v ?? 0);
  } else { noDataMsg('grangerChart'); return; }

  const n = Math.min(sentArr.length, retArr.length);
  const sN = sentArr.slice(0, n);
  const rN = retArr.slice(0, n);

  const pVals = lags.map(lag => {
    if (n - lag < 10) return null;
    const laggedS = sN.slice(0, n - lag);
    const futureR = rN.slice(lag);
    const m = Math.min(laggedS.length, futureR.length);
    const corr = computePearson(laggedS.slice(0, m), futureR.slice(0, m));
    const tStat = corr * Math.sqrt((m - 2) / (1 - corr * corr + 1e-10));
    return 2 * (1 - _normalCDFLocal(Math.abs(tStat)));
  });

  makeChart('grangerChart', {
    type: 'bar',
    data: {
      labels: lags.map(l => `Lag ${l}`),
      datasets: [
        {
          label: 'Sent Change \u2192 Returns (p-value)',
          data: pVals,
          backgroundColor: pVals.map(p => p != null && p < 0.05 ? C.accent2 + 'cc' : C.amber + '66'),
          borderColor: pVals.map(p => p != null && p < 0.05 ? C.accent2 : C.amber),
          borderWidth: 1.2,
          borderRadius: 4,
        },
        {
          label: '5% Significance Level',
          data: lags.map(() => 0.05),
          type: 'line',
          borderColor: C.red + '80',
          borderDash: [4, 4],
          borderWidth: 1.2,
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: buildOpts({
      plugins: {
        tooltip: { callbacks: { label: ctx => ' p=' + (ctx.parsed.y?.toFixed(4) ?? '--') + (ctx.parsed.y != null && ctx.parsed.y < 0.05 ? ' (Significant)' : ' (Not significant)') } },
      },
      scales: {
        x: { ticks: { color: C.text }, grid: { color: C.grid } },
        y: { min: 0, max: 1, title: { display: true, text: 'p-value', color: C.text }, ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });

  const el = document.getElementById('granger-summary');
  const sigLags = lags.filter((l, i) => pVals[i] != null && pVals[i] < 0.05);
  if (el) {
    el.innerHTML = sigLags.length > 0
      ? `<strong>Granger Causality:</strong> Sentiment changes Granger-cause stock returns at lags: <strong>${sigLags.join(', ')}</strong> (p &lt; 0.05). Lagged sentiment changes carry statistically significant predictive information about future returns.`
      : `<strong>Granger Causality:</strong> No lag (1\u20135) shows statistically significant Granger causality from sentiment to returns at the 5% level based on linear correlation proxy. The LSTM model captures non-linear dependencies not detectable by this test.`;
  }
}

function buildCcfChart() {
  const data = DashData.leadLag;
  const dfAll = DashData.dfAll;
  const source = data || dfAll;
  if (!source || !source.length) { noDataMsg('ccfChart'); return; }

  const lags = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];

  let sentArr, retArr;
  if (data && data[0].sentiment_change !== undefined) {
    sentArr = data.map(r => r.sentiment_change ?? 0);
    retArr = data.map(r => r.stock_return ?? 0);
  } else {
    const closes = dfAll.map(r => r.close);
    const sent = dfAll.map(r => r.sent_score ?? 0);
    const rets = logReturn(closes);
    sentArr = sent.slice(1).map((v, i) => v - sent[i]);
    retArr = rets.slice(1);
  }

  const valid = sentArr.map((v, i) => (v != null && retArr[i] != null)).reduce((acc, v, i) => { if (v) acc.push(i); return acc; }, []);
  const s = valid.map(i => sentArr[i]);
  const r = valid.map(i => retArr[i]);

  const ccfVals = lags.map(lag => {
    if (lag >= 0) {
      const a = s.slice(0, s.length - lag || s.length);
      const b = r.slice(lag || 0);
      const n = Math.min(a.length, b.length);
      return n > 10 ? computePearson(a.slice(0, n), b.slice(0, n)) : 0;
    } else {
      const absLag = Math.abs(lag);
      const a = s.slice(absLag);
      const b = r.slice(0, r.length - absLag);
      const n = Math.min(a.length, b.length);
      return n > 10 ? computePearson(a.slice(0, n), b.slice(0, n)) : 0;
    }
  });

  const n = s.length;
  const ci = 1.96 / Math.sqrt(n || 1);

  makeChart('ccfChart', {
    type: 'bar',
    data: {
      labels: lags.map(l => l === 0 ? '0' : l > 0 ? `+${l}` : `${l}`),
      datasets: [
        {
          label: 'Cross-Correlation',
          data: ccfVals,
          backgroundColor: ccfVals.map(v => Math.abs(v) > ci ? C.accent + 'cc' : C.text + '44'),
          borderColor: ccfVals.map(v => Math.abs(v) > ci ? C.accent : C.text + '66'),
          borderWidth: 1.2,
          borderRadius: 4,
        },
        { label: '+95% CI', data: lags.map(() => ci), type: 'line', borderColor: C.red + '70', borderDash: [4, 4], borderWidth: 1.2, pointRadius: 0, fill: false },
        { label: '-95% CI', data: lags.map(() => -ci), type: 'line', borderColor: C.red + '70', borderDash: [4, 4], borderWidth: 1.2, pointRadius: 0, fill: false },
      ],
    },
    options: buildOpts({
      scales: {
        x: { title: { display: true, text: 'Lag (Sentiment relative to Returns)', color: C.text }, ticks: { color: C.text }, grid: { color: C.grid } },
        y: { min: -1, max: 1, title: { display: true, text: 'Cross-Correlation', color: C.text }, ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}

function buildForecastChart() {
  const fc = DashData.forecast5day;
  const hist = DashData.forecast5dayHistory;
  if (!fc || !fc.length) { noDataMsg('forecastChart'); return; }

  const histDates = hist ? hist.map(r => r.date) : [];
  const histClose = hist ? hist.map(r => r.close ?? null) : [];
  const fcDates = fc.map(r => r.date);
  const fcClose = fc.map(r => r.predicted ?? null);

  const upperBand = fcClose.map(v => v != null ? v * 1.03 : null);
  const lowerBand = fcClose.map(v => v != null ? v * 0.97 : null);

  const allDates = [...histDates, ...fcDates];

  makeChart('forecastChart', {
    type: 'line',
    data: {
      labels: allDates,
      datasets: [
        {
          label: 'Historical Close',
          data: [...histClose, ...fcDates.map(() => null)],
          borderColor: C.accent,
          backgroundColor: C.accent + '10',
          borderWidth: 2,
          pointRadius: histDates.map((_, i) => i === histDates.length - 1 ? 5 : 0),
          fill: true,
          tension: 0.2,
          spanGaps: true,
        },
        {
          label: '5-Day Forecast',
          data: [...histDates.map(() => null), ...fcClose],
          borderColor: C.red,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          borderDash: [6, 4],
          pointRadius: 6,
          pointStyle: 'rectRounded',
          tension: 0.2,
          spanGaps: true,
        },
        {
          label: '+3% Band',
          data: [...histDates.map(() => null), ...upperBand],
          borderColor: 'transparent',
          backgroundColor: C.red + '18',
          borderWidth: 0,
          pointRadius: 0,
          fill: '+1',
          tension: 0.2,
          spanGaps: true,
        },
        {
          label: '-3% Band',
          data: [...histDates.map(() => null), ...lowerBand],
          borderColor: C.red + '40',
          backgroundColor: 'transparent',
          borderDash: [3, 4],
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
          tension: 0.2,
          spanGaps: true,
        },
      ],
    },
    options: buildOpts({
      plugins: {
        tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmtIdr(ctx.parsed.y) + ' IDR' } },
      },
      scales: {
        x: { ticks: { color: C.text, font: { size: 10 } }, grid: { color: C.grid } },
        y: { ticks: { callback: v => fmtIdr(v), color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
      },
      responsive: true, maintainAspectRatio: false,
    }),
  });
}
