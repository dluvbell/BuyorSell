function getStatusBadgeClass(color) {
    switch(color) {
        case 'green': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50';
        case 'red': return 'bg-rose-500/20 text-rose-400 border border-rose-500/50';
        case 'yellow': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50';
        case 'orange': return 'bg-orange-500/20 text-orange-400 border border-orange-500/50';
        default: return 'bg-gray-700 text-gray-300 border border-gray-600';
    }
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
            const savedAvgCost = localStorage.getItem(`avg_cost_${asset.symbol}`) || '';
            
            let sarStatus = asset.sar_below_candle ? '상승 중 (캔들 아래)' : '하락 중 (캔들 위)';
            if (asset.sar_flip_up) sarStatus = '🔥 이번 주 상승 전환!';
            if (asset.sar_flip_down) sarStatus = '⚠️ 이번 주 하락 전환!';

            const card = document.createElement('div');
            card.className = "bg-gray-800 rounded-xl p-5 shadow-lg border border-gray-700 flex flex-col";
            
            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h2 class="text-2xl font-bold text-white">${asset.symbol}</h2>
                        <span class="text-xs text-gray-400">${asset.group} | 목표비중 ${asset.weight}%</span>
                    </div>
                    <div class="text-right">
                        <div class="text-xl font-mono text-white">$${asset.price.toFixed(2)}</div>
                    </div>
                </div>

                <div class="mb-5 inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeClass(asset.color)}">
                    ${asset.status}
                </div>

                <div class="grid grid-cols-2 gap-4 mb-6 text-sm">
                    <div class="bg-gray-900 rounded p-3">
                        <p class="text-gray-500 mb-1">RSI (14)</p>
                        <p class="font-mono text-white">${asset.rsi.toFixed(2)}</p>
                    </div>
                    <div class="bg-gray-900 rounded p-3">
                        <p class="text-gray-500 mb-1">MACD / SAR</p>
                        <p class="font-mono ${asset.macd_hist_rising ? 'text-emerald-400' : 'text-rose-400'} text-xs">
                            ${asset.macd_hist_rising ? 'MACD: 상승 2주' : 'MACD: 하락/횡보'}<br>
                            SAR: ${sarStatus}
                        </p>
                    </div>
                </div>

                <div class="mt-auto border-t border-gray-700 pt-4">
                    <label class="block text-xs text-gray-400 mb-2">내 평단가 (Target Stop: -${asset.stop_loss_pct}%)</label>
                    <div class="flex space-x-2">
                        <input type="number" id="input_${asset.symbol}" value="${savedAvgCost}" placeholder="0.00" class="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500">
                        <button onclick="calculateStopLoss('${asset.symbol}', ${asset.price}, ${asset.stop_loss_pct})" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-sm transition whitespace-nowrap">계산</button>
                    </div>
                    <div id="result_${asset.symbol}" class="mt-3 text-sm flex flex-col gap-1 min-h-[40px]"></div>
                </div>
            `;
            grid.appendChild(card);
            
            if(savedAvgCost) calculateStopLoss(asset.symbol, asset.price, asset.stop_loss_pct);
        });

    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('loading-spinner').innerHTML = '<p class="text-rose-400">데이터를 불러오지 못했습니다. 파이썬 스크립트 실행 여부를 확인하세요.</p>';
    }
}

window.calculateStopLoss = function(symbol, currentPrice, stopLossPct) {
    const inputStr = document.getElementById(`input_${symbol}`).value;
    const avgCost = parseFloat(inputStr);
    const resultDiv = document.getElementById(`result_${symbol}`);
    
    if (isNaN(avgCost) || avgCost <= 0) {
        resultDiv.innerHTML = "";
        localStorage.removeItem(`avg_cost_${symbol}`);
        return;
    }

    localStorage.setItem(`avg_cost_${symbol}`, avgCost);

    const returnPct = ((currentPrice - avgCost) / avgCost) * 100;
    const stopPrice = (avgCost * (1 - stopLossPct / 100)).toFixed(2);
    
    let statusHtml = '';
    if (returnPct <= -stopLossPct) {
        statusHtml = `<span class="text-rose-500 font-bold animate-pulse">🚨 하드 스톱 도달! (${returnPct.toFixed(2)}%)</span>`;
    } else if (returnPct < 0) {
        statusHtml = `<span class="text-yellow-400">현재 수익률: ${returnPct.toFixed(2)}%</span>`;
    } else {
        statusHtml = `<span class="text-emerald-400">현재 수익률: +${returnPct.toFixed(2)}%</span>`;
    }

    resultDiv.innerHTML = `
        ${statusHtml}
        <span class="text-gray-400 font-mono text-xs">안전 이탈가(손절라인): $${stopPrice}</span>
    `;
}

document.addEventListener('DOMContentLoaded', renderDashboard);