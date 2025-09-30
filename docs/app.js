async function load(){
  const r = await fetch("./data.json", {cache:"no-store"});
  const j = await r.json();
  document.getElementById("updatedAt").textContent = `上次更新：${new Date(j.updatedAt).toLocaleString()}`;

  renderTable("top10", j.topVolatility);
  renderTable("table", j.rows);

  const input = document.getElementById("search");
  input.addEventListener("input", e=>{
    const q = e.target.value.trim().toLowerCase();
    const filtered = j.rows.filter(x => x.pair.toLowerCase().includes(q));
    renderTable("table", filtered);
  });

  function renderTable(id, list){
    const el = document.getElementById(id);
    el.innerHTML = `<table><thead><tr><th>交易对</th><th>24h 涨跌</th><th>24h 波动率</th><th>稳定性</th><th>成交额(USDT)</th></tr></thead><tbody>` +
      list.map(x=>`<tr><td>${x.pair}</td><td>${x.priceChangePercent.toFixed(2)}%</td><td>${(x.volatility*100).toFixed(2)}%</td><td>${x.stability}</td><td>${x.quoteVolume.toLocaleString()}</td></tr>`).join("") +
      `</tbody></table>`;
  }
}
load();
