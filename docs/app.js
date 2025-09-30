
async function load(){
  const elUpdated = document.getElementById("updatedAt");
  try{
    const r = await fetch("./data.json?v=" + Date.now(), {cache:"no-store"});
    if (!r.ok) throw new Error("data.json fetch failed: " + r.status);
    const j = await r.json();
    elUpdated.textContent = "上次更新：" + new Date(j.updatedAt).toLocaleString();

    const rows = j.rows || [];
    const top10 = (j.topLowVolatility && j.topLowVolatility.length)
      ? j.topLowVolatility
      : rows.slice().sort(function(a,b){ return (a.volatility||0) - (b.volatility||0); }).slice(0,10);

    renderTable("top10", top10);
    renderTable("table", rows.slice().sort(function(a,b){ return (a.volatility||0) - (b.volatility||0); }));

    var input = document.getElementById("search");
    input.addEventListener("input", function(e){
      var q = (e.target.value || "").trim().toLowerCase();
      var filtered = rows.filter(function(x){
        return ((x.displayName||"").toLowerCase().indexOf(q) >= 0) ||
               ((x.shortSymbol||"").toLowerCase().indexOf(q) >= 0) ||
               ((x.pair||"").toLowerCase().indexOf(q) >= 0);
      });
      renderTable("table", filtered);
    });
  }catch(e){
    console.error(e);
    elUpdated.textContent = "加载失败（可能是 404 或缓存未更新）。请在 Actions 里确认已生成 docs/data.json。";
    renderTable("top10", []);
    renderTable("table", []);
  }

  function renderTable(targetId, list){
    var el = document.getElementById(targetId);
    if (!list || !list.length){
      el.innerHTML = '<div class="small">暂无数据</div>';
      return;
    }
    function fmtNum(v){ return (Number(v)||0).toLocaleString(); }
    function volPct(v){ return ((Number(v)||0)*100).toFixed(2) + '%'; }
    function labelClass(s){ return s==='稳定' ? 'ok' : (s==='一般' ? 'warn' : 'bad'); }

    var html = '';
    html += '<table>';
    html +=   '<thead>';
    html +=     '<tr>';
    html +=       '<th>名称</th>';
    html +=       '<th>代号</th>';
    html +=       '<th>链</th>';
    html +=       '<th>4×</th>';
    html +=       '<th>24h 涨跌</th>';
    html +=       '<th>24h 波动率</th>';
    html +=       '<th>成交额(USDT)</th>';
    html +=       '<th class="small">交易对</th>';
    html +=     '</tr>';
    html +=   '</thead>';
    html +=   '<tbody>';

    for (var i=0;i<list.length;i++){
      var x = list[i];
      var vol = Number(x.volatility)||0;
      var width = Math.max(2, Math.min(100, Math.round(vol*300)));
      var stability = x.stability || '-';
      var pairLink = x.pair ? ('https://www.binance.com/zh-CN/trade/' + encodeURIComponent(x.pair) + '?theme=dark&type=alpha') : '#';

      html += '<tr>';
      html +=   '<td>' + (x.displayName || '-') + '</td>';
      html +=   '<td><span class="tag">' + (x.shortSymbol || '-') + '</span></td>';
      html +=   '<td>' + (x.chainId ? ('<span class="badge chain">' + x.chainId + '</span>') : '-') + '</td>';
      html +=   '<td>' + (x.fourX ? '<span class="badge fourx">4×</span>' : '<span class="badge">-</span>') + '</td>';
      html +=   '<td>' + ((Number(x.priceChangePercent)||0).toFixed(2)) + '%</td>';
      html +=   '<td>';
      html +=     '<div class="volwrap">';
      html +=       '<span class="badge ' + labelClass(stability) + '">' + stability + '</span>';
      html +=       '<div class="volbar" style="width:' + width + 'px"></div>';
      html +=       '<span class="small">' + volPct(vol) + '</span>';
      html +=     '</div>';
      html +=   '</td>';
      html +=   '<td>' + fmtNum(x.quoteVolume) + '</td>';
      html +=   '<td><a target="_blank" href="' + pairLink + '">' + (x.pair || '-') + '</a></td>';
      html += '</tr>';
    }

    html +=   '</tbody>';
    html += '</table>';
    el.innerHTML = html;
  }
}
load();
