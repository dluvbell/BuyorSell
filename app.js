function getMetricColor(val, type, streak) {
    if (type === 'rsi') {
        if (val <= 40) return 'text-rose-400 font-bold'; 
        if (val >= 70) return 'text-emerald-400 font-bold'; 
        return 'text-gray-300';
    }
    if (type === 'vol') {
        if (val >= 2.0) return 'text-yellow-400 font-bold'; 
        return 'text-gray-300';
    }
    if (type === 'roc1') {
        if (val < -15) return 'text-rose-400'; 
        return 'text-gray-300';
    }
    if (type === 'roc2') {
        if (val > 0) return streak >= 3 ? 'text-cyan-400 font-bold' : 'text-cyan-300'; 
        if (val < 0) return 'text-rose-500'; 
        return 'text-gray-300';
    }
    return 'text-gray-300';
}

function renderPanel(title, data, unitName) {
    return `
        <div class="bg-gray-900/80 rounded-lg p-4 border border-gray-700/50 flex flex-col">
            <p class="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3 text-center border-b border-gray-700 pb-2">${title}</p>
            <div class="flex justify-between py-1.5 border-b border-gray-800">
                <span class="text-gray-500 text-[11px] uppercase tracking-wide">RSI (공포)</span>
                <span class="font-mono text-sm ${getMetricColor(data.rsi, 'rsi')}">${data.rsi.toFixed(1)}</span>
            </div>
            <div class="flex justify-between py-1.5 border-b border-gray-800">
                <span class="text-gray-500 text-[11px] uppercase tracking-wide">Volume (평균대비)</span>
                <span class="font-mono text-sm ${getMetricColor(data.vol_spike, 'vol')}">${data.vol_spike.toFixed(2)}x</span>
            </div>
            <div class="flex justify-between py-1.5 border-b border-gray-800">
                <span class="text-gray-500 text-[11px] uppercase tracking-wide">ROC1 (속도)</span>
                <span class="font-mono text-sm ${getMetricColor(data.roc1, 'roc1')}">${data.roc1 > 0 ? '+' : ''}${data.roc1.toFixed(2)}%</span>
            </div>
            <div class="flex justify-between py-1.5 pt-2 mt-auto">
                <div class="flex flex-col">
                    <span class="text-gray-400 text-xs font-bold uppercase tracking-wide">ROC2 (가속도)</span>
                    <span class="text-gray-600 text-[10px]">양전환 ${data.streak}${unitName}째</span>
                </div>
                <span class="font-mono text-sm ${getMetricColor(data.roc2, 'roc2', data.streak)}">${data.roc2 > 0 ? '+' : ''}${data.roc2.toFixed(2)}%p</span>
            </div>
        </div>
    `;
}

// effectiveMdd 파라미터 추가 및 최종 MDD 수치 출력 구문 적용 완료
function renderPerAdjustment(perData, effectiveMdd) {
    if (!perData) return ''; 
    
    let evalText = "적정 가치";
    let bonusText = `보정 없음 (0%)`;
    let colorClass = "text-gray-400";
    
    if (perData.bonus === -15) { evalText = "거품 심화"; bonusText = "패널티 -15%"; colorClass = "text-rose-600"; }
    else if (perData.bonus === -10) { evalText = "거품"; bonusText = "패널티 -10%"; colorClass = "text-rose-500"; }
    else if (perData.bonus === -5) { evalText = "고평가"; bonusText = "패널티 -5%"; colorClass = "text-rose-400"; }
    else if (perData.bonus === 5) { evalText = "저평가"; bonusText = "보너스 +5%"; colorClass = "text-emerald-400"; }
    else if (perData.bonus === 10) { evalText = "저평가 심화"; bonusText = "보너스 +10%"; colorClass = "text-emerald-500"; }
    else if (perData.bonus === 15) { evalText = "역사적 저평가"; bonusText = "보너스 +15%"; colorClass = "text-emerald-600"; }

    return `
        <div class="bg-gray-800/50 rounded-lg p-3 border border-gray-700 mb-4 mt-2">
            <div class="flex justify-between items-center mb-2 border-b border-gray-700 pb-1">
                <span class="text-gray-400 text-[10px] uppercase font-bold">PER 가치 평가 레이더</span>
                <span class="${colorClass} text-xs font-bold">${evalText} (${perData.discount_rate > 0 ? '+' : ''}${perData.discount_rate.toFixed(1)}%)</span>
            </div>
            <div class="flex justify-between text-xs font-mono text-gray-400">
                <span>현재 PER: ${perData.current_pe}</span>
                <span>3년 평균: ${perData.avg_pe}</span>
            </div>
            <div class="flex justify-between text-xs font-mono mt-1">
                <span class="text-gray-500">실제 MDD: ${perData.raw_mdd}%</span>
                <span class="${colorClass} font-bold">${bonusText} 적용 ➡️ 최종 MDD: ${effectiveMdd.toFixed(1)}%</span>
            </div>
        </div>
    `;
}

async function renderDashboard() {
    try {
        const response = await fetch(`dashboard_data.json?t=${new Date().getTime()}`);
        if (!response.ok) throw new Error('Data not found');
        const data = await response.json();

        document.getElementById('last-updated').textContent = data.last_updated;
        const grid = document.getElementById('dashboard-grid');
        const spinner = document.getElementById('loading-spinner');
        
        spinner.classList.add('hidden');
        grid.classList.remove('hidden');
        grid.innerHTML = '';

        data.assets.forEach(asset => {
            const card = document.createElement('div');
            card.className = "bg-gray-800 rounded-xl p-5 shadow-lg border border-gray-700 flex flex-col hover:border-blue-500 transition-colors duration-300";
            
            const isLockdown = asset.allocation_fund === '휴식 (Lockdown)';
            const mddColor = !isLockdown ? 'text-green-400' : 'text-rose-400';
            const mddLabel = !isLockdown ? `${asset.target_tier}% 티어 도달!` : '락다운 (휴식)';

            card.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h2 class="text-2xl font-bold text-white tracking-tight">${asset.symbol}</h2>
                        <span class="text-xs text-gray-400">${asset.group}</span>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-mono text-white">$${asset.current_price.toFixed(2)}</div>
                        <div class="text-xs ${mddColor} font-mono">보정 MDD: ${asset.mdd.toFixed(1)}%</div>
                    </div>
                </div>

                ${renderPerAdjustment(asset.per_data, asset.mdd)}

                <div class="bg-gray-900 rounded-lg p-3 border border-gray-700 mb-4 flex justify-between items-center">
                    <div class="flex flex-col">
                        <span class="text-gray-500 text-[10px] uppercase tracking-wider">메인 트리거</span>
                        <span class="text-gray-300 text-xs font-bold">${mddLabel}</span>
                    </div>
                    <div class="text-right flex flex-col">
                        <span class="text-gray-500 text-[10px] uppercase tracking-wider">투입 자금 (예산)</span>
                        <span class="${mddColor} text-lg font-extrabold tracking-tight">${asset.allocation_fund}</span>
                    </div>
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-auto">
                    ${renderPanel('일봉 (타이밍 조준)', asset.daily, '일')}
                    ${renderPanel('주봉 (거시 확인)', asset.weekly, '주')}
                </div>
            `;
            grid.appendChild(card);
        });

    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('loading-spinner').innerHTML = '<p class="text-rose-400">데이터를 불러오지 못했습니다.</p>';
    }
}

document.addEventListener('DOMContentLoaded', renderDashboard);