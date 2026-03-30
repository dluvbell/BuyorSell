import json
import yfinance as yf
import pandas as pd
from ta.momentum import RSIIndicator
from datetime import datetime
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
    df['ROC3'] = df['ROC2'] - df['ROC2'].shift(5) # 🚨 추가: 일봉 ROC3 (5일 변위)
    df = df.dropna()
    if len(df) == 0: return None
    curr = df.iloc[-1]
    return {
        "rsi": round(curr['RSI'], 1), "vol_spike": round(curr['Vol_Spike'], 2),
        "roc1": round(curr['ROC1'], 2), "roc2": round(curr['ROC2'], 2),
        "roc3": round(curr['ROC3'], 2), # 🚨 추가
        "streak": calc_streak(df['ROC2']), "date": curr.name.strftime('%Y-%m-%d')
    }

def calc_weekly_metrics(df):
    df = df.copy() 
    df['RSI'] = RSIIndicator(close=df['Close'], window=14).rsi()
    df['Vol_SMA'] = df['Volume'].rolling(window=13).mean()
    df['Vol_Spike'] = df['Volume'] / df['Vol_SMA']
    df['ROC1'] = df['Close'].pct_change(periods=13) * 100
    df['ROC2'] = df['ROC1'] - df['ROC1'].shift(4)
    df['ROC3'] = df['ROC2'] - df['ROC2'].shift(4) # 🚨 추가: 주봉 ROC3 (4주 변위)
    df = df.dropna()
    if len(df) == 0: return None
    curr = df.iloc[-1]
    return {
        "rsi": round(curr['RSI'], 1), "vol_spike": round(curr['Vol_Spike'], 2),
        "roc1": round(curr['ROC1'], 2), "roc2": round(curr['ROC2'], 2),
        "roc3": round(curr['ROC3'], 2), # 🚨 추가
        "streak": calc_streak(df['ROC2']), "date": curr.name.strftime('%Y-%m-%d')
    }

def main():
    try:
        with open('config.json', 'r', encoding='utf-8') as f:
            config_data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"설정 파일 로드 실패: {e}")
        return

    results = {"last_updated": datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC'), "assets": []}
    
    for asset in config_data.get('tickers', []):
        symbol = asset['symbol']
        try:
            # 가격 왜곡 차단 및 분할 정확도 유지
            df_daily = yf.download(symbol, period="2y", interval="1d", progress=False, auto_adjust=False)
            if isinstance(df_daily.columns, pd.MultiIndex): df_daily.columns = df_daily.columns.droplevel(1)
            
            # 정확히 1년 전 날짜 기준으로 장중 고점(High) 필터링
            one_year_ago = df_daily.index[-1] - pd.DateOffset(years=1)
            df_52w = df_daily[df_daily.index >= one_year_ago]
            
            auto_high_52w = float(df_52w['High'].max())
            curr_price = float(df_daily['Close'].iloc[-1])
            
            ticker_obj = yf.Ticker(symbol)
            current_pe = ticker_obj.info.get('trailingPE')
            if not current_pe: current_pe = ticker_obj.info.get('forwardPE')

            daily_res = calc_daily_metrics(df_daily)
            
            df_weekly = yf.download(symbol, period="2y", interval="1wk", progress=False, auto_adjust=False)
            if isinstance(df_weekly.columns, pd.MultiIndex): df_weekly.columns = df_weekly.columns.droplevel(1)
            weekly_res = calc_weekly_metrics(df_weekly)
            
            if daily_res and weekly_res:
                results['assets'].append({
                    "symbol": symbol, 
                    "group": asset.get('group', 'C'), 
                    "current_price": round(curr_price, 2),
                    "daily": daily_res, 
                    "weekly": weekly_res,
                    # JS 엔진과 100% 매핑되는 변수명
                    "monthly_budget": asset.get('monthly_budget', 0),
                    "auto_high_52w": round(auto_high_52w, 2),
                    "current_pe": round(current_pe, 2) if current_pe else None,
                    "config_exec": asset.get('executed_months', 0.0),
                    "config_high": asset.get('high_52w', 0.0),
                    "config_pe": asset.get('avg_pe_3y', 0.0)
                })
                print(f"[{symbol}] 스캔 완료")
            else:
                print(f"[{symbol}] ⚠️ 지표 부족으로 제외됨")
        except Exception as e:
            print(f"[{symbol}] 에러 발생: {e}")
            
    # 원자적 파일 쓰기 안전장치
    tmp_file = 'dashboard_data_tmp.json'
    with open(tmp_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    os.replace(tmp_file, 'dashboard_data.json')

if __name__ == "__main__":
    main()
