// ═══════════════════════════════════════════════════════════
// 사령관 전용 전술 연산 엔진 (인터페이스 및 버그 픽스 완료)
// ═══════════════════════════════════════════════════════════

const MDD_TABLES = {
    'tech_giants': [
        { tier: -60.0, months: 36, str: '36개월 (Max)' }, { tier: -55.0, months: 33, str: '33개월 치' }, { tier: -50.0, months: 30, str: '30개월 치' },
        { tier: -45.0, months: 26, str: '26개월 치' }, { tier: -40.0, months: 22, str: '22개월 치' }, { tier: -35.0, months: 18, str: '18개월 치' },
        { tier: -30.0, months: 14, str: '14개월 치' }, { tier: -25.0, months: 10, str: '10개월 치' }, { tier: -20.0, months: 6, str: '6개월 치' },
        { tier: -15.0, months: 3, str: '3개월 치' }
    ],
    'covered_call': [
        { tier: -55.0, months: 36, str: '36개월 (Max)' }, { tier: -50.0, months: 33, str: '33개월 치' }, { tier: -45.0, months: 30, str: '30개월 치' },
        { tier: -40.0, months: 26, str: '26개월 치' }, { tier: -35.0, months: 22, str: '22개월 치' }, { tier: -30.0, months: 18, str: '18개월 치' },
        { tier: -25.0, months: 14, str: '14개월 치' }, { tier: -20.0, months: 10, str: '10개월 치' }, { tier: -15.0, months: 6, str: '6개월 치' },
        { tier: -10.0, months: 3, str: '3개월 치' }
    ],
    'growth': [
        { tier: -75.0, months: 36, str: '36개월 (Max)' }, { tier: -70.0, months: 33, str: '33개월 치' }, { tier: -65.0, months: 30, str: '30개월 치' },
        { tier: -60.0, months: 27, str: '27개월 치' }, { tier: -55.0, months: 24, str: '24개월 치' }, { tier: -50.0, months: 21, str: '21개월 치' },
        { tier: -45.0, months: 18, str: '18개월 치' }, { tier: -40.0, months: 15, str: '15개월 치' }, { tier: -35.0, months: 12, str: '12개월 치' },
        { tier: -30.0, months: 9, str: '9개월 치' }, { tier: -25.0, months: 6, str: '6개월 치' }, { tier: -20.0, months: 3, str: '3개월 치' }
    ],
    'ibit_etha': [
        { tier: -80.0, months: 36, str: '36개월 (Max)' }, { tier: -75.0, months: 33, str: '33개월 치' }, { tier: -70.0, months: 30, str: '30개월 치' },
        { tier: -65.0, months: 27, str: '27개월 치' }, { tier: -60.0, months: 24, str: '24개월 치' }, { tier: -55.0, months: 21, str: '21개월 치' },
        { tier: -50.0, months: 18, str: '18개월 치' }, { tier: -45.0, months: 15, str: '15개월 치' }, { tier: -40.0, months: 12, str: '12개월 치' },
        { tier: -35.0, months: 9, str: '9개월 치' }, { tier: -30.0, months: 6, str: '6개월 치' }, { tier: -25.0, months: 3, str: '3개월 치' }
    ],
    'bmnr': [
        { tier: -85.0, months: 36, str: '36개월 (Max)' }, { tier: -80.0, months: 33, str: '33개월 치' }, { tier: -75.0, months: 30, str: '30개월 치' },
        { tier: -70.0, months: 27, str: '27개월 치' }, { tier: -65.0, months: 24, str: '24개월 치' }, { tier: -60.0, months: 21, str: '21개월 치' },
        { tier: -55.0, months: 18, str: '18개월 치' }, { tier: -50.0, months: 15, str: '15개월 치' }, { tier: -45.0, months: 12, str: '12개월 치' },
        { tier: -40.0, months: 9, str: '9개월 치' }, { tier: -35.0, months: 6, str: '6개월 치' }, { tier: -30.0, months: 3, str: '3개월 치' }
    ]
};

// 🚨 사령관님 지시에 따라 MSFT, AMZN 제거 / GPIQ, MGK 추가
const ASSET_TABLE_MAP = {
    'GPIQ': 'covered_call', 
    'MGK': 'tech_giants',
    'PLTR': 'growth', 'TSLA': 'growth',
    'IBIT': 'ibit_etha', 'ETHA': 'ibit_etha',
    'BMNR': 'bmnr'
};

function calculatePerAdjustment(currentPe, avgPe) {
    if (!currentPe || !avgPe) return { discountRate: 0, bonus: 0 };
    const discountRate = ((currentPe - avgPe) / avgPe) * 100;
    let bonus = 0;
    
    // 🚨 고평가 (Premium) 페널티 - 90% 한계선까지 완벽한 대칭 확장
    if (discountRate > 85) bonus = -55; // 85% 초과 (90% 초과 포함 상한 캡 고정)
    else if (discountRate > 80) bonus = -50;
    else if (discountRate > 75) bonus = -45;
    else if (discountRate > 70) bonus = -40;
    else if (discountRate > 65) bonus = -35;
    else if (discountRate > 55) bonus = -30;
    else if (discountRate > 45) bonus = -25;
    else if (discountRate > 35) bonus = -20;
    else if (discountRate > 25) bonus = -15;
    else if (discountRate > 15) bonus = -10;
    else if (discountRate > 5) bonus = -5;
    
    // 정상 궤도
    else if (discountRate >= -5) bonus = 0;
    
    // 저평가 (Discount) 보너스 - 90% 한계선까지 선형/정밀 구간 확장
    else if (discountRate >= -15) bonus = 5;
    else if (discountRate >= -25) bonus = 10;
    else if (discountRate >= -35) bonus = 15;
    else if (discountRate >= -45) bonus = 20;
    else if (discountRate >= -55) bonus = 25;
    else if (discountRate >= -65) bonus = 30; // 10% 단위 구간 끝
    else if (discountRate >= -70) bonus = 35; // 5% 단위 정밀 구간 시작
    else if (discountRate >= -75) bonus = 40;
    else if (discountRate >= -80) bonus = 45;
    else if (discountRate >= -85) bonus = 50;
    else if (discountRate >= -90) bonus = 55;
    else bonus = 55; // -90% 초과 극한 구간 상한 캡 고정
    
    return { discountRate: discountRate, bonus: bonus };
}

function getAllocationInfo(symbol, effectiveDd) {
    const tableName = ASSET_TABLE_MAP[symbol] || 'growth';
    const table = MDD_TABLES[tableName];
    let months = 0;
    let monthsStr = "일상 DCA";
    
    for (let i = 0; i < table.length; i++) {
        if (effectiveDd <= table[i].tier) {
            months = table[i].months;
            monthsStr = table[i].str;
            break;
        }
    }
    return { months, monthsStr };
}

function getOverride(symbol, field, fallback) {
    let overrides = JSON.parse(localStorage.getItem('portfolio_overrides') || '{}');
    if (overrides[symbol] && overrides[symbol][field] !== undefined) {
        return overrides[symbol][field];
    }
    return fallback;
}

function saveOverride(symbol, field, value) {
    let overrides = JSON.parse(localStorage.getItem('portfolio_overrides') || '{}');
    if (!overrides[symbol]) overrides[symbol] = {};
    
    // 🚨 빈칸 저장 방지 로직 (클로드 피드백 반영)
    if (field === 'start_date') {
        if (value && value.trim() !== '') {
            overrides[symbol][field] = value;
        } else {
            delete overrides[symbol][field];
        }
    } else {
        const parsed = parseFloat(value);
        if (isNaN(parsed)) {
            delete overrides[symbol][field];
        } else {
            overrides[symbol][field] = parsed;
        }
    }
    
    localStorage.setItem('portfolio_overrides', JSON.stringify(overrides));
}

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const USD_ORDER = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

let gAssetsRawData = {}; 

function generateParkingSparkline(data) {
    if (!data || !data.combined_hist || data.combined_hist.length === 0) return '';
    
    const width = 800; 
    const height = 120;
    const padding = 10;
    
    const allVals = [...data.combined_hist, ...data.sgov_hist, ...data.bil_hist];
    let min = Math.min(...allVals, 0);
    let max = Math.max(...allVals, 0);
    
    if (min === max) { min -= 1; max += 1; }
    
    const range = max - min;
    // 🚨 배열 길이 불일치 미검증 방어 코드 (클로드 피드백 반영)
    const len = Math.min(data.combined_hist.length, data.sgov_hist.length, data.bil_hist.length);
    const stepX = width / (len > 1 ? len - 1 : 1);
    
    const getY = (val) => padding + (height - 2 * padding) * (1 - (val - min) / range);
    const maxY = getY(max);
    
    let pathSgov = '', pathBil = '', pathComb = '';
    
    for (let i = 0; i < len; i++) {
        const x = i * stepX;
        const ys = getY(data.sgov_hist[i]);
        const yb = getY(data.bil_hist[i]);
        const yc = getY(data.combined_hist[i]);
        
        if (i === 0) {
            pathSgov += `M ${x} ${ys} `;
            pathBil += `M ${x} ${yb} `;
            pathComb += `M ${x} ${yc} `;
        } else {
            pathSgov += `L ${x} ${ys} `;
            pathBil += `L ${x} ${yb} `;
            pathComb += `L ${x} ${yc} `;
        }
    }
    
    return `
    <div class="bg-gray-800 rounded-xl p-5 shadow-lg border border-gray-700 mb-8">
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-black text-white tracking-tight">대기자금 레이더 (SGOV + BIL)</h2>
            <div class="flex gap-4 text-xs font-mono">
                <span class="flex items-center gap-1"><span class="w-3 h-0.5 bg-blue-400 inline-block"></span>SGOV</span>
                <span class="flex items-center gap-1"><span class="w-3 h-0.5 bg-gray-400 inline-block"></span>BIL</span>
                <span class="flex items-center gap-1"><span class="w-3 h-1 bg-white inline-block"></span>합산</span>
            </div>
        </div>
        <div class="text-xs text-gray-500 font-mono mb-2">최근 60거래일 자금 흐름 (Billion USD)</div>
        <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="overflow-visible mt-2">
            <line x1="0" y1="${maxY}" x2="${width}" y2="${maxY}" stroke="#4B5563" stroke-width="1" stroke-dasharray="2,2" vector-effect="non-scaling-stroke" />
            <path d="${pathSgov}" fill="none" stroke="#60A5FA" stroke-width="1" vector-effect="non-scaling-stroke" />
            <path d="${pathBil}" fill="none" stroke="#9CA3AF" stroke-width="1" vector-effect="non-scaling-stroke" />
            <path d="${pathComb}" fill="none" stroke="#FFFFFF" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
    </div>
    `;
}

async function init() {
    try {
        const dashboardRes = await fetch('dashboard_data.json').then(r => r.json());
        document.getElementById('last-updated').innerText = dashboardRes.last_updated;
        
        if (dashboardRes.parking_data) {
            const grid = document.getElementById('crypto-grid');
            let parkingPanel = document.getElementById('parking-panel');
            if (!parkingPanel) {
                parkingPanel = document.createElement('div');
                parkingPanel.id = 'parking-panel';
                grid.parentNode.insertBefore(parkingPanel, grid);
            }
            parkingPanel.innerHTML = generateParkingSparkline(dashboardRes.parking_data);
        }

        dashboardRes.assets.forEach(a => gAssetsRawData[a.symbol] = a);
        renderCards();
    } catch (error) {
        console.error("Initialization failed:", error);
        document.getElementById('crypto-grid').innerHTML = '<div class="text-red-500 font-black p-10">ERROR: 데이터 로딩 실패. dashboard_data.json을 확인하십시오.</div>';
    }
}

function renderCards() {
    const grid = document.getElementById('crypto-grid');
    grid.innerHTML = '';
    
    // 🚨 MSFT, AMZN 제거 및 GPIQ, MGK 추가
    const requiredTickers = ['GPIQ', 'MGK', 'PLTR', 'TSLA', 'IBIT', 'ETHA'];

    requiredTickers.forEach(symbol => {
        // 기존 gAssetsRawData에 데이터가 없으면 기본 구조 생성 (API가 업데이트 되기 전 에러 방지)
        const asset = gAssetsRawData[symbol] || {
            symbol: symbol,
            group: symbol === 'PLTR' || symbol === 'TSLA' ? 'B' : (symbol === 'IBIT' || symbol === 'ETHA' ? 'C' : 'A'),
            current_price: 0,
            auto_high_52w: 0
        };
        
        const initialBudget = getOverride(symbol, 'monthly_budget', asset.monthly_budget ?? 0);
        // 🚨 1월 24일부터 시작한걸로 고정
        const initialStart = getOverride(symbol, 'start_date', "2026-01-24"); 
        
        const initialExec = getOverride(symbol, 'executed_months', asset.config_exec ?? 0);
        const initialHigh = getOverride(symbol, 'high_52w', asset.config_high ?? 0);
        const initialPe = getOverride(symbol, 'avg_pe_3y', asset.config_pe ?? 0);
        
        const orderId = `order-${symbol}`;
        const discId = `disc-${symbol}`;
        const effId = `eff-${symbol}`;
        
        const card = document.createElement('div');
        card.className = 'bg-gray-800 rounded-xl p-5 shadow-lg border border-gray-700 flex flex-col h-full relative overflow-hidden';
        
        card.innerHTML = `
            <div class="flex justify-between items-start mb-6">
                <div>
                    <div class="flex items-center gap-2">
                        <h2 class="text-2xl font-black text-white tracking-tight">${symbol}</h2>
                        <span class="px-2 py-0.5 rounded text-xs font-bold bg-gray-700 text-gray-300 border border-gray-600">GROUP ${asset.group}</span>
                    </div>
                    <div class="text-gray-400 text-sm font-mono mt-1">현재가: ${USD.format(asset.current_price)}</div>
                </div>
                <div class="text-right flex flex-col items-end gap-2">
                    <span id="${discId}" class="text-xs font-mono px-2 py-1 rounded bg-gray-900 border border-gray-700">디스카운트: 연산중</span>
                    <span id="${effId}" class="text-2xl font-black tracking-tight text-white">연산중</span> <!-- 🚨 neutralize 클래스 삭제 반영 -->
                </div>
            </div>

            <div class="bg-gray-900 rounded-lg p-4 border border-gray-700 mb-6 space-y-3 font-mono text-sm">
                <div class="flex justify-between items-center">
                    <label class="text-gray-400">월 할당 예산 ($)</label>
                    <input type="number" step="10" value="${initialBudget}" id="budget-${symbol}"
                        class="control-input bg-gray-700 text-cyan-400 border border-gray-600 rounded px-3 py-1 text-right w-28 font-bold"
                        oninput="recalculateCard('${symbol}', 'monthly_budget', this.value)">
                </div>
                <div class="flex justify-between items-center">
                    <label class="text-gray-400">투자 시작일 (기준)</label>
                    <input type="date" value="${initialStart}" id="start-${symbol}"
                        class="control-input bg-gray-700 text-purple-400 border border-gray-600 rounded px-3 py-1 text-right w-36 font-bold"
                        oninput="recalculateCard('${symbol}', 'start_date', this.value)">
                </div>
                <div class="flex justify-between items-center border-b border-gray-700 pb-3 mb-3">
                    <label class="text-gray-400">기집행 달수 (개월)</label>
                    <input type="number" step="0.1" value="${initialExec}" id="exec-${symbol}"
                        class="control-input bg-gray-700 text-cyan-400 border border-gray-600 rounded px-3 py-1 text-right w-28 font-bold"
                        oninput="recalculateCard('${symbol}', 'executed_months', this.value)">
                </div>
                <div class="flex justify-between items-center">
                    <label class="text-gray-400">52주 고점 (0=자동)</label>
                    <input type="number" step="0.1" value="${initialHigh}" id="high-${symbol}"
                        class="control-input bg-gray-700 text-cyan-400 border border-gray-600 rounded px-3 py-1 text-right w-28 font-bold"
                        oninput="recalculateCard('${symbol}', 'high_52w', this.value)">
                </div>
                ${asset.group === 'A' ? `
                <div class="flex justify-between items-center">
                    <label class="text-gray-400">3년 평균 PER</label>
                    <input type="number" step="0.01" value="${initialPe}" id="pe-${symbol}"
                        class="control-input bg-gray-700 text-cyan-400 border border-gray-600 rounded px-3 py-1 text-right w-28 font-bold"
                        oninput="recalculateCard('${symbol}', 'avg_pe_3y', this.value)">
                </div>
                <div class="text-gray-600 text-xs text-right mt-1">야후 현재 PER (${asset.pe_type || 'N/A'}): ${asset.current_pe ? asset.current_pe.toFixed(2) : 'N/A'}</div>
                ` : ''}
            </div>

            <div id="${orderId}">
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-auto">
                ${renderPanel('일봉 (타이밍 조준)', asset.daily, '일')}
                ${renderPanel('주봉 (거시 확인)', asset.weekly, '주')}
            </div>
        `;
        
        grid.appendChild(card);
        recalculateCard(symbol);
    });
}

function recalculateCard(symbol, field, newValue) {
    let rawData = gAssetsRawData[symbol];
    if (!rawData) {
        // 데이터가 아직 로드되지 않았을 경우를 대비한 방어 코드
        rawData = {
            symbol: symbol,
            group: symbol === 'PLTR' || symbol === 'TSLA' ? 'B' : (symbol === 'IBIT' || symbol === 'ETHA' ? 'C' : 'A'),
            current_price: 0,
            auto_high_52w: 0
        };
    }
    
    if (field && newValue !== undefined) {
        saveOverride(symbol, field, newValue);
    }
    
    const budgetEl = document.getElementById(`budget-${symbol}`);
    const startEl = document.getElementById(`start-${symbol}`); 
    const execEl = document.getElementById(`exec-${symbol}`);
    const highEl = document.getElementById(`high-${symbol}`);
    const peEl = document.getElementById(`pe-${symbol}`);
    
    const monthlyBudget = budgetEl ? parseFloat(budgetEl.value) || 0 : 0;
    // 🚨 1월 24일부터 시작으로 고정
    const startDateVal = startEl ? startEl.value : "2026-01-24"; 
    const executedMonths = execEl ? parseFloat(execEl.value) || 0 : 0;
    const manualHigh = highEl ? parseFloat(highEl.value) || 0 : 0;
    const avgPe = peEl ? parseFloat(peEl.value) || 0 : 0;
    
    const high52w = manualHigh > 0 ? manualHigh : rawData.auto_high_52w;
    const currPrice = rawData.current_price;
    const group = rawData.group;
    
    const effEl = document.getElementById(`eff-${symbol}`);
    const discEl = document.getElementById(`disc-${symbol}`);
    const orderEl = document.getElementById(`order-${symbol}`);
    
    // 고점이 0인 경우를 대비한 방어 코드 추가
    const rawMdd = high52w > 0 ? ((currPrice - high52w) / high52w) * 100 : 0;
    let effectiveDd = rawMdd;
    let bonus = 0;
    
    if (group === 'A' && avgPe > 0 && rawData.current_pe) {
        const adj = calculatePerAdjustment(rawData.current_pe, avgPe);
        bonus = adj.bonus;
        effectiveDd = rawMdd - bonus;
        
        const discColor = adj.discountRate <= 0 ? 'up font-bold text-green-400' : 'down font-bold text-red-400';
        discEl.className = `text-xs font-mono px-2 py-1 rounded bg-gray-900 border border-gray-700`;
        discEl.innerHTML = `PER 할인: <span class="${discColor}">${adj.discountRate.toFixed(1)}%</span> (보정: ${bonus > 0 ? '+'+bonus : bonus})`;
    } else {
        discEl.className = 'hidden';
    }
    
    const ddColor = effectiveDd < -30 ? 'text-red-400' : (effectiveDd < -15 ? 'text-gray-400' : 'text-green-400');
    effEl.innerText = `${effectiveDd.toFixed(1)}%`;
    effEl.className = `text-2xl font-black tracking-tight ${ddColor}`;
    
    const alloc = getAllocationInfo(symbol, effectiveDd);
    const targetMonths = alloc.months;
    
    let elapsedMonths = 1;
    if (startDateVal) {
        const parts = startDateVal.split('-').map(Number);
        if(parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            const sYear = parts[0];
            const sMonth = parts[1] - 1; // JS 0-11
            const sDate = parts.length > 2 ? parts[2] : 1;
            
            const now = new Date();
            elapsedMonths = (now.getFullYear() - sYear) * 12 + (now.getMonth() - sMonth);
            
            if (now.getDate() >= sDate) {
                elapsedMonths += 1;
            }
        }
    }
    elapsedMonths = Math.max(elapsedMonths, 1);
    
    if (elapsedMonths < 1) {
        orderEl.className = 'bg-gray-900 border border-gray-700/50 rounded-lg p-4 mb-6 flex items-center justify-between text-gray-500';
        orderEl.innerHTML = `
            <div>
                <div class="text-xs text-gray-500 font-mono">최종 주문</div>
                <div class="text-2xl font-black tracking-tighter">$0</div>
            </div>
            <div class="text-right">
                <div class="text-xs text-gray-500 font-mono">시작일: ${startDateVal}</div>
                <span class="px-2 py-0.5 rounded text-xs font-bold bg-gray-800 border border-gray-600">투자기간 미도래 (대기)</span>
            </div>
        `;
        return; 
    }
    
    const aheadMonths = executedMonths - elapsedMonths;
    const MAX_MONTHS = 36.0;
    let finalOrder = 0;
    let orderType = '';
    let buyMonthsStr = '';

    if (targetMonths > executedMonths) {
        const sniperMonths = targetMonths - executedMonths;
        finalOrder = Math.round(sniperMonths * monthlyBudget); 
        orderType = 'sniper';
        buyMonthsStr = `+ ${sniperMonths.toFixed(1)}개월 치 땡겨사기`;
    } else if (executedMonths >= MAX_MONTHS) {
        finalOrder = 0;
        orderType = 'maxed';
    } else {
        const remMonths = Math.max(MAX_MONTHS - elapsedMonths, 0.0001);
        const remBullets = Math.max(MAX_MONTHS - executedMonths, 0);
        const valve = Math.min(1.0, remBullets / remMonths);
        finalOrder = Math.round(valve * monthlyBudget); 
        orderType = 'dynamic';
        buyMonthsStr = `+ ${(valve * 100).toFixed(1)}% 밸브 개방`;
    }
    
    if (orderType === 'sniper') {
        orderEl.className = 'bg-gray-900 border border-purple-700/50 rounded-lg p-4 mb-6 flex items-center justify-between text-purple-400';
        orderEl.innerHTML = `
            <div>
                <div class="text-xs text-gray-500 font-mono">기회 포착 (MDD 타격)</div>
                <div class="text-2xl font-black tracking-tighter">${USD_ORDER.format(finalOrder)}</div>
            </div>
            <div class="text-right">
                <div class="text-xs text-gray-500 font-mono">MDD 목표: ${targetMonths}M | 기집행: ${executedMonths.toFixed(1)}M</div>
                <span class="px-2 py-0.5 rounded text-xs font-bold bg-purple-900 border border-purple-700">${buyMonthsStr}</span>
            </div>
        `;
    } else if (orderType === 'dynamic') {
        orderEl.className = 'bg-gray-900 border border-blue-700/50 rounded-lg p-4 mb-6 flex items-center justify-between text-blue-400';
        orderEl.innerHTML = `
            <div>
                <div class="text-xs text-gray-500 font-mono">일상 DCA (정상 궤도)</div>
                <div class="text-2xl font-black tracking-tighter">${USD_ORDER.format(finalOrder)}</div>
            </div>
            <div class="text-right">
                <div class="text-xs text-gray-500 font-mono">경과: ${elapsedMonths}M | 기집행: ${executedMonths.toFixed(1)}M</div>
                <span class="px-2 py-0.5 rounded text-xs font-bold bg-blue-900 border border-blue-700">${buyMonthsStr}</span>
            </div>
        `;
    } else {
        const aheadStr = aheadMonths > 0 ? `${aheadMonths.toFixed(1)}개월 선취매 완료` : `총알 소진 완료`;
        orderEl.className = 'bg-gray-900 border border-gray-700/50 rounded-lg p-4 mb-6 flex items-center justify-between text-gray-400';
        orderEl.innerHTML = `
            <div>
                <div class="text-xs text-gray-500 font-mono">최종 주문</div>
                <div class="text-2xl font-black tracking-tighter">$0</div>
            </div>
            <div class="text-right">
                <div class="text-xs text-gray-500 font-mono">경과: ${elapsedMonths}M | 기집행: ${executedMonths.toFixed(1)}M</div>
                <span class="px-2 py-0.5 rounded text-xs font-bold bg-gray-800 border border-gray-600">${aheadStr} (휴식)</span>
            </div>
        `;
    }
}

function generateSparkline(roc2_hist, roc3_hist) {
    if (!roc2_hist || !roc3_hist || roc2_hist.length === 0) return '';
    
    const width = 300; 
    const height = 40;
    const padding = 5;
    
    const allVals = [...roc2_hist, ...roc3_hist];
    let min = Math.min(...allVals, 0);
    let max = Math.max(...allVals, 0);
    
    if (min === max) { min -= 1; max += 1; }
    
    const range = max - min;
    const len = roc2_hist.length;
    const stepX = width / (len > 1 ? len - 1 : 1);
    
    const getY = (val) => padding + (height - 2 * padding) * (1 - (val - min) / range);
    const zeroY = getY(0);
    
    let path2 = '';
    let path3 = '';
    
    for (let i = 0; i < len; i++) {
        const x = i * stepX;
        const y2 = getY(roc2_hist[i]);
        const y3 = getY(roc3_hist[i]);
        if (i === 0) {
            path2 += `M ${x} ${y2} `;
            path3 += `M ${x} ${y3} `;
        } else {
            path2 += `L ${x} ${y2} `;
            path3 += `L ${x} ${y3} `;
        }
    }
    
    return `
    <div class="mt-3 border-t border-gray-700 pt-3">
        <div class="flex justify-between items-center mb-1 text-[10px] text-gray-400 font-mono">
            <span>ROC 듀얼 트래킹</span>
            <div class="flex gap-2">
                <span class="flex items-center gap-1"><span class="w-2 h-0.5 bg-yellow-400 inline-block"></span>ROC2(가속)</span>
                <span class="flex items-center gap-1"><span class="w-2 h-px bg-red-400 inline-block"></span>ROC3(가가속)</span>
            </div>
        </div>
        <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="overflow-visible mt-2">
            <line x1="0" y1="${zeroY}" x2="${width}" y2="${zeroY}" stroke="#4B5563" stroke-width="1" stroke-dasharray="2,2" vector-effect="non-scaling-stroke" />
            <path d="${path3}" fill="none" stroke="#F87171" stroke-width="1" vector-effect="non-scaling-stroke" />
            <path d="${path2}" fill="none" stroke="#FACC15" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
    </div>
    `;
}

function renderPanel(title, data, unitName) {
    if (!data) return '<div class="text-gray-600 text-xs">데이터 부족</div>';
    return `
        <div class="bg-gray-900 rounded-lg p-4 border border-gray-700 flex flex-col justify-between">
            <div>
                <h3 class="text-gray-400 text-xs font-mono mb-3 tracking-wider">${title} <span class="text-gray-600">(${data.date})</span></h3>
                <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm font-mono">
                    <div class="flex justify-between">
                        <span class="text-gray-500">RSI</span>
                        <span class="font-bold ${getMetricColor('RSI', data.rsi)}">${data.rsi.toFixed(1)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-500">Vol폭발</span>
                        <span class="font-bold ${getMetricColor('Spike', data.vol_spike)}">${data.vol_spike.toFixed(1)}x</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-500">ROC속도</span>
                        <span class="font-bold ${data.roc1 >= 0 ? 'text-green-400' : 'text-red-400'}">${data.roc1.toFixed(1)}%</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-500">ROC가속</span>
                        <span class="font-bold ${data.roc2 >= 0 ? 'text-green-400' : 'text-red-400'}">${data.roc2.toFixed(1)}%</span>
                    </div>
                    <div class="flex justify-between col-span-2 border-t border-gray-700 pt-2 mt-1">
                        <span class="text-gray-500">ROC가가속(0수렴)</span>
                        <span class="font-bold ${data.roc3 >= 0 ? 'text-green-400' : 'text-red-400'}">${data.roc3 > 0 ? '+' : ''}${data.roc3.toFixed(1)}%</span>
                    </div>
                    <div class="flex justify-between col-span-2">
                        <span class="text-gray-500">양전환Streak</span>
                        <span class="font-bold ${getMetricColor('Streak', data.streak)}">${data.streak}${unitName} 연속</span>
                    </div>
                </div>
            </div>
            ${generateSparkline(data.roc2_hist, data.roc3_hist)}
        </div>
    `;
}

function getMetricColor(type, value) {
    if (type === 'RSI') {
        if (value <= 35) return 'text-green-400 font-black'; 
        if (value >= 65) return 'text-red-400 font-black';   
    }
    if (type === 'Spike') {
        if (value >= 1.5) return 'text-yellow-400 font-black'; 
    }
    if (type === 'Streak') {
        if (value >= 3) return 'text-green-400 font-black'; 
    }
    return 'text-gray-300';
}

document.addEventListener('DOMContentLoaded', init);