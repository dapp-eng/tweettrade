import json
import numpy as np
import pandas as pd
from pathlib import Path

EXPORT_DIR = Path("bbca_data")
OUT_DIR = Path("dashboard_data")
OUT_DIR.mkdir(exist_ok=True)


def safe_read_parquet(path):
    try:
        return pd.read_parquet(path)
    except Exception as e:
        print(f"  SKIP {path.name}: {e}")
        return None


def df_to_json(df, path, orient="records", date_format="iso"):
    df2 = df.copy()
    if df2.index.name or not isinstance(df2.index, pd.RangeIndex):
        df2 = df2.reset_index()
    for col in df2.select_dtypes(include=["datetime64[ns]", "datetimetz"]).columns:
        df2[col] = df2[col].dt.strftime("%Y-%m-%d")
    for col in df2.select_dtypes(include=[np.floating]).columns:
        df2[col] = df2[col].apply(lambda x: round(float(x), 6) if pd.notna(x) else None)
    df2.to_json(path, orient=orient, date_format=date_format, indent=2, force_ascii=False)
    print(f"  OK  {path.name}  ({len(df2)} rows)")


print("BBCA Dashboard JSON Export\n")

print("[1] BBCA OHLCV")
bbca = safe_read_parquet(EXPORT_DIR / "data/bbca_ohlcv.parquet")
if bbca is not None:
    df_to_json(bbca, OUT_DIR / "bbca_ohlcv.json")

print("[2] Daily Sentiment")
sent = safe_read_parquet(EXPORT_DIR / "data/daily_sentiment.parquet")
if sent is not None:
    cols = [c for c in ["sent_score", "n_pos", "n_neg", "n_total",
                        "bullishness_index", "tweet_volume",
                        "weighted_sentiment_score", "sentiment_momentum_ewma",
                        "sentiment_dispersion_std"] if c in sent.columns]
    df_to_json(sent[cols], OUT_DIR / "daily_sentiment.json")

print("[3] Technical Indicators")
tech = safe_read_parquet(EXPORT_DIR / "data/tech_indicators.parquet")
if tech is not None:
    df_to_json(tech, OUT_DIR / "tech_indicators.json")

print("[4] Master DataFrame (trimmed)")
df_all = safe_read_parquet(EXPORT_DIR / "data/df_all.parquet")
if df_all is not None:
    keep = ["close", "open", "high", "low", "volume", "ihsg", "exch_rate",
            "bi_rate", "sent_score", "RSI", "MACD", "SMA", "MFI", "CCI",
            "ADO", "StoD", "daily_pct_change"]
    keep = [c for c in keep if c in df_all.columns]
    df_to_json(df_all[keep], OUT_DIR / "df_all.json")

print("[5] Walk Forward Validation Results")
wfv = safe_read_parquet(EXPORT_DIR / "metrics/wfv_results.parquet")
if wfv is not None:
    df_to_json(wfv, OUT_DIR / "wfv_results.json")

try:
    wfv_dict = json.loads(Path(EXPORT_DIR / "metrics/wfv_results_dict.json").read_text())
    Path(OUT_DIR / "wfv_results_dict.json").write_text(json.dumps(wfv_dict, indent=2))
    print(f"  OK  wfv_results_dict.json")
except Exception as e:
    print(f"  SKIP wfv_results_dict.json: {e}")

print("[6] Model Comparison Metrics")
comp = safe_read_parquet(EXPORT_DIR / "metrics/model_comparison.parquet")
if comp is not None:
    df_to_json(comp, OUT_DIR / "model_comparison.json")

print("[7] Final Summary")
summary = safe_read_parquet(EXPORT_DIR / "metrics/final_summary.parquet")
if summary is not None:
    df_to_json(summary, OUT_DIR / "final_summary.json")

print("[8] Ablation Study")
ablation = safe_read_parquet(EXPORT_DIR / "metrics/ablation_study.parquet")
if ablation is not None:
    df_to_json(ablation, OUT_DIR / "ablation_study.json")

print("[9] Diebold Mariano Test")
dm = safe_read_parquet(EXPORT_DIR / "metrics/diebold_mariano_results.parquet")
if dm is not None:
    df_to_json(dm, OUT_DIR / "dm_test_results.json")

print("[10] Predictions per Architecture")
for arch in ["LSTM", "GRU", "BiLSTM", "LSTM_Attn"]:
    for f in (EXPORT_DIR / "forecasts").glob(f"pred_{arch}_*.parquet"):
        df_p = safe_read_parquet(f)
        if df_p is not None:
            df_to_json(df_p, OUT_DIR / f"{f.stem}.json")

for f in (EXPORT_DIR / "forecasts").glob("pred_ablation_*.parquet"):
    df_p = safe_read_parquet(f)
    if df_p is not None:
        df_to_json(df_p, OUT_DIR / f"{f.stem}.json")

print("[11] 5 Day Forecast")
fc5 = safe_read_parquet(EXPORT_DIR / "forecasts/forecast_5day.parquet")
if fc5 is not None:
    df_to_json(fc5, OUT_DIR / "forecast_5day.json")

fc5h = safe_read_parquet(EXPORT_DIR / "forecasts/forecast_5day_history.parquet")
if fc5h is not None:
    df_to_json(fc5h, OUT_DIR / "forecast_5day_history.json")

print("[12] Feature Importance")
shap_fi = safe_read_parquet(EXPORT_DIR / "features/shap_feature_importance.parquet")
if shap_fi is not None:
    df_to_json(shap_fi, OUT_DIR / "shap_feature_importance.json")

perm_fi = safe_read_parquet(EXPORT_DIR / "features/permutation_feature_importance.parquet")
if perm_fi is not None:
    df_to_json(perm_fi, OUT_DIR / "permutation_feature_importance.json")

print("[13] Backtest Results")
bt = safe_read_parquet(EXPORT_DIR / "backtest/backtest_results.parquet")
if bt is not None:
    cols_bt = [c for c in ["actual", "predicted", "signal", "stock_daily_return",
                           "strat_daily_return", "cum_stock_return", "cum_strat_return",
                           "stock_portfolio", "strat_portfolio"] if c in bt.columns]
    df_to_json(bt[cols_bt], OUT_DIR / "backtest_results.json")

print("[14] Statistical Tests")
corr = safe_read_parquet(EXPORT_DIR / "stats/sentiment_stock_correlation.parquet")
if corr is not None:
    df_to_json(corr, OUT_DIR / "sentiment_stock_correlation.json")

lead_lag = safe_read_parquet(EXPORT_DIR / "stats/lead_lag_data.parquet")
if lead_lag is not None:
    df_to_json(lead_lag, OUT_DIR / "lead_lag_data.json")

res_diag = safe_read_parquet(EXPORT_DIR / "stats/residual_diagnostics.parquet")
if res_diag is not None:
    df_to_json(res_diag, OUT_DIR / "residual_diagnostics.json")

res_acf = safe_read_parquet(EXPORT_DIR / "stats/residual_acf.parquet")
if res_acf is not None:
    df_to_json(res_acf, OUT_DIR / "residual_acf.json")

bl_weights = safe_read_parquet(EXPORT_DIR / "stats/bl_portfolio_weights.parquet")
if bl_weights is not None:
    df_to_json(bl_weights, OUT_DIR / "bl_portfolio_weights.json")

bl_returns = safe_read_parquet(EXPORT_DIR / "stats/bl_posterior_returns.parquet")
if bl_returns is not None:
    df_to_json(bl_returns, OUT_DIR / "bl_posterior_returns.json")

print("[15] Configs")
for cfg_file in ["run_config.json", "komvar_definitions.json",
                 "best_hp_kv1.json", "best_hp_kv2.json", "default_hp.json"]:
    src = EXPORT_DIR / f"configs/{cfg_file}"
    try:
        data = json.loads(src.read_text())
        (OUT_DIR / cfg_file).write_text(json.dumps(data, indent=2))
        print(f"  OK  {cfg_file}")
    except Exception as e:
        print(f"  SKIP {cfg_file}: {e}")

komvar_tbl = safe_read_parquet(EXPORT_DIR / "configs/komvar_table.parquet")
if komvar_tbl is not None:
    df_to_json(komvar_tbl, OUT_DIR / "komvar_table.json")

ga_src = EXPORT_DIR / "configs/ga_results.json"
try:
    ga_data = json.loads(ga_src.read_text())
    (OUT_DIR / "ga_results.json").write_text(json.dumps(ga_data, indent=2))
    print(f"  OK  ga_results.json")
except Exception as e:
    print(f"  SKIP ga_results.json: {e}")

print("\n[16] Gridsearch")
gs_best = safe_read_parquet(EXPORT_DIR / "metrics/gridsearch_best_kv.parquet")
if gs_best is not None:
    df_to_json(gs_best.head(20), OUT_DIR / "gridsearch_best.json")

gs_second = safe_read_parquet(EXPORT_DIR / "metrics/gridsearch_second_kv.parquet")
if gs_second is not None:
    df_to_json(gs_second.head(20), OUT_DIR / "gridsearch_second.json")

print("\nExport complete")
print(f"Files written to: {OUT_DIR.resolve()}")
print("Copy the 'dashboard_data' folder next to your index.html before deploying.")