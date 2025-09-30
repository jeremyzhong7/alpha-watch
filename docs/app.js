
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

let RAW_ROWS = [];
let CURRENT_ROWS = [];

function applySort(rows, key){
  const arr = rows.slice();
  switch(key){
    case 'vol5-asc':  arr.sort((a,b)=>(a.volatility5m||0)-(b.volatility5m||0)); break;
    case 'vol5-desc': arr.sort((a,b)=>(b.volatility5m||0)-(a.volatility5m||0)); break;
    case 'chg5-asc':  arr.sort((a,b)=>(a.change5m||0)-(b.change5m||0)); break;
    case 'chg5-desc': arr.sort((a,b)=>(b.change5m||0)-(a.change5m||0)); break;
    case 'vol24-asc': arr.sort((a,b)=>(a.quoteVolume24h||0)-(b.quoteVolume24h||0)); break;
    case 'vol24-desc':default: arr.sort((a,b)=>(b.quoteVolume24h||0)-(a.quoteVolume24h||0)); break;
  }
  return arr;
}

function saveTheme(theme){
  try{ localStorage.setItem('alpha_theme', theme); }catch(e){}
}
function loadTheme(){
  try{ return localStorage.getItem('alpha_theme') || 'dark'; }catch(e){ return 'dark'; }
}
function setTheme(theme){
  document.body.setAttribute('data-theme', theme);
  saveTheme(theme);
}

async function load(){
  // Theme init
  setTheme(loadTheme());
  document.getElementById('themeBtn').addEventListener('click', function(){
    const next = (document.body.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
    setTheme(next);
  });

  const elUpdated = document.getElementById('updatedAt');
  const sorter = document.getElementById('sorter');
  const search = document.getElementById('search');

  try{
    const r = await fetch('./data.json?v=' + Date.now(), {cache:'no-store'});
    if (!r.ok) throw new Error('data.json fetch failed: ' + r.status);
    const j = await r.json();
    elUpdated.textContent = '上次更新：' + new Date(j.updatedAt).toLocaleString();

    RAW_ROWS = j.rows || [];
    CURRENT_ROWS = applySort(RAW_ROWS, sorter.value);

    // Top10 默认按 5m 波动率升序
    const top10 = RAW_ROWS.slice().sort((a,b)=>(a.volatility5m||0)-(b.volatility5m||0)).slice(0,10);
    renderTable('top10', top10);
    renderTable('table', CURRENT_ROWS);

    sorter.addEventListener('change', function(){
      CURRENT_ROWS = applySort(filteredRows(search.value), sorter.value);
      renderTable('table', CURRENT_ROWS);
    });

    search.addEventListener('input', function(e){
      CURRENT_ROWS = applySort(filteredRows(e.target.value), sorter.value);
      renderTable('table', CURRENT_ROWS);
    });

  }catch(e){
    console.error(e);
    elUpdated.textContent = '加载失败（可能是 404 或缓存未更新）。请在 Actions 里确认已生成 docs/data.json。';
    renderTable('top10', []);
    renderTable('table', []);
  }

  function filteredRows(q){
    q = (q||'').trim().toLowerCase();
    if (!q) return RAW_ROWS.slice();
    return RAW_ROWS.filter(x => (x.shortSymbol||'').toLowerCase().indexOf(q) >= 0);
  }

  function renderTable(targetId, list){
    const el = document.getElementById(targetId);
    if (!list || !list.length){
      el.innerHTML = '<div class="small">暂无数据</div>';
      return;
    }
    let html = '';
    html += '<table>';
    html +=   '<thead>';
    html +=     '<tr>';
    html +=       '<th>代号</th>';
    html +=       '<th>链</th>';
    html +=       '<th>4×</th>';
    html +=       '<th>5m 涨跌</th>';
    html +=       '<th>5m 波动率</th>';
    html +=       '<th>成交额(24h)</th>';
    html +=     '</tr>';
    html +=   '</thead>';
    html +=   '<tbody>';

    for (let i=0;i<list.length;i++){
      const x = list[i];
      html += '<tr>';
      html +=   '<td><span class="tag">' + (x.shortSymbol || '-') + '</span></td>';
      html +=   '<td>' + (x.chainId ? ('<span class="badge chain">' + x.chainId + '</span>') : '-') + '</td>';
      html +=   '<td>' + (x.fourX ? '<span class="ok-icon">✔</span>' : '') + '</td>';
      html +=   '<td>' + pct(x.change5m) + '</td>';
      html +=   '<td><span class="badge ' + labelClass(x.stability) + '">' + (x.stability||'-') + '</span> ' + pct(x.volatility5m) + '</td>';
      html +=   '<td>' + humanVol(x.quoteVolume24h) + '</td>';
      html += '</tr>';
    }

    html +=   '</tbody>';
    html += '</table>';
    el.innerHTML = html;
  }
}
load();
