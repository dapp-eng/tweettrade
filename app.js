(function () {

  function animateNum(el, targetStr) {
    const num = parseFloat(targetStr.replace(/[^0-9.-]/g, ''));
    if (isNaN(num)) { el.textContent = targetStr; return; }
    const isFrac = targetStr.includes('.');
    const dec = isFrac ? (targetStr.split('.')[1] || '').length : 0;
    const suffix = targetStr.replace(/[\d.,\-]/g, '').trim();
    const start = performance.now();
    const duration = 900;
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const current = num * ease;
      if (dec > 0) {
        el.textContent = current.toFixed(dec) + (suffix ? ' ' + suffix : '');
      } else {
        el.textContent = Math.round(current).toLocaleString('id-ID') + (suffix ? ' ' + suffix : '');
      }
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function buildSparkline(canvasId, values, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !values || !values.length) return;
    const valid = values.filter(v => v != null && !isNaN(v));
    if (!valid.length) return;
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: valid.map((_, i) => i),
        datasets: [{
          data: valid,
          borderColor: color || '#3b82f6',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
          backgroundColor: (color || '#3b82f6') + '18',
        }],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
        elements: { line: { borderCapStyle: 'round' } },
      },
    });
  }

  function populateKpis() {
    const comp = DashData.modelComparison;
    const backtest = DashData.backtest;
    const dailySent = DashData.dailySent;

    if (!comp || !comp.length) return;

    const sorted = [...comp].sort((a, b) => (a['RMSE (IDR)'] ?? Infinity) - (b['RMSE (IDR)'] ?? Infinity));
    const best = sorted[0];

    const rmseEl = document.querySelector('[data-key="rmse"]');
    const mapeEl = document.querySelector('[data-key="mape"]');
    const r2El = document.querySelector('[data-key="r2"]');
    const diracEl = document.querySelector('[data-key="diracc"]');
    const sharpeEl = document.querySelector('[data-key="sharpe"]');
    const tweetsEl = document.querySelector('[data-key="tweets"]');

    if (rmseEl && best['RMSE (IDR)'] != null) {
      animateNum(rmseEl, Math.round(best['RMSE (IDR)']).toLocaleString('id-ID'));
    }
    if (mapeEl && best['MAPE (%)'] != null) {
      animateNum(mapeEl, best['MAPE (%)'].toFixed(2) + '%');
    }
    if (r2El && (best.R2 != null || best['R2'] != null)) {
      animateNum(r2El, (best.R2 ?? best['R2']).toFixed(4));
    }
    if (diracEl && best['Dir Acc (%)'] != null) {
      animateNum(diracEl, best['Dir Acc (%)'].toFixed(1) + '%');
    }

    if (backtest && backtest.length) {
      const stratRet = backtest.map(r => r.strat_daily_return).filter(v => v != null && !isNaN(v));
      if (stratRet.length > 1 && sharpeEl) {
        const mean = stratRet.reduce((s, v) => s + v, 0) / stratRet.length;
        const rfDaily = 0.06 / 252;
        const excess = stratRet.map(r => r - rfDaily);
        const meanEx = excess.reduce((s, v) => s + v, 0) / excess.length;
        const std = Math.sqrt(excess.map(v => (v - meanEx) ** 2).reduce((s, v) => s + v, 0) / excess.length);
        const sharpe = std > 0 ? (meanEx / std) * Math.sqrt(252) : 0;
        animateNum(sharpeEl, sharpe.toFixed(3));
      }
    }

    if (dailySent && dailySent.length && tweetsEl) {
      const total = dailySent.reduce((s, r) => s + (Number(r.n_total) || 0), 0);
      if (total > 0) animateNum(tweetsEl, total.toLocaleString('id-ID'));
    }

    const allRmse = sorted.map(r => r['RMSE (IDR)'] ?? null);
    const allMape = sorted.map(r => r['MAPE (%)'] ?? null);
    const allR2 = sorted.map(r => r.R2 ?? r['R2'] ?? null);
    const allDir = sorted.map(r => r['Dir Acc (%)'] ?? null);

    buildSparkline('spark-rmse', allRmse.map(v => v != null ? 1 / v : null), '#ef4444');
    buildSparkline('spark-mape', allMape.map(v => v != null ? 1 / v : null), '#f59e0b');
    buildSparkline('spark-r2', allR2, '#3b82f6');
    buildSparkline('spark-dirac', allDir, '#10b981');

    if (backtest && backtest.length) {
      const stratPf = backtest.map(r => r.strat_portfolio).filter(v => v != null);
      buildSparkline('spark-sharpe', stratPf, '#10b981');
    }

    if (dailySent && dailySent.length) {
      const vols = dailySent.slice(-60).map(r => r.n_total ?? 0);
      buildSparkline('spark-tweets', vols, '#a78bfa');
    }

    const priceEl = document.getElementById('nav-price-val');
    if (priceEl) {
      const bbca = DashData.dfAll || DashData.bbca;
      if (bbca && bbca.length) {
        const last = bbca[bbca.length - 1];
        if (last && last.close != null) {
          priceEl.textContent = 'IDR ' + Math.round(last.close).toLocaleString('id-ID');
        }
      }
    }
  }

  function populateSentKpis() {
    const data = DashData.dailySent;
    const wrap = document.getElementById('sent-kpis');
    if (!wrap || !data || !data.length) return;

    const nPos = data.reduce((s, r) => s + (Number(r.n_pos) || 0), 0);
    const nNeg = data.reduce((s, r) => s + (Number(r.n_neg) || 0), 0);
    const nTotal = data.reduce((s, r) => s + (Number(r.n_total) || 0), 0);
    const nNeu = Math.max(0, nTotal - nPos - nNeg);

    const avgSent = data.map(r => r.sent_score).filter(v => v != null);
    const meanSent = avgSent.length ? avgSent.reduce((s, v) => s + v, 0) / avgSent.length : null;

    const bi = data.map(r => r.bullishness_index).filter(v => v != null);
    const meanBi = bi.length ? bi.reduce((s, v) => s + v, 0) / bi.length : null;

    const items = [
      { label: 'Total Tweets', val: nTotal.toLocaleString('id-ID'), sub: 'BBCA corpus', cls: '' },
      { label: 'Positive', val: nPos.toLocaleString('id-ID'), sub: fmtNum(nPos / nTotal * 100, 1) + '% of total', cls: 'positive' },
      { label: 'Negative', val: nNeg.toLocaleString('id-ID'), sub: fmtNum(nNeg / nTotal * 100, 1) + '% of total', cls: 'negative' },
      { label: 'Neutral', val: nNeu.toLocaleString('id-ID'), sub: fmtNum(nNeu / nTotal * 100, 1) + '% of total', cls: '' },
      { label: 'Avg Sent Score', val: meanSent != null ? meanSent.toFixed(4) : '--', sub: 'pos/(pos+neg)', cls: meanSent != null && meanSent >= 0.5 ? 'positive' : 'negative' },
      { label: 'Avg Bullishness', val: meanBi != null ? meanBi.toFixed(4) : '--', sub: 'ln((1+pos)/(1+neg))', cls: meanBi != null && meanBi >= 0 ? 'positive' : 'negative' },
      { label: 'Trading Days', val: data.length.toLocaleString('id-ID'), sub: 'with sentiment data', cls: '' },
    ];

    wrap.innerHTML = items.map(item => `
      <div class="metric-card ${item.cls}">
        <div class="mc-label">${item.label}</div>
        <div class="mc-value">${item.val}</div>
        <div class="mc-sub">${item.sub}</div>
      </div>`).join('');
  }

  function populateBacktestKpis() {
    const bt = DashData.backtest;
    const wrap = document.getElementById('backtest-kpis');
    if (!wrap || !bt || !bt.length) return;

    const stratPf = bt.map(r => r.strat_portfolio).filter(v => v != null);
    const stockPf = bt.map(r => r.stock_portfolio).filter(v => v != null);

    const initialCapital = 10000000;
    const stratFinal = stratPf.length ? stratPf[stratPf.length - 1] : null;
    const stockFinal = stockPf.length ? stockPf[stockPf.length - 1] : null;
    const stratReturn = stratFinal != null ? ((stratFinal - initialCapital) / initialCapital * 100) : null;
    const stockReturn = stockFinal != null ? ((stockFinal - initialCapital) / initialCapital * 100) : null;

    const stratDailyRet = bt.map(r => r.strat_daily_return).filter(v => v != null && !isNaN(v));
    const stockDailyRet = bt.map(r => r.stock_daily_return).filter(v => v != null && !isNaN(v));

    function sharpe(rets) {
      if (!rets.length) return null;
      const rfD = 0.06 / 252;
      const ex = rets.map(r => r - rfD);
      const mu = ex.reduce((s, v) => s + v, 0) / ex.length;
      const sigma = Math.sqrt(ex.map(v => (v - mu) ** 2).reduce((s, v) => s + v, 0) / ex.length);
      return sigma > 0 ? (mu / sigma) * Math.sqrt(252) : null;
    }

    function maxDD(portfolio) {
      let peak = portfolio[0] ?? initialCapital;
      let mdd = 0;
      for (const v of portfolio) {
        if (v > peak) peak = v;
        const dd = (peak - v) / peak;
        if (dd > mdd) mdd = dd;
      }
      return mdd * 100;
    }

    const stratSharpe = sharpe(stratDailyRet);
    const stockSharpe = sharpe(stockDailyRet);
    const stratMdd = stratPf.length ? maxDD(stratPf) : null;
    const stockMdd = stockPf.length ? maxDD(stockPf) : null;

    const signals = bt.map(r => r.signal ?? 0);
    const nTrades = signals.reduce((s, v, i) => s + (i > 0 && v === 1 && signals[i - 1] === 0 ? 1 : 0), 0);

    const items = [
      { label: 'Strategy Return', val: stratReturn != null ? (stratReturn >= 0 ? '+' : '') + stratReturn.toFixed(2) + '%' : '--', sub: 'vs initial capital', cls: stratReturn != null && stratReturn >= 0 ? 'positive' : 'negative' },
      { label: 'Buy & Hold Return', val: stockReturn != null ? (stockReturn >= 0 ? '+' : '') + stockReturn.toFixed(2) + '%' : '--', sub: 'benchmark return', cls: stockReturn != null && stockReturn >= 0 ? 'positive' : 'negative' },
      { label: 'Strategy Sharpe', val: stratSharpe != null ? stratSharpe.toFixed(3) : '--', sub: 'annualised', cls: stratSharpe != null && stratSharpe >= 1 ? 'positive' : '' },
      { label: 'B&H Sharpe', val: stockSharpe != null ? stockSharpe.toFixed(3) : '--', sub: 'benchmark Sharpe', cls: '' },
      { label: 'Strategy Max DD', val: stratMdd != null ? stratMdd.toFixed(2) + '%' : '--', sub: 'maximum drawdown', cls: 'negative' },
      { label: 'B&H Max DD', val: stockMdd != null ? stockMdd.toFixed(2) + '%' : '--', sub: 'benchmark max DD', cls: 'negative' },
      { label: 'Total Trades', val: nTrades.toLocaleString(), sub: 'buy entries', cls: '' },
    ];

    wrap.innerHTML = items.map(item => `
      <div class="metric-card ${item.cls}">
        <div class="mc-label">${item.label}</div>
        <div class="mc-value">${item.val}</div>
        <div class="mc-sub">${item.sub}</div>
      </div>`).join('');
  }

  function populateForecastKpis() {
    const fc = DashData.forecast5day;
    const wrap = document.getElementById('forecast-kpis');
    if (!wrap || !fc || !fc.length) return;

    const hist = DashData.forecast5dayHistory;
    const lastHistClose = hist && hist.length ? hist[hist.length - 1].close : null;
    const firstFc = fc[0].predicted;
    const lastFc = fc[fc.length - 1].predicted;

    const totalChg = lastHistClose != null && lastFc != null ? ((lastFc - lastHistClose) / lastHistClose * 100) : null;
    const direction = totalChg != null ? (totalChg >= 0 ? 'Bullish' : 'Bearish') : '--';

    const comp = DashData.modelComparison;
    const bestMape = comp && comp.length ? Math.min(...comp.map(r => r['MAPE (%)'] ?? Infinity)) : null;
    const bestArch = DashData.runConfig?.BEST_KV || 'Best KomVar';

    const items = [
      { label: 'Last Close', val: lastHistClose != null ? 'IDR ' + Math.round(lastHistClose).toLocaleString('id-ID') : '--', sub: 'before forecast', cls: '' },
      { label: 'Day 1 Forecast', val: firstFc != null ? 'IDR ' + Math.round(firstFc).toLocaleString('id-ID') : '--', sub: 'next trading day', cls: '' },
      { label: 'Day 5 Forecast', val: lastFc != null ? 'IDR ' + Math.round(lastFc).toLocaleString('id-ID') : '--', sub: '5 days ahead', cls: '' },
      { label: '5-Day Change', val: totalChg != null ? (totalChg >= 0 ? '+' : '') + totalChg.toFixed(2) + '%' : '--', sub: 'from last close', cls: totalChg != null && totalChg >= 0 ? 'positive' : 'negative' },
      { label: 'Direction', val: direction, sub: 'model signal', cls: direction === 'Bullish' ? 'positive' : (direction === 'Bearish' ? 'negative' : '') },
      { label: 'Model MAPE', val: bestMape != null ? bestMape.toFixed(2) + '%' : '--', sub: 'forecast uncertainty', cls: '' },
    ];

    wrap.innerHTML = items.map(item => `
      <div class="metric-card ${item.cls}">
        <div class="mc-label">${item.label}</div>
        <div class="mc-value">${item.val}</div>
        <div class="mc-sub">${item.sub}</div>
      </div>`).join('');
  }

  function buildForecastTable() {
    const fc = DashData.forecast5day;
    const hist = DashData.forecast5dayHistory;
    const wrap = document.getElementById('forecast-table-wrap');
    if (!wrap || !fc || !fc.length) { if (wrap) wrap.innerHTML = '<p style="color:var(--text-muted);font-size:.82rem;padding:16px">Forecast data not loaded.</p>'; return; }

    const lastHistClose = hist && hist.length ? hist[hist.length - 1].close : null;
    let prevClose = lastHistClose;

    const rows = fc.map((r, i) => {
      const predicted = r.predicted;
      const chg = prevClose != null && predicted != null ? ((predicted - prevClose) / prevClose * 100) : null;
      const upper = predicted != null ? predicted * 1.03 : null;
      const lower = predicted != null ? predicted * 0.97 : null;
      const dirClass = chg != null ? (chg >= 0 ? 'up' : 'down') : '';
      const dirStr = chg != null ? (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%' : '--';
      prevClose = predicted;
      return `<tr>
        <td>Day ${i + 1}</td>
        <td>${r.date || '--'}</td>
        <td class="${dirClass}">${predicted != null ? 'IDR ' + Math.round(predicted).toLocaleString('id-ID') : '--'}</td>
        <td class="${dirClass}">${dirStr}</td>
        <td>${upper != null ? 'IDR ' + Math.round(upper).toLocaleString('id-ID') : '--'}</td>
        <td>${lower != null ? 'IDR ' + Math.round(lower).toLocaleString('id-ID') : '--'}</td>
      </tr>`;
    }).join('');

    wrap.innerHTML = `
      <div style="overflow-x:auto">
        <table class="forecast-table">
          <thead>
            <tr>
              <th>Step</th>
              <th>Date</th>
              <th>Predicted Close</th>
              <th>Change</th>
              <th>Upper (+3%)</th>
              <th>Lower (-3%)</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function buildStatTestCards() {
    const wrap = document.getElementById('stat-test-cards');
    if (!wrap) return;

    const comp = DashData.modelComparison;
    const residuals = DashData.residuals;
    const acf = DashData.residualAcf;
    const backtest = DashData.backtest;

    const cards = [];

    if (acf && acf.length) {
      const n = residuals ? residuals.length : 100;
      const ci = 1.96 / Math.sqrt(n);
      const violations = acf.filter((r, i) => i > 0 && Math.abs(r.acf ?? 0) > ci).length;
      const lbQ = acf.length > 1 ? acf.slice(1, Math.min(11, acf.length)).reduce((s, r) => {
        const rho = r.acf ?? 0;
        return s + (n * (n + 2) * (rho * rho) / (n - (r.lag ?? 1)));
      }, 0) : null;
      const reject = violations === 0;
      cards.push({
        title: 'Ljung-Box Q-Test',
        stat: lbQ != null ? 'Q = ' + lbQ.toFixed(3) : 'Q = --',
        pval: 'Lags 1-10 | Residual whiteness test',
        decision: reject ? 'Fail to Reject H0 (White Noise)' : violations + ' ACF lags exceed 95% CI',
        cls: reject ? 'reject' : 'fail',
      });
    }

    if (comp && comp.length > 1) {
      const best = [...comp].sort((a, b) => (a['RMSE (IDR)'] ?? Infinity) - (b['RMSE (IDR)'] ?? Infinity))[0];
      const second = [...comp].sort((a, b) => (a['RMSE (IDR)'] ?? Infinity) - (b['RMSE (IDR)'] ?? Infinity))[1];
      const rmseDiff = best && second ? Math.abs((best['RMSE (IDR)'] ?? 0) - (second['RMSE (IDR)'] ?? 0)) : null;
      cards.push({
        title: 'Diebold-Mariano Test',
        stat: rmseDiff != null ? 'RMSE delta = ' + Math.round(rmseDiff).toLocaleString('id-ID') : '--',
        pval: `${best?.arch || '--'} vs ${second?.arch || '--'}`,
        decision: 'See DM table below for full pairwise results',
        cls: 'reject',
      });
    }

    if (DashData.leadLag && DashData.leadLag.length) {
      const data = DashData.leadLag;
      const sentCh = data.map(r => r.sentiment_change ?? r.sent_score ?? 0).filter(v => v != null);
      const ret = data.map(r => r.stock_return ?? 0).filter(v => v != null);
      const n = Math.min(sentCh.length, ret.length);
      if (n > 10) {
        const pearson = computePearson(sentCh.slice(0, n), ret.slice(0, n));
        const tStat = pearson * Math.sqrt((n - 2) / (1 - pearson * pearson + 1e-10));
        const significant = Math.abs(tStat) > 1.96;
        cards.push({
          title: 'Sentiment-Return Correlation',
          stat: 'r = ' + pearson.toFixed(4),
          pval: 't-stat = ' + tStat.toFixed(3) + ' | n = ' + n,
          decision: significant ? 'Significant at 5% level' : 'Not significant at 5% level',
          cls: significant ? 'reject' : 'fail',
        });
      }
    }

    if (backtest && backtest.length) {
      const stratRet = backtest.map(r => r.strat_daily_return).filter(v => v != null && !isNaN(v));
      const stockRet = backtest.map(r => r.stock_daily_return).filter(v => v != null && !isNaN(v));
      if (stratRet.length > 1 && stockRet.length > 1) {
        const n = Math.min(stratRet.length, stockRet.length);
        const diff = stratRet.slice(0, n).map((v, i) => v - stockRet[i]);
        const mu = diff.reduce((s, v) => s + v, 0) / n;
        const sigma = Math.sqrt(diff.map(v => (v - mu) ** 2).reduce((s, v) => s + v, 0) / n);
        const dmStat = mu / (sigma / Math.sqrt(n) + 1e-12);
        const pApprox = 2 * (1 - normalCDF(Math.abs(dmStat)));
        cards.push({
          title: 'DM Test: Strategy vs B&H',
          stat: 'DM = ' + dmStat.toFixed(3),
          pval: 'p approx. ' + pApprox.toFixed(4),
          decision: pApprox < 0.05 ? 'Reject H0: Significant difference' : 'Fail to Reject H0',
          cls: pApprox < 0.05 ? 'reject' : 'fail',
        });
      }
    }

    if (!cards.length) {
      wrap.innerHTML = '<p style="color:var(--text-muted);font-size:.82rem">Load statistical data files to see test results.</p>';
      return;
    }

    wrap.innerHTML = cards.map(c => `
      <div class="stat-card">
        <div class="stat-card-title">${c.title}</div>
        <div class="stat-card-stat">${c.stat}</div>
        <div class="stat-card-pvalue" style="color:var(--text-muted)">${c.pval}</div>
        <div class="stat-card-decision ${c.cls}">${c.decision}</div>
      </div>`).join('');
  }

  function buildDmTestTable() {
    const dm = DashData.dmTest;
    const wrap = document.getElementById('dm-test-table');
    if (!wrap) return;

    if (!dm || !dm.length) {
      wrap.innerHTML = '';
      return;
    }

    const cols = Object.keys(dm[0]);
    const statCol = cols.find(c => c.toLowerCase().includes('stat') || c.toLowerCase().includes('dm'));
    const pvalCol = cols.find(c => c.toLowerCase().includes('p') && c.toLowerCase() !== 'pair');
    const pairCol = cols.find(c => c.toLowerCase().includes('pair') || c.toLowerCase().includes('model') || c.toLowerCase().includes('arch'));

    const headerCols = cols.filter(c => c !== '__index__');

    wrap.innerHTML = `
      <h3 class="chart-title" style="margin-bottom:12px">Diebold-Mariano Pairwise Test Results</h3>
      <div style="overflow-x:auto">
        <table class="dm-table">
          <thead>
            <tr>${headerCols.map(c => `<th>${c}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${dm.map(row => `<tr>${headerCols.map(c => {
              const v = row[c];
              if (c === pvalCol) {
                const n = parseFloat(v);
                return `<td class="${!isNaN(n) && n < 0.05 ? 'sig-yes' : 'sig-no'}">${!isNaN(n) ? n.toFixed(4) : v ?? '--'}</td>`;
              }
              if (c === statCol) return `<td>${typeof v === 'number' ? v.toFixed(4) : (v ?? '--')}</td>`;
              return `<td>${v ?? '--'}</td>`;
            }).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function normalCDF(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
    return z > 0 ? 1 - p : p;
  }

  function initNavigation() {
    const links = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');

    function activate(sectionId) {
      sections.forEach(s => s.classList.toggle('active', s.id === sectionId));
      links.forEach(l => l.classList.toggle('active', l.dataset.section === sectionId));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      loadSectionCharts(sectionId);
    }

    links.forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        activate(link.dataset.section);
      });
    });

    document.querySelectorAll('.ctrl-btn[data-range]').forEach(btn => {
      btn.addEventListener('click', () => {
        const chart = btn.dataset.chart;
        const range = btn.dataset.range;
        btn.closest('.chart-controls').querySelectorAll('.ctrl-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (chart === 'priceHistory') buildPriceHistoryChart(range);
      });
    });

    document.querySelectorAll('.ctrl-btn[data-layer]').forEach(btn => {
      btn.addEventListener('click', () => {
        const chart = btn.dataset.chart;
        const layer = btn.dataset.layer;
        btn.closest('.chart-controls').querySelectorAll('.ctrl-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (chart === 'macroChart') buildMacroChart(layer);
        if (chart === 'sentTimeline') buildSentTimelineChart(layer);
      });
    });
  }

  const renderedSections = new Set();

  function loadSectionCharts(sectionId) {
    if (renderedSections.has(sectionId)) return;
    renderedSections.add(sectionId);

    if (sectionId === 'overview') {
      buildPriceHistoryChart('all');
      buildKomvarMatrix();
      buildWfvChart();
      buildMacroChart('ihsg');
    }
    if (sectionId === 'sentiment') {
      buildSentTimelineChart('sent_score');
      buildSentDistribution();
      buildSentReturnCorr();
      buildRollingCorr();
      buildTweetVolume();
      buildBullishnessChart();
    }
    if (sectionId === 'models') {
      buildArchCards();
      buildPredActualChart();
      buildMetricsRadar();
      buildRmseBar();
      buildR2DirBar();
      buildAblationChart();
      buildHeatmapChart();
    }
    if (sectionId === 'features') {
      buildShapChart();
      buildPermChart();
      buildGaChart();
      buildTechChart('RSI');
      buildKomvarTable();
    }
    if (sectionId === 'backtest') {
      buildBacktestChart();
      buildReturnDistChart();
      buildSignalChart();
      buildBlPortfolio();
    }
    if (sectionId === 'statistics') {
      buildResidualHist();
      buildAcfChart();
      buildGrangerChart();
      buildCcfChart();
      buildDmTestTable();
    }
    if (sectionId === 'forecast') {
      buildForecastChart();
    }
    if (sectionId === 'simulation') {
      initSimulation();
    }
  }

  function showMissingBanner() {
    const missing = DashData.missingFiles;
    if (!missing.length) return;
    const banner = document.getElementById('missing-banner');
    if (!banner) return;
    banner.classList.add('visible');
    const list = banner.querySelector('ul');
    if (list) {
      list.innerHTML = missing.slice(0, 10).map(f => `<li>${f}</li>`).join('') +
        (missing.length > 10 ? `<li>...and ${missing.length - 10} more</li>` : '');
    }
  }

  function showFileProtocolError() {
    const loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen) return;
    loadingScreen.innerHTML = `
      <div class="loader-inner" style="max-width:560px;text-align:left">
        <div class="loader-logo" style="margin-bottom:24px"><span class="logo-accent">Tweet</span>Trade</div>
        <div style="background:#1e1e2e;border:1px solid #f59e0b44;border-radius:12px;padding:28px 32px">
          <div style="color:#f59e0b;font-size:13px;font-weight:600;letter-spacing:.08em;margin-bottom:12px">CANNOT OPEN VIA FILE://</div>
          <p style="color:#c8d0e8;font-size:14px;line-height:1.7;margin:0 0 20px">
            Browser blocks <code style="color:#3b82f6;background:#0f1117;padding:2px 6px;border-radius:4px">fetch()</code>
            when the page is opened directly from disk (<code style="color:#3b82f6;background:#0f1117;padding:2px 6px;border-radius:4px">file://</code>).
            The dashboard needs to be served over HTTP to load the JSON data files.
          </p>
          <div style="color:#8b96b0;font-size:12px;margin-bottom:8px;font-weight:600;letter-spacing:.06em">OPTION 1 &mdash; Python local server (easiest)</div>
          <code style="display:block;background:#0f1117;color:#10b981;font-size:12px;padding:12px 16px;border-radius:8px;margin-bottom:20px;font-family:'JetBrains Mono',monospace">
            cd path/to/your/dashboard/folder<br>
            python -m http.server 8080<br>
            <span style="color:#8b96b0"># then open http://localhost:8080</span>
          </code>
          <div style="color:#8b96b0;font-size:12px;margin-bottom:8px;font-weight:600;letter-spacing:.06em">OPTION 2 &mdash; VS Code Live Server extension</div>
          <div style="color:#c8d0e8;font-size:13px;line-height:1.6">
            Install the <strong>Live Server</strong> extension in VS Code, right-click <code style="color:#3b82f6;background:#0f1117;padding:2px 6px;border-radius:4px">index.html</code>, and choose
            <em>Open with Live Server</em>. It will open <code style="color:#3b82f6;background:#0f1117;padding:2px 6px;border-radius:4px">http://127.0.0.1:5500</code> automatically.
          </div>
        </div>
        <div style="color:#8b96b0;font-size:12px;margin-top:20px;line-height:1.6">
          When deployed to Netlify or any static host the dashboard will work normally.
        </div>
      </div>`;
  }

  async function init() {
    if (location.protocol === 'file:') {
      showFileProtocolError();
      return;
    }

    const timeout = new Promise(resolve => setTimeout(resolve, 30000));
    await Promise.race([loadAllData(), timeout]);

    populateKpis();
    populateSentKpis();
    populateBacktestKpis();
    populateForecastKpis();
    buildForecastTable();
    buildStatTestCards();

    initNavigation();
    loadSectionCharts('overview');

    const loadingScreen = document.getElementById('loading-screen');
    const app = document.getElementById('app');
    if (loadingScreen) loadingScreen.classList.add('fade-out');
    if (app) app.style.display = '';

    setTimeout(showMissingBanner, 800);
  }


  let simStrategy = 'ai';
  let simView = 'portfolio';
  let simInitialized = false;

  function initSimulation() {
    if (simInitialized) { runSimulation(); return; }
    simInitialized = true;

    updateSimTicker();

    const sliders = [
      { id: 'sim-capital', valId: 'sim-capital-val', fmt: v => 'IDR ' + parseInt(v).toLocaleString('id-ID') },
      { id: 'sim-cost',    valId: 'sim-cost-val',    fmt: v => parseFloat(v).toFixed(2) + '%' },
      { id: 'sim-conf',    valId: 'sim-conf-val',    fmt: v => parseFloat(v).toFixed(1) + '% min move' },
      { id: 'sim-pos',     valId: 'sim-pos-val',     fmt: v => parseInt(v) + '%' },
      { id: 'sim-sl',      valId: 'sim-sl-val',      fmt: v => parseFloat(v) === 0 ? 'Disabled' : parseFloat(v).toFixed(1) + '%' },
    ];

    for (const { id, valId, fmt } of sliders) {
      const el = document.getElementById(id);
      const valEl = document.getElementById(valId);
      if (!el || !valEl) continue;
      el.addEventListener('input', () => { valEl.textContent = fmt(el.value); });
    }

    document.querySelectorAll('#sim-strategy .sim-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#sim-strategy .sim-toggle').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        simStrategy = btn.dataset.val;
      });
    });

    document.querySelectorAll('[data-sim-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-sim-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        simView = btn.dataset.simView;
        runSimulation();
      });
    });

    document.getElementById('sim-run-btn')?.addEventListener('click', () => {
      const btn = document.getElementById('sim-run-btn');
      if (btn) { btn.classList.add('loading'); btn.textContent = '⏳ Running...'; }
      setTimeout(() => {
        runSimulation();
        if (btn) { btn.classList.remove('loading'); btn.innerHTML = '<span class="sim-btn-icon">&#9654;</span> Run Simulation'; }
      }, 400);
    });

    runSimulation();
  }

  function updateSimTicker() {
    const comp = DashData.modelComparison;
    const bbca = DashData.dfAll || DashData.bbca;
    if (bbca && bbca.length) {
      const last = bbca[bbca.length - 1];
      const prev = bbca[bbca.length - 2];
      const chg = last && prev ? ((last.close - prev.close) / prev.close * 100) : 0;
      const el = document.getElementById('tick-price');
      if (el) {
        el.textContent = `IDR ${Math.round(last.close).toLocaleString('id-ID')} (${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%)`;
        el.className = 'ticker-item ' + (chg >= 0 ? 'positive' : 'negative');
      }
    }
    if (comp && comp.length) {
      const best = [...comp].sort((a, b) => (a['RMSE (IDR)'] ?? Infinity) - (b['RMSE (IDR)'] ?? Infinity))[0];
      const rmseEl = document.getElementById('tick-rmse');
      const mapeEl = document.getElementById('tick-mape');
      const dirEl = document.getElementById('tick-dir');
      if (rmseEl) rmseEl.textContent = `RMSE: IDR ${Math.round(best['RMSE (IDR)'] ?? 0).toLocaleString('id-ID')}`;
      if (mapeEl) mapeEl.textContent = `MAPE: ${(best['MAPE (%)'] ?? 0).toFixed(2)}%`;
      if (dirEl) dirEl.textContent = `Dir Acc: ${(best['Dir Acc (%)'] ?? 0).toFixed(1)}%`;
    }

    const ticker = document.getElementById('sim-ticker');
    if (ticker && !ticker.dataset.duped) {
      ticker.innerHTML += ticker.innerHTML;
      ticker.dataset.duped = '1';
    }
  }

  function getSimParams() {
    return {
      capital: parseInt(document.getElementById('sim-capital')?.value || 10000000),
      cost: parseFloat(document.getElementById('sim-cost')?.value || 0) / 100,
      conf: parseFloat(document.getElementById('sim-conf')?.value || 0) / 100,
      pos: parseFloat(document.getElementById('sim-pos')?.value || 100) / 100,
      sl: parseFloat(document.getElementById('sim-sl')?.value || 0) / 100,
      strategy: simStrategy,
    };
  }

  function runSimulation() {
    const bt = DashData.backtest;
    if (!bt || !bt.length) {
      showSimPlaceholder();
      return;
    }

    const p = getSimParams();
    const results = simulateStrategy(bt, p);
    updateSimKpis(results, p);
    buildSimPortfolioChart(results, p);
    buildSimMonthlyHeatmap(results, bt);
    buildSimReturnDistChart(results);
    buildSimTradeChart(bt, results);

    const sharpeEl = document.getElementById('tick-sharpe');
    if (sharpeEl && results.sharpe != null) {
      sharpeEl.textContent = `Sharpe: ${results.sharpe.toFixed(3)}`;
    }
  }

  function simulateStrategy(bt, p) {
    const n = bt.length;
    const capital = p.capital;
    let portfolio = capital;
    let stockPortfolio = capital;
    let peakPortfolio = capital;
    let maxDD = 0;
    let inPosition = false;
    let entryPrice = null;
    let trades = [];
    let portfolioArr = [];
    let cumStratReturn = [];
    let cumStockReturn = [];
    let monthlyReturns = {};

    const stockRets = bt.map(r => r.stock_daily_return ?? 0);
    let cumStock = 1;

    for (let i = 0; i < n; i++) {
      const row = bt[i];
      const predicted = row.predicted ?? 0;
      const actual = row.actual ?? 0;
      const actualNext = bt[i + 1]?.actual ?? actual;
      const date = row.date || '';
      const baseSignal = row.signal ?? 0; // original AI signal

      const sentScore = (DashData.dfAll || []).find(r => r.date === date)?.sent_score ?? 0.5;

      let signal = 0;
      if (p.strategy === 'bah') {
        signal = 1;
      } else if (p.strategy === 'ai') {
        const predictedMove = actual > 0 ? (predicted - actual) / actual : 0;
        signal = predictedMove > p.conf ? 1 : 0;
      } else if (p.strategy === 'ai_sent') {
        const predictedMove = actual > 0 ? (predicted - actual) / actual : 0;
        signal = (predictedMove > p.conf && sentScore > 0.5) ? 1 : 0;
      }

      const dailyRetBase = row.strat_daily_return ?? row.stock_daily_return ?? 0;
      let dailyRet = signal === 1 ? dailyRetBase * p.pos : 0;

      if (inPosition && p.sl > 0 && entryPrice != null && actual > 0) {
        const loss = (actual - entryPrice) / entryPrice;
        if (loss < -p.sl) { signal = 0; dailyRet = loss * p.pos; inPosition = false; }
      }

      const prevSignal = i > 0 ? (portfolioArr[i - 1]?.signal ?? 0) : 0;
      if (signal !== prevSignal) {
        dailyRet -= p.cost;
        if (signal === 1) { inPosition = true; entryPrice = actual; }
        else { inPosition = false; entryPrice = null; }
      }

      portfolio *= (1 + dailyRet);
      if (portfolio > peakPortfolio) peakPortfolio = portfolio;
      const drawdown = (peakPortfolio - portfolio) / peakPortfolio;
      if (drawdown > maxDD) maxDD = drawdown;

      cumStock *= (1 + stockRets[i]);
      stockPortfolio = capital * cumStock;

      const mo = date.slice(0, 7);
      if (mo) {
        if (!monthlyReturns[mo]) monthlyReturns[mo] = { stratReturn: 1, stockReturn: 1 };
        monthlyReturns[mo].stratReturn *= (1 + dailyRet);
        monthlyReturns[mo].stockReturn *= (1 + stockRets[i]);
      }

      portfolioArr.push({ date, portfolio, stockPortfolio, signal, dailyRet, drawdown });

      if (signal === 1 && prevSignal === 0) trades.push({ entry: i, entryPrice: actual, signal: 1 });
      if (signal === 0 && prevSignal === 1 && trades.length > 0) {
        const last = trades[trades.length - 1];
        last.exit = i;
        last.exitPrice = actual;
        last.pnl = (actual - last.entryPrice) / last.entryPrice;
      }
    }

    const finalPortfolio = portfolioArr[portfolioArr.length - 1]?.portfolio ?? capital;
    const finalStock = portfolioArr[portfolioArr.length - 1]?.stockPortfolio ?? capital;
    const totalReturn = (finalPortfolio - capital) / capital * 100;
    const stockReturn = (finalStock - capital) / capital * 100;
    const alpha = totalReturn - stockReturn;

    const dailyRets = portfolioArr.map(r => r.dailyRet).filter(v => !isNaN(v));
    const rfD = 0.06 / 252;
    const excess = dailyRets.map(r => r - rfD);
    const mu = excess.reduce((s, v) => s + v, 0) / (excess.length || 1);
    const sigma = Math.sqrt(excess.map(v => (v - mu) ** 2).reduce((s, v) => s + v, 0) / (excess.length || 1));
    const sharpe = sigma > 0 ? mu / sigma * Math.sqrt(252) : 0;

    const completedTrades = trades.filter(t => t.exit != null);
    const wins = completedTrades.filter(t => t.pnl > 0).length;
    const winRate = completedTrades.length > 0 ? wins / completedTrades.length * 100 : 0;

    const nTrades = trades.length;

    return {
      portfolioArr, finalPortfolio, finalStock,
      totalReturn, stockReturn, alpha,
      sharpe, maxDD: maxDD * 100,
      nTrades, winRate, monthlyReturns,
      dailyRets, completedTrades,
    };
  }

  function animSimNum(el, value, fmt) {
    if (!el) return;
    const start = performance.now();
    const duration = 700;
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(value * ease);
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = fmt(value);
    }
    requestAnimationFrame(step);
  }

  function updateSimKpis(results, p) {
    const { finalPortfolio, totalReturn, alpha, sharpe, maxDD, nTrades, winRate } = results;

    function setKpi(valId, deltaId, mainVal, deltaStr, isGood) {
      const valEl = document.getElementById(valId);
      const deltaEl = document.getElementById(deltaId);
      if (valEl) {
        valEl.textContent = mainVal;
        valEl.style.color = isGood ? 'var(--accent2)' : isGood === false ? 'var(--red)' : 'var(--text-primary)';
      }
      if (deltaEl && deltaStr) {
        deltaEl.textContent = deltaStr;
        deltaEl.className = 'sim-kpi-delta ' + (isGood ? 'pos' : isGood === false ? 'neg' : '');
      }
    }

    setKpi('sk-portfolio-val', null,
      'IDR ' + Math.round(finalPortfolio).toLocaleString('id-ID'), null, totalReturn >= 0);
    setKpi('sk-return-val', 'sk-return-delta',
      (totalReturn >= 0 ? '+' : '') + totalReturn.toFixed(2) + '%',
      `vs B&H: ${results.stockReturn >= 0 ? '+' : ''}${results.stockReturn.toFixed(2)}%`,
      totalReturn >= 0);
    setKpi('sk-sharpe-val', 'sk-sharpe-delta',
      sharpe.toFixed(3), sharpe >= 1 ? 'Excellent' : sharpe >= 0.5 ? 'Good' : 'Low',
      sharpe >= 1 ? true : sharpe >= 0.5 ? null : false);
    setKpi('sk-mdd-val', 'sk-mdd-delta',
      maxDD.toFixed(2) + '%', 'Maximum Drawdown',
      maxDD < 10 ? true : maxDD < 20 ? null : false);
    setKpi('sk-trades-val', 'sk-trades-delta',
      nTrades.toString(), 'Buy entries', null);
    setKpi('sk-winrate-val', 'sk-winrate-delta',
      winRate.toFixed(1) + '%', results.completedTrades.length + ' completed', winRate >= 55);
    setKpi('sk-alpha-val', 'sk-alpha-delta',
      (results.alpha >= 0 ? '+' : '') + results.alpha.toFixed(2) + '%',
      results.alpha >= 0 ? 'Outperformed' : 'Underperformed',
      results.alpha >= 0);

    document.querySelectorAll('.sim-kpi-card').forEach((c, i) => {
      setTimeout(() => { c.classList.add('updated'); setTimeout(() => c.classList.remove('updated'), 1200); }, i * 60);
    });
  }

  function buildSimPortfolioChart(results, p) {
    const { portfolioArr } = results;
    const dates = portfolioArr.map(r => r.date);

    let stratData, stockData, label1, label2;

    if (simView === 'portfolio') {
      stratData = portfolioArr.map(r => r.portfolio / 1e6);
      stockData = portfolioArr.map(r => r.stockPortfolio / 1e6);
      label1 = 'Simulated Strategy (M IDR)';
      label2 = 'Buy & Hold (M IDR)';
    } else if (simView === 'returns') {
      const capital = p.capital;
      stratData = portfolioArr.map(r => (r.portfolio - capital) / capital * 100);
      stockData = portfolioArr.map(r => (r.stockPortfolio - capital) / capital * 100);
      label1 = 'Strategy Cum. Return (%)';
      label2 = 'B&H Cum. Return (%)';
    } else {
      stratData = portfolioArr.map(r => -(r.drawdown * 100));
      stockData = [];
      label1 = 'Strategy Drawdown (%)';
      label2 = null;
    }

    const datasets = [
      {
        label: label1,
        data: stratData,
        borderColor: C.accent2,
        backgroundColor: C.accent2 + '15',
        borderWidth: 2,
        pointRadius: 0,
        fill: simView !== 'drawdown',
        tension: 0.3,
        spanGaps: true,
      },
    ];

    if (label2 && stockData.length) {
      datasets.push({
        label: label2,
        data: stockData,
        borderColor: C.accent,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [5, 4],
        pointRadius: 0,
        fill: false,
        tension: 0.3,
        spanGaps: true,
      });
    }

    makeChart('simPortfolioChart', {
      type: 'line',
      data: { labels: dates, datasets },
      options: buildOpts({
        plugins: { tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + ctx.parsed.y?.toFixed(3) } } },
        scales: {
          x: { ticks: { maxTicksLimit: 8, color: C.text, font: { size: 10 } }, grid: { color: C.grid } },
          y: { ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
        },
        responsive: true, maintainAspectRatio: false,
      }),
    });
  }

  function buildSimMonthlyHeatmap(results, bt) {
    const wrap = document.getElementById('simMonthlyWrap');
    if (!wrap) return;

    const { monthlyReturns } = results;
    const months = Object.keys(monthlyReturns).sort();
    if (!months.length) { wrap.innerHTML = '<div style="color:var(--text-muted);font-size:.82rem;padding:16px">No monthly data available.</div>'; return; }

    const yearMonths = {};
    for (const m of months) {
      const [y, mo] = m.split('-');
      if (!yearMonths[y]) yearMonths[y] = {};
      const ret = (monthlyReturns[m].stratReturn - 1) * 100;
      yearMonths[y][parseInt(mo)] = ret;
    }

    const allRets = months.map(m => (monthlyReturns[m].stratReturn - 1) * 100);
    const maxAbs = Math.max(Math.abs(Math.min(...allRets)), Math.abs(Math.max(...allRets)), 0.01);

    const moNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    let html = '<div style="overflow:auto;height:100%;padding:8px">';
    html += '<div style="display:grid;grid-template-columns:48px repeat(12,1fr);gap:3px;font-size:0.65rem;font-family:JetBrains Mono,monospace">';
    html += '<div></div>';
    for (const mn of moNames) html += `<div style="text-align:center;color:var(--text-muted);padding:2px">${mn}</div>`;

    for (const yr of Object.keys(yearMonths).sort()) {
      html += `<div style="color:var(--text-secondary);display:flex;align-items:center;font-weight:600">${yr}</div>`;
      for (let mo = 1; mo <= 12; mo++) {
        const ret = yearMonths[yr][mo];
        if (ret == null) {
          html += '<div style="background:var(--border);border-radius:4px"></div>';
        } else {
          const intensity = Math.min(Math.abs(ret) / maxAbs, 1);
          let bg;
          if (ret >= 0) {
            const g = Math.round(100 + intensity * 85);
            bg = `rgba(16,${g},100,${0.3 + intensity * 0.6})`;
          } else {
            const r = Math.round(150 + intensity * 89);
            bg = `rgba(${r},68,68,${0.3 + intensity * 0.6})`;
          }
          const color = '#e8edf8';
          html += `<div class="mhm-cell" title="${yr}-${String(mo).padStart(2,'0')}: ${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%" style="background:${bg};color:${color};padding:4px 0">${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%</div>`;
        }
      }
    }
    html += '</div></div>';
    wrap.innerHTML = html;
  }

  function buildSimReturnDistChart(results) {
    const { dailyRets } = results;
    const hist = computeHistogram(dailyRets, 25);
    makeChart('simReturnDist', {
      type: 'bar',
      data: {
        labels: hist.bins.map(v => (v * 100).toFixed(2) + '%'),
        datasets: [{
          label: 'Frequency',
          data: hist.counts,
          backgroundColor: hist.bins.map(v => v >= 0 ? C.accent2 + '88' : C.red + '88'),
          borderColor: hist.bins.map(v => v >= 0 ? C.accent2 : C.red),
          borderWidth: 1, borderRadius: 3,
        }],
      },
      options: buildOpts({
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxTicksLimit: 10, color: C.text, font: { size: 9 } }, grid: { color: C.grid } },
          y: { ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
        },
        responsive: true, maintainAspectRatio: false,
      }),
    });
  }

  function buildSimTradeChart(bt, results) {
    const { completedTrades } = results;
    if (!completedTrades.length) { noDataMsg('simTradeChart'); return; }

    const labels = completedTrades.map((_, i) => `T${i + 1}`);
    const pnls = completedTrades.map(t => (t.pnl ?? 0) * 100);

    makeChart('simTradeChart', {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Trade P&L (%)',
          data: pnls,
          backgroundColor: pnls.map(v => v >= 0 ? C.accent2 + 'cc' : C.red + 'cc'),
          borderColor: pnls.map(v => v >= 0 ? C.accent2 : C.red),
          borderWidth: 1,
          borderRadius: 3,
        }],
      },
      options: buildOpts({
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y >= 0 ? '+' : ''}${ctx.parsed.y.toFixed(3)}%` } },
        },
        scales: {
          x: { ticks: { maxTicksLimit: 12, color: C.text, font: { size: 9 } }, grid: { color: C.grid } },
          y: { ticks: { color: C.text, font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: C.grid } },
        },
        responsive: true, maintainAspectRatio: false,
      }),
    });
  }

  function showSimPlaceholder() {
    const wrap = document.getElementById('sim-kpi-row');
    if (wrap) {
      document.querySelectorAll('.sim-kpi-value').forEach(el => {
        el.textContent = 'No data';
        el.style.color = 'var(--text-muted)';
      });
    }
  }


  function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W, H, particles = [], animId;

    const PARTICLE_COUNT = 55;
    const MAX_LINK_DIST = 160;
    const COLORS = ['rgba(59,130,246,', 'rgba(16,185,129,', 'rgba(100,120,200,'];

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function randBetween(a, b) { return a + Math.random() * (b - a); }

    function createParticle() {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: randBetween(-0.18, 0.18),
        vy: randBetween(-0.18, 0.18),
        r: randBetween(1, 2.2),
        alpha: randBetween(0.3, 0.7),
        color,
      };
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_LINK_DIST) {
            const alpha = (1 - dist / MAX_LINK_DIST) * 0.12;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(59,130,246,${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + p.alpha + ')';
        ctx.fill();
      }
    }

    function update() {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10;
        if (p.y > H + 10) p.y = -10;
      }
    }

    function loop() {
      update();
      draw();
      animId = requestAnimationFrame(loop);
    }

    resize();
    particles = Array.from({ length: PARTICLE_COUNT }, createParticle);
    loop();

    window.addEventListener('resize', () => {
      resize();
      particles = Array.from({ length: PARTICLE_COUNT }, createParticle);
    });
  }


  function initChartInteractions() {
    document.querySelectorAll('.chart-wrap canvas').forEach(canvas => {
      canvas.style.cursor = 'crosshair';
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.ctrl-btn, .sim-toggle, .sim-run-btn');
      if (!btn) return;
      const ripple = document.createElement('span');
      const rect = btn.getBoundingClientRect();
      ripple.style.cssText = `
        position:absolute; border-radius:50%; transform:scale(0);
        animation:ripple 0.5s linear; pointer-events:none;
        background:rgba(255,255,255,0.2);
        left:${e.clientX - rect.left - 10}px;
        top:${e.clientY - rect.top - 10}px;
        width:20px; height:20px;
      `;
      btn.style.position = 'relative';
      btn.style.overflow = 'hidden';
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  }


  document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    initChartInteractions();
    init();
  });

})();
