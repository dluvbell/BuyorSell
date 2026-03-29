import json
import yfinance as yf
import pandas as pd
from ta.momentum import RSIIndicator
from datetime import datetime

# 사용자 MDD 테이블 (AMZN 독립 테이블 완벽 분리 적용)
MDD_TABLES = {
    'tech_giants': {
        -15.0: '3개월 치', -20.0: '6개월 치', -25.0: '10개월 치', -30.0: '14개월 치', 
        -35.0: '18개월 치', -40.0: '22개월 치', -45.0: '26개월 치', -50.0: '30개월 치', 
        -55.0: '33개월 치', -60.0: '36개월 (Max)'
    },
    'amzn': {
        -20.0: '3개월 치', -25.0: '6개월 치', -30.0: '10개월 치', -35.0: '14개월 치', 
        -40.0: '18개월 치', -45.0: '22개월 치', -50.0: '26개월 치', -55.0: '30개월 치', 
        -60.0: '33개월 치', -65.0: '36개월 (Max)'
    },
    'growth': {
        -20.0: '3개월 치', -25.0: '6개월 치', -30.0: '9개월 치', -35.0: '12개월 치', 
        -40.0: '15개월 치', -45.0: '18개월 치', -50.0: '21개월 치', -55.0: '24개월 치', 
        -60.0: '27개월 치', -65.0: '30개월 치', -70.0: '33개월 치', -75.0: '36개월 (Max)'
    },
    'ibit_etha': {
        -25.0: '3개월 치', -30.0: '6개월 치', -35.0: '9개월 치', -40.0: '12개월 치', 
        -45.0: '15개월 치', -50.0: '18개월 치', -55.0: '21개월 치', -60.0: '24개월 치', 
        -65.0: '27개월 치', -70.0: '30개월 치', -75.0: '33개월 치', -80.0: '36개월 (Max)'
    },
    'bmnr': {
        -30.0: '3개월 치', -35.0: '6개월 치', -40.0: '9개월 치', -45.0: '12개월 치', 
        -50.0: '15개월 치', -55.0: '18개월 치', -60.0: '21개월 치', -65.0: '24개월 치', 
        -70.0: '27개월 치', -75.0: '30개월 치', -80.0: '33개월 치', -85.0: '36개월 (Max)'
    }
}

# 5단계 테이블에 따른 정확한 매핑
ASSET_TABLE_MAP = {
    'MSFT': 'tech_giants', 'AAPL': 'tech_giants', 
    'AMZN': 'amzn',
    'PLTR': 'growth', 'TSLA': 'growth',
    'IBIT': 'ibit_etha', 'ETHA': 'ibit_etha',
    'BMNR': 'bmnr'
}

def get_per_adjustment(current_pe, avg_pe):
    discount_rate = ((current_pe - avg_pe) / avg_pe) * 100
    if discount_rate > 25: bonus = -15
    elif discount_rate > 15: bonus = -10
    elif discount_rate > 5: bonus = -5
    elif discount_rate >= -5: bonus = 0
    elif discount_rate >= -15: bonus = 5
    elif discount_rate >= -25: bonus = 10
    else: bonus = 15
    return discount_rate, bonus

def get_allocation_info(symbol, effective_dd):
    table_name = ASSET_TABLE_MAP.get(symbol, 'growth')
    table = MDD_TABLES[table_name]
    allocation_str = "일상 DCA"
    target_tier = 0.0
    sorted_tiers = sorted(table.keys()) 
    for tier in sorted_tiers:
        if effective_dd <= tier:
            allocation_str = table[tier]
            target_tier = tier
            break
            
    # 할당 문자열에서 목표 개월 수(int) 정밀 추출
    target_months = 0
    if "개월" in allocation_str:
        try:
            target_months = int(''.join(filter(str.isdigit, allocation_str)))
        except:
            pass
            
    return target_tier, allocation_str, target_months

def calc_streak(series):
    clean = series.dropna()
    if len(clean) == 0 or clean.iloc[-1] <= 0: return 0
    count = 0
    for val in clean.values[::-1]:
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
            # 가격 왜곡 차단 옵션 유지
            df_daily = yf.download(symbol, period="2y", interval="1d", progress=False, auto_adjust=False)
            if isinstance(df_daily.columns, pd.MultiIndex): df_daily.columns = df_daily.columns.droplevel(1)
            
            df_52w = df_daily.tail(252)
            # 장중 고가(High) 스캔 원칙 유지
            high_52w = float(df_52w['High'].max())
            curr_price = float(df_daily['Close'].iloc[-1])
            
            raw_drawdown = ((curr_price - high_52w) / high_52w) * 100
            
            per_data = None
            effective_dd = raw_drawdown
            
            if asset.get('group') == 'A' and 'avg_pe_3y' in asset:
                ticker_obj = yf.Ticker(symbol)
                current_pe = ticker_obj.info.get('trailingPE')
                if not current_pe: current_pe = ticker_obj.info.get('forwardPE')
                
                if current_pe:
                    avg_pe = asset['avg_pe_3y']
                    discount_rate, bonus = get_per_adjustment(current_pe, avg_pe)
                    effective_dd = raw_drawdown - bonus
                    
                    per_data = {
                        "current_pe": round(current_pe, 2), "avg_pe": round(avg_pe, 2),
                        "discount_rate": round(discount_rate, 1), "bonus": bonus,
                        "raw_mdd": round(raw_drawdown, 1)
                    }

            target_tier, allocation_str, target_months = get_allocation_info(symbol, effective_dd)
            
            # 🚨 예산 자동 연산 로직 (구글 시트의 락다운 판별 기능 이식)
            monthly_budget = asset.get('monthly_budget', 0)
            executed_months = asset.get('executed_months', 0.0)
            
            buy_months = 0
            if executed_months > 0:
                buy_months = max(target_months - executed_months, 0)
            else:
                buy_months = max(target_months, 1) # 미집행 상태면 최소 1개월치 구매
                
            final_order = buy_months * monthly_budget
            
            # app.js UI 렌더링에 최적화된 스트링 포매팅 반환
            if final_order > 0:
                allocation_fund = f"${final_order:,.0f} ({int(buy_months)}개월 치)"
            else:
                allocation_fund = "휴식 (Lockdown)"
            
            daily_res = calc_daily_metrics(df_daily)
            
            df_weekly = yf.download(symbol, period="2y", interval="1wk", progress=False, auto_adjust=False)
            if isinstance(df_weekly.columns, pd.MultiIndex): df_weekly.columns = df_weekly.columns.droplevel(1)
            weekly_res = calc_weekly_metrics(df_weekly)
            
            if daily_res and weekly_res:
                results['assets'].append({
                    "symbol": symbol, "group": asset['group'], "current_price": round(curr_price, 2),
                    "mdd": round(effective_dd, 1), "target_tier": target_tier, "allocation_fund": allocation_fund,
                    "per_data": per_data, "daily": daily_res, "weekly": weekly_res
                })
            print(f"[{symbol}] 데이터 처리 및 예산 연산 완료")
        except Exception as e:
            print(f"[{symbol}] 에러 발생: {e}")
            
    with open('dashboard_data.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()