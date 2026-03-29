import json
import yfinance as yf
import pandas as pd
from ta.momentum import RSIIndicator
from datetime import datetime
import re  
import os  

# 사용자 MDD 테이블
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
            
    target_months = 0
    if "개월" in allocation_str:
        match = re.search(r'\d+', allocation_str)
        if match:
            target_months = int(match.group())
            
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
    df = df.copy() 
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
    df = df.copy() 
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
    try:
        with open('config.json', 'r', encoding='utf-8') as f:
            config_data = json.load(f)
    except FileNotFoundError:
        print("❌ config.json 파일을 찾을 수 없습니다.")
        return
    except json.JSONDecodeError:
        print("❌ config.json 형식이 올바르지 않습니다.")
        return
        
    # ✅ 2. tickers 키 누락 시 방어
    if 'tickers' not in config_data:
        print("❌ config.json에 'tickers' 항목이 없습니다.")
        return

    print("\n" + "="*50)
    print("📈 사용자 데이터 입력 (변경할 값이 없으면 그냥 Enter를 누르세요)")
    print("="*50)
    
    for asset in config_data['tickers']:
        symbol = asset['symbol']
        print(f"\n[{symbol}] 설정 업데이트")
        
        curr_exec = asset.get('executed_months', 0.0)
        new_exec = input(f" - 현재 보유 개월 수 (현재: {curr_exec}개월): ")
        if new_exec.strip():
            try:
                val = float(new_exec)
                if val < 0:
                    print("   ⚠️ 음수는 입력할 수 없습니다. 기존 값을 유지합니다.")
                else:
                    asset['executed_months'] = val
            except ValueError:
                print("   ⚠️ 올바른 숫자가 아닙니다. 기존 값을 유지합니다.")
                
        if asset.get('group') == '대형 우량주':
            curr_pe = asset.get('avg_pe_3y', 0.0)
            new_pe = input(f" - 3년 평균 PER (현재: {curr_pe}): ")
            if new_pe.strip():
                try:
                    val = float(new_pe)
                    if val < 0:
                        print("   ⚠️ 음수는 입력할 수 없습니다. 기존 값을 유지합니다.")
                    else:
                        asset['avg_pe_3y'] = val
                except ValueError:
                    print("   ⚠️ 올바른 숫자가 아닙니다. 기존 값을 유지합니다.")

        curr_high = asset.get('high_52w', 0.0)
        high_display = f"{curr_high} (수동)" if curr_high > 0 else "자동계산 중"
        high_prompt = f" - 52주 전고점 (현재: {high_display}, 자동=0, 변경없으면 Enter): " 
        new_high = input(high_prompt)
        if new_high.strip():
            try:
                val = float(new_high)
                # ✅ 1. high_52w 음수 입력 시 경고 출력
                if val < 0:
                    print("   ⚠️ 음수는 입력할 수 없습니다. 기존 값을 유지합니다.")
                elif val == 0:
                    asset['high_52w'] = 0.0
                else:
                    asset['high_52w'] = val
            except ValueError:
                print("   ⚠️ 올바른 숫자가 아닙니다. 기존 값을 유지합니다.")

    tmp_file = 'config.json.tmp'
    with open(tmp_file, 'w', encoding='utf-8') as f:
        json.dump(config_data, f, ensure_ascii=False, indent=2)
    os.replace(tmp_file, 'config.json')
        
    print("\n" + "="*50)
    print("✅ 데이터 수집 및 계산을 시작합니다...")
    print("="*50 + "\n")

    results = {"last_updated": datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC'), "assets": []}
    
    for asset in config_data['tickers']:
        symbol = asset['symbol']
        try:
            df_daily = yf.download(symbol, period="2y", interval="1d", progress=False, auto_adjust=True)
            if isinstance(df_daily.columns, pd.MultiIndex): df_daily.columns = df_daily.columns.droplevel(1)
            
            is_manual_high = asset.get('high_52w', 0.0) > 0
            if is_manual_high:
                high_52w = float(asset['high_52w'])
            else:
                cutoff = df_daily.index[-1] - pd.DateOffset(years=1)
                df_52w = df_daily[df_daily.index >= cutoff]
                high_52w = float(df_52w['High'].max())
                
            curr_price = float(df_daily['Close'].iloc[-1])
            raw_drawdown = ((curr_price - high_52w) / high_52w) * 100
            
            per_data = None
            effective_dd = raw_drawdown
            
            if asset.get('group') == '대형 우량주' and asset.get('avg_pe_3y', 0.0) > 0:
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
            
            monthly_budget = asset.get('monthly_budget', 0)
            executed_months = asset.get('executed_months', 0.0)
            
            if target_months == 0:
                buy_months = 0
            elif executed_months > 0:
                buy_months = max(target_months - executed_months, 0)
            else:
                buy_months = target_months
                
            final_order = buy_months * monthly_budget
            
            buy_months_str = f"{int(buy_months)}" if float(buy_months).is_integer() else f"{buy_months:.1f}"
            
            if buy_months == 0:
                allocation_fund = "휴식 (Lockdown)"
            elif monthly_budget == 0:
                allocation_fund = f"예산 미설정 ({buy_months_str}개월 치 필요)"
            else:
                allocation_fund = f"${final_order:,.0f} ({buy_months_str}개월 치)"
            
            daily_res = calc_daily_metrics(df_daily)
            df_weekly = yf.download(symbol, period="2y", interval="1wk", progress=False, auto_adjust=True)
            if isinstance(df_weekly.columns, pd.MultiIndex): df_weekly.columns = df_weekly.columns.droplevel(1)
            weekly_res = calc_weekly_metrics(df_weekly)
            
            if daily_res and weekly_res:
                results['assets'].append({
                    "symbol": symbol, "group": asset['group'], "current_price": round(curr_price, 2),
                    "mdd": round(effective_dd, 1), "target_tier": target_tier, "allocation_fund": allocation_fund,
                    "per_data": per_data, "daily": daily_res, "weekly": weekly_res,
                    "high_52w_used": round(high_52w, 2),
                    "high_52w_source": "manual" if is_manual_high else "auto"
                })
                print(f"[{symbol}] 데이터 처리 완료")
            else:
                # ✅ 3. 지표 계산 실패 시 경고 출력
                print(f"[{symbol}] ⚠️ 지표 계산 실패로 결과에서 제외됨")
        except Exception as e:
            print(f"[{symbol}] 에러 발생: {e}")
            
    tmp_out = 'dashboard_data.json.tmp'
    with open(tmp_out, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    os.replace(tmp_out, 'dashboard_data.json')

if __name__ == "__main__":
    main()
