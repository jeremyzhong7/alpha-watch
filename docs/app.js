async function load(){
  const elUpdated = document.getElementById("updatedAt");
  try{
    const r = await fetch("./data.json", {cache:"no-store"});
    const j = await r.json();
    elUpdated.textContent = `上次更新：${new Date(j.updatedAt).toLocaleString()}`;

    const rows = j.rows || [];
    // 低波动前十（升序）
    const top10 = (j.topLowVolatility && j.topLowVolatility.length) 
      ? j.topLowVolatility 
      : [...rows].sort((a,b)=> (a.volatility||0) - (b.volatility||0)).slice(0,10);

    renderTable("top10", top10);
    renderTable("table", rows.sort((a,b)=> (a.volatility||0) - (b.volatility||0)));

    const input = document.getElementById("search");
    input.addEventListener("input", e=>{
      const q = e.target.value.trim().toLowerCase();
      const filtered = rows.filter(x =>
        (x.displayName||"").toLowerCase().includes(q) ||
        (x.shortSymbol||"").toLowerCase().includes(q) ||
        (x.pair||"").toLowerCase().includes(q)
      );
      renderTable("table", filtered);
    });
  }catch(e){
    console.error(e);
    elUpdated.textContent = "加载失败，请稍后刷新";
    renderTable("top10", []);
    renderTable("table", []);
  }

  function renderTable(targetId, list){
    const el = document.getElementById(targetId);
    if (!list || !list.length){
      el.innerHTML = `<div class="small">暂无数据</div>`;
      return;
    }
    const fmtNum = v => (Number(v)||0).toLocaleString();
    const volPct = v => ((Number(v)||0)*100).toFixed(2) + "%";
    const labelClass = s => s==="稳定" ? "ok" : (s==="一般" ? "warn" : "bad");

    el.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>代号</th>
            <th>链</th>
            <th>4×</th>
            <th>24h 涨跌</th>
            <th>24h 波动率</th>
            <th>成交额(USDT)</th>
            <th class="small">交易对</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(x=>{
            const vol = Number(x.volatility)||0;
            const width = Math.max(2, Math.min(100, Math.round(vol*300))); // 映射到像素长度
            const stability = x.stability || "-";
            const pairLink = x.pair ? \`https://www.binance.com/zh-CN/trade/\${encodeURIComponent(x.pair)}?theme=dark&type=alpha\` : "#";
            return `
              <tr>
                <td>${x.displayName || "-"}</td>
                <td><span class="tag">${x.shortSymbol || "-"}</span></td>
                <td>${x.chainId ? `<span class="badge chain">${x.chainId}</span>` : "-"}</td>
                <td>${x.fourX ? `<span class="badge fourx">4×</span>` : `<span class="badge">—</span>`}</td>
                <td>${(Number(x.priceChangePercent)||0).toFixed(2)}%</td>
                <td>
                  <div class="volwrap">
                    <span class="badge ${labelClass(stability)}">${stability}</span>
                    <div class="volbar" style="width:${width}px"></div>
                    <span class="small">${volPct(vol)}</span>
                  </div>
                </td>
                <td>${fmtNum(x.quoteVolume)}</td>
                <td><a target="_blank" href="${pairLink}">${x.pair || "-"}</a></td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }
}
load();
