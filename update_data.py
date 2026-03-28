import json
import yfinance as yf
import pandas as pd
from ta.trend import MACD, PSARIndicator
from ta.momentum import RSIIndicator
from datetime import datetime

def analyze_timeframe(df, rsi_buy_threshold):
    # 기술적 지표 계산
    df['RSI'] = RSIIndicator(close=df['Close'], window=14).rsi()
    macd = MACD(close=df['Close'], window_slow=26, window_fast=12, window_sign=9)
    df['MACD_Hist'] = macd.macd_diff()
    psar = PSARIndicator(high=df['High'], low=df['Low'], close=df['Close'], step=0.02, max_step=0.20)
    df['PSAR'] = psar.psar()
    df = df.dropna()

    if len(df) < 3:
        return None

    last_3 = df.tail(3)
    curr = df.iloc[-1]
    prev = df.iloc[-2]
    prev2 = df.iloc[-3]

    # 조건 판별
    is_currently_buy = curr['RSI'] <= rsi_buy_threshold
    was_buy_recently = any((rsi <= rsi_buy_threshold) for rsi in last_3['RSI'].values)

    sar_flip_up = (prev['PSAR'] > prev['High']) and (curr['PSAR'] < curr['Low'])
    macd_hist_rising = (curr['MACD_Hist'] > prev['MACD_Hist']) and (prev['MACD_Hist'] > prev2['MACD_Hist'])

    # 상태 결정 (사용자 철학 반영)
    status = "기계적 DCA (일상)"
    color = "gray"
    
    if was_buy_recently and sar_flip_up and macd_hist_rising:
        status = "🚨 V자 턴어라운드 (땅!)"
        color = "green"
    elif is_currently_buy:
        status = "⚠️ 바닥권 진입 (준비~)"
        color = "yellow"

    return {
        "price": round(curr['Close'], 2),
        "rsi": round(curr['RSI'], 2),
        "status": status,
        "color": color,
        "date": curr.name.strftime('%Y-%m-%d')
    }

def main():
    with open('config.json', 'r', encoding='utf-8') as f:
        config_data = json.load(f)
    
    results = {"last_updated": datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC'), "assets": []}
    
    for asset in config_data['tickers']:
        symbol = asset['symbol']
        rsi_buy_list = asset.get('rsi_buy', [40, 50])
        rsi_buy_threshold = rsi_buy_list[0] if len(rsi_buy_list) > 0 else 40

        try:
            # 일봉(Daily) 데이터 처리
            df_daily = yf.download(symbol, interval="1d", period="1y", progress=False, auto_adjust=True)
            if isinstance(df_daily.columns, pd.MultiIndex): df_daily.columns = df_daily.columns.droplevel(1)
            daily_res = analyze_timeframe(df_daily, rsi_buy_threshold)

            # 주봉(Weekly) 데이터 처리
            df_weekly = yf.download(symbol, interval="1wk", period="2y", progress=False, auto_adjust=True)
            if isinstance(df_weekly.columns, pd.MultiIndex): df_weekly.columns = df_weekly.columns.droplevel(1)
            weekly_res = analyze_timeframe(df_weekly, rsi_buy_threshold)

            if daily_res and weekly_res:
                results['assets'].append({
                    "symbol": symbol,
                    "group": asset['group'],
                    "current_price": daily_res['price'], # 현재가는 최신 일봉 기준
                    "daily": daily_res,
                    "weekly": weekly_res
                })
                print(f"[{symbol}] 듀얼 타임프레임 데이터 처리 완료")
            
        except Exception as e:
            print(f"[{symbol}] 에러 발생: {e}")
            
    with open('dashboard_data.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
