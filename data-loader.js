const DATA_BASE = './dashboard_data/';

const DashData = {
  bbca: null,
  dailySent: null,
  tweetCorpusStats: null,
  techIndicators: null,
  dfAll: null,
  wfvResults: null,
  wfvDict: null,
  modelComparison: null,
  finalSummary: null,
  ablationStudy: null,
  dmTest: null,
  predArchs: {},
  forecast5day: null,
  forecast5dayHistory: null,
  shapFI: null,
  permFI: null,
  backtest: null,
  sentCorr: null,
  leadLag: null,
  residuals: null,
  residualAcf: null,
  blWeights: null,
  blReturns: null,
  runConfig: null,
  komvarDefs: null,
  komvarTable: null,
  gaResults: null,
  gridsearchBest: null,
  missingFiles: [],
};

const IS_FILE_PROTOCOL = location.protocol === 'file:';

async function loadJSON(filename) {
  if (IS_FILE_PROTOCOL) {
    DashData.missingFiles.push(filename);
    DashData._fileProtocolBlocked = true;
    return null;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(DATA_BASE + filename, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    DashData.missingFiles.push(filename);
    return null;
  }
}

function setLoaderStatus(msg) {
  const el = document.getElementById('loader-status');
  if (el) el.textContent = msg;
}

function setLoaderProgress(pct) {
  const el = document.getElementById('loader-bar');
  if (el) el.style.width = pct + '%';
}

async function loadAllData() {
  const steps = [
    ['bbca_ohlcv.json',               d => { DashData.bbca = d; }],
    ['daily_sentiment.json',          d => { DashData.dailySent = d; }],
    ['tweet_corpus_stats.json',       d => { DashData.tweetCorpusStats = d; }],
    ['tech_indicators.json',          d => { DashData.techIndicators = d; }],
    ['df_all.json',                   d => { DashData.dfAll = d; }],
    ['wfv_results.json',              d => { DashData.wfvResults = d; }],
    ['wfv_results_dict.json',         d => { DashData.wfvDict = d; }],
    ['model_comparison.json',         d => { DashData.modelComparison = d; }],
    ['final_summary.json',            d => { DashData.finalSummary = d; }],
    ['ablation_study.json',           d => { DashData.ablationStudy = d; }],
    ['dm_test_results.json',          d => { DashData.dmTest = d; }],
    ['forecast_5day.json',            d => { DashData.forecast5day = d; }],
    ['forecast_5day_history.json',    d => { DashData.forecast5dayHistory = d; }],
    ['shap_feature_importance.json',  d => { DashData.shapFI = d; }],
    ['permutation_feature_importance.json', d => { DashData.permFI = d; }],
    ['backtest_results.json',         d => { DashData.backtest = d; }],
    ['sentiment_stock_correlation.json', d => { DashData.sentCorr = d; }],
    ['lead_lag_data.json',            d => { DashData.leadLag = d; }],
    ['residual_diagnostics.json',     d => { DashData.residuals = d; }],
    ['residual_acf.json',             d => { DashData.residualAcf = d; }],
    ['bl_portfolio_weights.json',     d => { DashData.blWeights = d; }],
    ['bl_posterior_returns.json',     d => { DashData.blReturns = d; }],
    ['run_config.json',               d => { DashData.runConfig = d; }],
    ['komvar_definitions.json',       d => { DashData.komvarDefs = d; }],
    ['komvar_table.json',             d => { DashData.komvarTable = d; }],
    ['ga_results.json',               d => { DashData.gaResults = d; }],
    ['gridsearch_best.json',          d => { DashData.gridsearchBest = d; }],
  ];

  const archs = ['LSTM', 'GRU', 'BiLSTM', 'LSTM_Attn'];

  const bestKv = await (async () => {
    const cfg = await loadJSON('run_config.json');
    if (cfg) { DashData.runConfig = cfg; return cfg.BEST_KV; }
    return null;
  })();

  for (const arch of archs) {
    let fname = null;
    if (bestKv) {
      fname = `pred_${arch}_${bestKv}.json`;
    } else {
      for (const attempt of [`pred_${arch}_KomVar1.json`, `pred_${arch}.json`]) {
        try {
          const res = await fetch(DATA_BASE + attempt);
          if (res.ok) { fname = attempt; break; }
        } catch (_) {}
      }
    }
    if (fname) steps.push([fname, d => { DashData.predArchs[arch] = d; }]);
  }

  for (const extra of ['pred_ablation_with_sentiment.json', 'pred_ablation_without_sentiment.json']) {
    steps.push([extra, d => {
      const key = extra.replace('.json', '').replace('pred_', '');
      DashData.predArchs[key] = d;
    }]);
  }

  let completed = 0;
  const total = steps.length;

  for (const [filename, handler] of steps) {
    setLoaderStatus('Loading ' + filename.replace('.json', '').replace(/_/g, ' '));
    setLoaderProgress(Math.round((completed / total) * 90));
    const data = await loadJSON(filename);
    if (data !== null) handler(data);
    completed++;
  }

  setLoaderProgress(100);
  setLoaderStatus('Rendering dashboard...');
  return DashData;
}

function getFieldArr(data, field) {
  if (!data) return [];
  return data.map(r => r[field] ?? null);
}

function getDateArr(data, field = 'date') {
  if (!data) return [];
  return data.map(r => r[field] ?? r['date_only'] ?? null);
}

function inferBestArch() {
  if (!DashData.modelComparison || !DashData.modelComparison.length) return 'LSTM';
  const sorted = [...DashData.modelComparison].sort((a, b) =>
    (a['RMSE (IDR)'] ?? Infinity) - (b['RMSE (IDR)'] ?? Infinity));
  return sorted[0].arch || 'LSTM';
}

function fmtIdr(v, dec = 0) {
  if (v == null || isNaN(v)) return '--';
  return Number(v).toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtNum(v, dec = 2) {
  if (v == null || isNaN(v)) return '--';
  return Number(v).toFixed(dec);
}

function fmtPct(v, dec = 2) {
  if (v == null || isNaN(v)) return '--';
  return Number(v).toFixed(dec) + '%';
}

function rollingCorr(arr1, arr2, window = 30) {
  const result = new Array(arr1.length).fill(null);
  for (let i = window - 1; i < arr1.length; i++) {
    const a = arr1.slice(i - window + 1, i + 1);
    const b = arr2.slice(i - window + 1, i + 1);
    const n = a.length;
    if (n < 4) continue;
    const ma = a.reduce((s, v) => s + v, 0) / n;
    const mb = b.reduce((s, v) => s + v, 0) / n;
    let num = 0, da = 0, db = 0;
    for (let j = 0; j < n; j++) {
      num += (a[j] - ma) * (b[j] - mb);
      da += (a[j] - ma) ** 2;
      db += (b[j] - mb) ** 2;
    }
    const denom = Math.sqrt(da * db);
    result[i] = denom > 0 ? num / denom : null;
  }
  return result;
}

function computePearson(arr1, arr2) {
  const n = arr1.length;
  const ma = arr1.reduce((s, v) => s + v, 0) / n;
  const mb = arr2.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (arr1[i] - ma) * (arr2[i] - mb);
    da += (arr1[i] - ma) ** 2;
    db += (arr2[i] - mb) ** 2;
  }
  const denom = Math.sqrt(da * db);
  return denom > 0 ? num / denom : 0;
}

function computeHistogram(arr, nBins = 30) {
  const valid = arr.filter(v => v !== null && !isNaN(v));
  if (!valid.length) return { bins: [], counts: [] };
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const step = (max - min) / nBins || 1;
  const bins = Array.from({ length: nBins }, (_, i) => min + i * step + step / 2);
  const counts = new Array(nBins).fill(0);
  for (const v of valid) {
    let idx = Math.floor((v - min) / step);
    if (idx >= nBins) idx = nBins - 1;
    counts[idx]++;
  }
  return { bins, counts };
}

function movingAvg(arr, window) {
  return arr.map((_, i) => {
    if (i < window - 1) return null;
    const slice = arr.slice(i - window + 1, i + 1).filter(v => v !== null);
    return slice.length ? slice.reduce((s, v) => s + v, 0) / slice.length : null;
  });
}

function logReturn(closes) {
  return closes.map((c, i) => {
    if (i === 0 || !c || !closes[i - 1]) return null;
    return Math.log(c / closes[i - 1]);
  });
}
