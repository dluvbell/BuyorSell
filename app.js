function getStatusBadgeClass(color) {
    switch(color) {
        case 'green': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 animate-pulse';
        case 'yellow': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50';
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
            let sarStatus = asset.sar_below_candle ? '상승 추세' : '하락 (MDD 진행 중)';
            if (asset.sar_flip_up) sarStatus = '🔥 바닥 탈출 (상승 전환)';

            const card = document.createElement('div');
            card.className = "bg-gray-800 rounded-xl p-5 shadow-lg border border-gray-700 flex flex-col hover:border-blue-500 transition-colors duration-300";
            
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

                <div class="mb-5 inline-block px-4 py-2 rounded-full text-sm font-bold tracking-wide ${getStatusBadgeClass(asset.color)}">
                    ${asset.status}
                </div>

                <div class="grid grid-cols-2 gap-4 text-sm mt-auto">
                    <div class="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
                        <p class="text-gray-500 mb-1 text-xs uppercase tracking-wider">RSI (14주)</p>
                        <p class="font-mono text-white text-lg">${asset.rsi.toFixed(2)}</p>
                    </div>
                    <div class="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
                        <p class="text-gray-500 mb-1 text-xs uppercase tracking-wider">Turnaround</p>
                        <p class="font-mono ${asset.macd_hist_rising ? 'text-emerald-400' : 'text-gray-400'} text-xs leading-relaxed">
                            ${asset.macd_hist_rising ? 'MACD: 상승 반전' : 'MACD: 관망'}<br>
                            SAR: ${sarStatus}
                        </p>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });

    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('loading-spinner').innerHTML = '<p class="text-rose-400">데이터를 불러오지 못했습니다. 파이썬 스크립트 실행 여부를 확인하세요.</p>';
    }
}

document.addEventListener('DOMContentLoaded', renderDashboard);
