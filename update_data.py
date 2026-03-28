import json
import yfinance as yf
import pandas as pd
from ta.momentum import RSIIndicator
from datetime import datetime

# 사용자 MDD 테이블
MDD_TABLES = {
    'tech_giants': {
        -15.0: '3개월 치', -20.0: '6개월 치', -25.0: '10개월 치', -30.0: '14개월 치', 
        -35.0: '18개월 치', -40.0: '22개월 치', -45.0: '26개월 치', -50.0: '30개월 치', 
        -55.0: '33개월 치', -60.0: '36개월 (Max)'
    },
    'growth_crypto': {
        -20.0: '3개월 치', -25.0: '6개월 치', -30.0: '9개월 치', -35.0: '12개월 치', 
        -40.0: '15개월 치', -45.0: '18개월 치', -50.0: '21개월 치', -55.0: '24개월 치', 
        -60.0: '27개월 치', -65.0: '30개월 치', -70.0: '33개월 치', -75.0: '36개월 (Max)'
    }
}

# AMZN 매핑 오류 수정 완료
ASSET_TABLE_MAP = {
    'MSFT': 'tech_giants', 'AAPL': 'tech_giants', 'AMZN': 'tech_giants',
    'PLTR': 'growth_crypto', 'TSLA': 'growth_crypto', 'IBIT': 'growth_crypto', 'BMNR': 'growth_crypto'
}

def get_allocation_info(symbol, current_dd):
    table_name = ASSET_TABLE_MAP.get(symbol, 'growth_crypto')
    table = MDD_TABLES[table_name]
    
    allocation = "일상 DCA"
    target_tier = 0.0
    
    # 오름차순 정렬: -60, -55, ... -15 (클로드 제안 수용)
    sorted_tiers = sorted(table.keys()) 
    
    for tier in sorted_tiers:
        if current_dd <= tier:
            allocation = table[tier]
            target_tier = tier
            break # 가장 깊은 바닥부터 체크하여 조건에 맞으면 즉시 종료
            
    return target_tier, allocation

def calc_streak(series):
    # Numpy 배열 오류 수정 (reversed -> [::-1] 슬라이싱 사용)
    if series.iloc[-1] <= 0: return 0
    count = 0
    for val in series.values[::-1]:
        if val > 0: count += 1
        else: break
    return count

def calc_daily_metrics(df):
    df['RSI'] = RSIIndicator(close=df['Close'], window=14).rsi()
    df['Vol_SMA'] = df['Volume'].rolling(window=20).mean()
    df['Vol_Spike'] = df['Volume'] / df['Vol_SMA']
    df['ROC1'] = df['Close'].pct_change(periods=20) * 100
    df['ROC2'] = df['ROC1'] - df['ROC1'].shift(5)
    df = df.dropna()
    if len(df) == 0: return None
    curr = df.iloc[-1]
    return {
        "rsi": round(curr['RSI'], 1), "vol_spike": round(curr['Vol_Spike'], 2),
        "roc1": round(curr['ROC1'], 2), "roc2": round(curr['ROC2'], 2),
        "streak": calc_streak(df['ROC2']), "date": curr.name.strftime('%Y-%m-%d')
    }

def calc_weekly_metrics(df):
    df['RSI'] = RSIIndicator(close=df['Close'], window=14).rsi()
    df['Vol_SMA'] = df['Volume'].rolling(window=10).mean()
    df['Vol_Spike'] = df['Volume'] / df['Vol_SMA']
    df['ROC1'] = df['Close'].pct_change(periods=13) * 100
    df['ROC2'] = df['ROC1'] - df['ROC1'].shift(4)
    df = df.dropna()
    if len(df) == 0: return None
    curr = df.iloc[-1]
    return {
        "rsi": round(curr['RSI'], 1), "vol_spike": round(curr['Vol_Spike'], 2),
        "roc1": round(curr['ROC1'], 2), "roc2": round(curr['ROC2'], 2),
        "streak": calc_streak(df['ROC2']), "date": curr.name.strftime('%Y-%m-%d')
    }

def main():
    with open('config.json', 'r', encoding='utf-8') as f:
        config_data = json.load(f)
    results = {"last_updated": datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC'), "assets": []}
    
    for asset in config_data['tickers']:
        symbol = asset['symbol']
        try:
            df_daily = yf.download(symbol, period="2y", interval="1d", progress=False, auto_adjust=True)
            if isinstance(df_daily.columns, pd.MultiIndex): df_daily.columns = df_daily.columns.droplevel(1)
            
            # 52주 고점 대비 하락률 (용어를 drawdown으로 정정)
            df_52w = df_daily.tail(252)
            high_52w = df_52w['Close'].max()
            curr_price = df_daily['Close'].iloc[-1]
            drawdown = ((curr_price - high_52w) / high_52w) * 100
            
            target_tier, allocation_fund = get_allocation_info(symbol, drawdown)
            
            daily_res = calc_daily_metrics(df_daily)
            df_weekly = yf.download(symbol, period="2y", interval="1wk", progress=False, auto_adjust=True)
            if isinstance(df_weekly.columns, pd.MultiIndex): df_weekly.columns = df_weekly.columns.droplevel(1)
            weekly_res = calc_weekly_metrics(df_weekly)
            
            if daily_res and weekly_res:
                results['assets'].append({
                    "symbol": symbol, "group": asset['group'], "current_price": round(curr_price, 2),
                    "mdd": round(drawdown, 1), "target_tier": target_tier, "allocation_fund": allocation_fund,
                    "daily": daily_res, "weekly": weekly_res
                })
            print(f"[{symbol}] 터미널 계기판 데이터 처리 완료")
        except Exception as e:
            print(f"[{symbol}] 에러 발생: {e}")
            
    with open('dashboard_data.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
