import json
import yfinance as yf
import pandas as pd
from ta.trend import MACD, PSARIndicator
from ta.momentum import RSIIndicator
from datetime import datetime

def check_conditions(df, config):
    last_3_weeks = df.tail(3)
    current_week = df.iloc[-1]
    prev_week = df.iloc[-2]
    prev2_week = df.iloc[-3]

    # 방어적 프로그래밍: 리스트 길이 예외 처리 추가 (IndexError 완벽 차단)
    rsi_buy_list = config.get('rsi_buy', [40, 50])
    rsi_sell_list = config.get('rsi_sell', [65, 70])
    rsi_buy_threshold = rsi_buy_list[0] if len(rsi_buy_list) > 0 else 40
    rsi_sell_threshold = rsi_sell_list[1] if len(rsi_sell_list) > 1 else 70

    # 1. 상태 표시용 (가장 엄격하게 '이번 주'만 확인하여 노이즈 차단)
    is_currently_buy_zone = current_week['RSI'] <= rsi_buy_threshold
    is_currently_sell_zone = current_week['RSI'] >= rsi_sell_threshold

    # 2. 실행 검증용 (시차 극복을 위해 최근 3주 터치 이력 확인)
    was_in_buy_zone_recently = any((rsi <= rsi_buy_threshold) for rsi in last_3_weeks['RSI'].values)
    was_in_sell_zone_recently = any((rsi >= rsi_sell_threshold) for rsi in last_3_weeks['RSI'].values)

    # SAR 방향 전환 및 현재 위치 판별 (글로벌 표준인 High/Low 기준)
    sar_flip_up = (prev_week['PSAR'] > prev_week['High']) and (current_week['PSAR'] < current_week['Low'])
    sar_flip_down = (prev_week['PSAR'] < prev_week['Low']) and (current_week['PSAR'] > current_week['High'])
    sar_is_below = current_week['PSAR'] < current_week['Low']
    
    # MACD 히스토그램 2주 연속 상승/하락 판별
    macd_hist_rising = (current_week['MACD_Hist'] > prev_week['MACD_Hist']) and (prev_week['MACD_Hist'] > prev2_week['MACD_Hist'])
    macd_hist_falling = (current_week['MACD_Hist'] < prev_week['MACD_Hist']) and (prev_week['MACD_Hist'] < prev2_week['MACD_Hist'])

    # 최종 상태 판별
    status = "관망 (Hold)"
    color = "gray"
    
    # 매매 실행 신호 (과거 3주 내 RSI 조건 + 현재 SAR 플립 + 현재 MACD 방향 일치 시)
    if was_in_buy_zone_recently and sar_flip_up and macd_hist_rising:
        status = "매수 진입 신호! (Buy)"
        color = "green"
    elif was_in_sell_zone_recently and sar_flip_down and macd_hist_falling:
        status = "전량 매도 신호! (Sell)"
        color = "red"
    # 단순 준비 상태 표시 (과거 무시, 오직 '현재' RSI가 타점에 있을 때만)
    elif is_currently_buy_zone:
        status = "매수 준비 (극한의 공포 진입)"
        color = "yellow"
    elif is_currently_sell_zone:
        status = "매도 준비 (극한의 과열 진입)"
        color = "orange"

    return {
        "price": round(current_week['Close'], 2),
        "rsi": round(current_week['RSI'], 2),
        "macd_hist_rising": bool(macd_hist_rising),
        "sar_below_candle": bool(sar_is_below),
        "sar_flip_up": bool(sar_flip_up),
        "sar_flip_down": bool(sar_flip_down),
        "status": status,
        "color": color,
        "date": current_week.name.strftime('%Y-%m-%d')
    }

def main():
    with open('config.json', 'r', encoding='utf-8') as f:
        config_data = json.load(f)
    
    results = {"last_updated": datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC'), "assets": []}
    
    for asset in config_data['tickers']:
        try:
            # yfinance MultiIndex 오류 해결 및 auto_adjust 유지
            df = yf.download(asset['symbol'], interval="1wk", period="2y", progress=False, auto_adjust=True)
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.droplevel(1)
            
            df['RSI'] = RSIIndicator(close=df['Close'], window=14).rsi()
            macd = MACD(close=df['Close'], window_slow=26, window_fast=12, window_sign=9)
            df['MACD_Hist'] = macd.macd_diff()
            
            psar = PSARIndicator(high=df['High'], low=df['Low'], close=df['Close'], step=0.02, max_step=0.20)
            df['PSAR'] = psar.psar()
            
            df = df.dropna()
            
            if len(df) < 3:
                continue
                
            metrics = check_conditions(df, asset)
            
            results['assets'].append({
                "symbol": asset['symbol'],
                "group": asset['group'],
                "weight": asset['weight'],
                "stop_loss_pct": asset['stop_loss_pct'],
                **metrics
            })
            print(f"[{asset['symbol']}] 데이터 처리 완료")
            
        except Exception as e:
            print(f"[{asset['symbol']}] 에러 발생: {e}")
            
    with open('dashboard_data.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()