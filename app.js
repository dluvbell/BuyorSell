function getStatusBadgeClass(color) {
    switch(color) {
        case 'green': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 animate-pulse';
        case 'yellow': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50';
        default: return 'bg-gray-700/50 text-gray-400 border border-gray-600/50';
    }
}

function getPanelBorderClass(color) {
    if (color === 'green') return 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
    if (color === 'yellow') return 'border-yellow-500/50';
    return 'border-gray-700/50';
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
            
            card.innerHTML = `
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <h2 class="text-2xl font-bold text-white">${asset.symbol}</h2>
                        <span class="text-xs text-gray-400">${asset.group}</span>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-mono text-white">$${asset.current_price.toFixed(2)}</div>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-auto">
                    <div class="bg-gray-900/80 rounded-lg p-4 border flex flex-col items-center justify-center text-center ${getPanelBorderClass(asset.daily.color)}">
                        <p class="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">일봉 (발목 타점)</p>
                        <div class="inline-block px-3 py-1.5 rounded-full text-xs font-bold tracking-wide mb-3 ${getStatusBadgeClass(asset.daily.color)}">
                            ${asset.daily.status}
                        </div>
                        <p class="text-gray-500 font-mono text-xs">RSI: ${asset.daily.rsi.toFixed(1)}</p>
                    </div>

                    <div class="bg-gray-900/80 rounded-lg p-4 border flex flex-col items-center justify-center text-center ${getPanelBorderClass(asset.weekly.color)}">
                        <p class="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">주봉 (무릎 타점)</p>
                        <div class="inline-block px-3 py-1.5 rounded-full text-xs font-bold tracking-wide mb-3 ${getStatusBadgeClass(asset.weekly.color)}">
                            ${asset.weekly.status}
                        </div>
                        <p class="text-gray-500 font-mono text-xs">RSI: ${asset.weekly.rsi.toFixed(1)}</p>
                    </div>
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
