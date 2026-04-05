import json
import yfinance as yf
import pandas as pd
from ta.momentum import RSIIndicator
from datetime import datetime, timezone
import os

def calc_streak(series):
    clean = series.dropna()
    if len(clean) == 0 or clean.iloc[-1] <= 0: return 0
    count = 0
    for val in clean.values[::-1]:
        if val > 0: count += 1
        else: break
    return count

def calc_daily_metrics(df):
    df = df.copy() 
    df['RSI'] = RSIIndicator(close=df['Close'], window=14).rsi()
    df['Vol_SMA'] = df['Volume'].rolling(window=20).mean()
    df['Vol_Spike'] = df['Volume'] / df['Vol_SMA']
    df['ROC1'] = df['Close'].pct_change(periods=20) * 100
    df['ROC2'] = df['ROC1'] - df['ROC1'].shift(5)
    df['ROC3'] = df['ROC2'] - df['ROC2'].shift(5)
    df = df.dropna()
    if len(df) == 0: return None
    
    hist_df = df.tail(20)
    curr = df.iloc[-1]
    return {
        "rsi": round(curr['RSI'], 1), "vol_spike": round(curr['Vol_Spike'], 2),
        "roc1": round(curr['ROC1'], 2), "roc2": round(curr['ROC2'], 2),
        "roc3": round(curr['ROC3'], 2),
        "streak": calc_streak(df['ROC2']), "date": curr.name.strftime('%Y-%m-%d'),
        "roc2_hist": hist_df['ROC2'].round(2).tolist(),
        "roc3_hist": hist_df['ROC3'].round(2).tolist()
    }

def calc_weekly_metrics(df):
    df = df.copy() 
    df['RSI'] = RSIIndicator(close=df['Close'], window=14).rsi()
    df['Vol_SMA'] = df['Volume'].rolling(window=13).mean()
    df['Vol_Spike'] = df['Volume'] / df['Vol_SMA']
    df['ROC1'] = df['Close'].pct_change(periods=13) * 100
    df['ROC2'] = df['ROC1'] - df['ROC1'].shift(4)
    df['ROC3'] = df['ROC2'] - df['ROC2'].shift(4)
    df = df.dropna()
    if len(df) == 0: return None
    
    hist_df = df.tail(13)
    curr = df.iloc[-1]
    return {
        "rsi": round(curr['RSI'], 1), "vol_spike": round(curr['Vol_Spike'], 2),
        "roc1": round(curr['ROC1'], 2), "roc2": round(curr['ROC2'], 2),
        "roc3": round(curr['ROC3'], 2),
        "streak": calc_streak(df['ROC2']), "date": curr.name.strftime('%Y-%m-%d'),
        "roc2_hist": hist_df['ROC2'].round(2).tolist(),
        "roc3_hist": hist_df['ROC3'].round(2).tolist()
    }

def main():
    try:
        with open('config.json', 'r', encoding='utf-8') as f:
            config_data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"설정 파일 로드 실패: {e}")
        return

    results = {"last_updated": datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC'), "assets": []}
    
    try:
        sgov_df = yf.download("SGOV", period="6mo", interval="1d", progress=False, auto_adjust=True)
        bil_df = yf.download("BIL", period="6mo", interval="1d", progress=False, auto_adjust=True)
        
        if isinstance(sgov_df.columns, pd.MultiIndex): sgov_df.columns = sgov_df.columns.droplevel(1)
        if isinstance(bil_df.columns, pd.MultiIndex): bil_df.columns = bil_df.columns.droplevel(1)
        
        sgov_flow = (sgov_df['Close'] * sgov_df['Volume']) / 1e9
        bil_flow = (bil_df['Close'] * bil_df['Volume']) / 1e9
        
        df_park = pd.DataFrame({'SGOV': sgov_flow, 'BIL': bil_flow}).dropna().tail(60)
        df_park['Combined'] = df_park['SGOV'] + df_park['BIL']
        
        results['parking_data'] = {
            'sgov_hist': df_park['SGOV'].round(3).tolist(),
            'bil_hist': df_park['BIL'].round(3).tolist(),
            'combined_hist': df_park['Combined'].round(3).tolist()
        }
        print("[대기자금] SGOV/BIL 스캔 완료")
    except Exception as e:
        print(f"[대기자금] 스캔 실패: {e}")
        results['parking_data'] = None
    
    for asset in config_data.get('tickers', []):
        symbol = asset['symbol']
        try:
            df_daily = yf.download(symbol, period="2y", interval="1d", progress=False, auto_adjust=True)
            if isinstance(df_daily.columns, pd.MultiIndex): df_daily.columns = df_daily.columns.droplevel(1)
            
            one_year_ago = df_daily.index[-1] - pd.DateOffset(years=1)
            df_52w = df_daily[df_daily.index >= one_year_ago]
            
            auto_high_52w = float(df_52w['High'].max())
            curr_price = float(df_daily['Close'].iloc[-1])
            
            ticker_obj = yf.Ticker(symbol)
            pe_type = "Trailing"
            current_pe = ticker_obj.info.get('trailingPE')
            if not current_pe: 
                current_pe = ticker_obj.info.get('forwardPE')
                pe_type = "Forward" if current_pe else None

            daily_res = calc_daily_metrics(df_daily)
            
            df_weekly = yf.download(symbol, period="2y", interval="1wk", progress=False, auto_adjust=True)
            if isinstance(df_weekly.columns, pd.MultiIndex): df_weekly.columns = df_weekly.columns.droplevel(1)
            weekly_res = calc_weekly_metrics(df_weekly)
            
            if daily_res and weekly_res:
                results['assets'].append({
                    "symbol": symbol, 
                    "group": asset.get('group', 'C'), 
                    "current_price": round(curr_price, 2),
                    "daily": daily_res, 
                    "weekly": weekly_res,
                    "monthly_budget": asset.get('monthly_budget', 0),
                    "auto_high_52w": round(auto_high_52w, 2),
                    "current_pe": round(current_pe, 2) if current_pe else None,
                    "pe_type": pe_type,
                    "config_exec": asset.get('executed_months', 0.0),
                    "config_high": asset.get('high_52w', 0.0),
                    "config_pe": asset.get('avg_pe_3y', 0.0),
                    "config_start_date": asset.get('start_date', "2026-01") # 🚨 타임 엔진을 위한 시작일 데이터 파이프라인 개통
                })
                print(f"[{symbol}] 스캔 완료")
            else:
                print(f"[{symbol}] ⚠️ 지표 부족으로 제외됨")
        except Exception as e:
            print(f"[{symbol}] 에러 발생: {e}")
            
    tmp_file = 'dashboard_data_tmp.json'
    with open(tmp_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    os.replace(tmp_file, 'dashboard_data.json')

if __name__ == "__main__":
    main()