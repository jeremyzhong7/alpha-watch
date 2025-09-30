
function humanVol(v){
  v = Number(v)||0;
  const abs = Math.abs(v);
  const fmt = (n)=> n.toFixed(3).replace(/\.?0+$/,'');
  if (abs >= 1e12) return fmt(v/1e12) + 'T';
  if (abs >= 1e9)  return fmt(v/1e9 ) + 'B';
  if (abs >= 1e6)  return fmt(v/1e6 ) + 'M';
  if (abs >= 1e3)  return fmt(v/1e3 ) + 'K';
  return fmt(v);
}
function pct(v){ return ((Number(v)||0)*100).toFixed(3).replace(/\.?0+$/,'') + '%'; }
function labelClass(s){ return s==='稳定' ? 'ok' : (s==='一般' ? 'warn' : 'bad'); }

function saveTheme(theme){ try{ localStorage.setItem('alpha_theme', theme); }catch(e){} }
function loadTheme(){ try{ return localStorage.getItem('alpha_theme') || 'dark'; }catch(e){ return 'dark'; } }
function setTheme(theme){ document.body.setAttribute('data-theme', theme); saveTheme(theme); }

let TICK_MS = 60_000; // 默认 60s 刷新一次（可改）
let timer = null;
let nextAt = 0;

function scheduleTick(){
  clearTimeout(timer);
  nextAt = Date.now() + TICK_MS;
  updateNextTick();
  timer = setTimeout(tick, TICK_MS);
}
function updateNextTick(){
  const el = document.getElementById('nextTick');
  if (!el) return;
  const remain = Math.max(0, nextAt - Date.now());
  const s = Math.ceil(remain/1000);
  el.textContent = '自动刷新倒计时：' + s + 's';
}
setInterval(updateNextTick, 1000);

async function tick(force){
  // 如果页面不可见，延后到可见时再刷新，避免浪费请求
  if (!force && document.hidden){ scheduleTick(); return; }
  await loadData();
  scheduleTick();
}

async function loadData(){
  const elUpdated = document.getElementById('updatedAt');
  try{
    const r = await fetch('./data.json?v=' + Date.now(), {cache:'no-store'});
    if (!r.ok) throw new Error('data.json fetch failed: ' + r.status);
    const j = await r.json();
    elUpdated.textContent = '上次更新：' + new Date(j.updatedAt).toLocaleString();

    const rows = (j.rows || []).slice().sort((a,b)=> (a.volatility5m||0)-(b.volatility5m||0));
    const top10 = rows.slice(0,10);

    renderTop10(top10);
  }catch(e){
    console.error(e);
    elUpdated.textContent = '加载失败（可能是缓存或网络问题）。';
    renderTop10([]);
  }
}

function renderTop10(list){
  const el = document.getElementById('top10');
  if (!list || !list.length){
    el.innerHTML = '<div class="small">暂无数据</div>';
    return;
  }
  const html = [
    '<table>',
      '<thead>',
        '<tr>',
          '<th>代号</th>',
          '<th>链</th>',
          '<th>4×</th>',
          '<th>5m 涨跌</th>',
          '<th>5m 波动率</th>',
          '<th>成交额(24h)</th>',
        '</tr>',
      '</thead>',
      '<tbody>',
      ...list.map(x => {
        const stability = x.stability || '-';
        const chain = x.chainId ? '<span class="badge chain">' + x.chainId + '</span>' : '-';
        const fourx = x.fourX === true ? '<span class="ok-icon">✔</span>' : '';
        return [
          '<tr>',
            '<td><span class="tag">', (x.shortSymbol || '-'), '</span></td>',
            '<td>', chain, '</td>',
            '<td>', fourx, '</td>',
            '<td>', pct(x.change5m), '</td>',
            '<td><span class="badge ', labelClass(stability), '">', stability, '</span> ', pct(x.volatility5m), '</td>',
            '<td>', humanVol(x.quoteVolume24h), '</td>',
          '</tr>'
        ].join('');
      }),
      '</tbody>',
    '</table>'
  ].join('');
  el.innerHTML = html;
}

function initThemeAndButtons(){
  setTheme(loadTheme());
  document.getElementById('themeBtn').addEventListener('click', function(){
    const next = (document.body.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
    setTheme(next);
  });
  document.getElementById('refreshBtn').addEventListener('click', function(){
    tick(true);
  });
}

(function main(){
  // 支持通过 URL hash 设置刷新间隔（秒），例如 #refresh=30
  const m = (location.hash||'').match(/refresh=(\\d+)/i);
  if (m) {
    TICK_MS = Math.max(5, parseInt(m[1],10)) * 1000;
  }
  initThemeAndButtons();
  loadData().then(scheduleTick);
  document.addEventListener('visibilitychange', function(){
    if (!document.hidden){
      // 页面回到可见时立刻刷新一次
      tick(true);
    }
  });
})();
