import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const DOCS_DIR = path.join(process.cwd(), "docs");
const OUT = path.join(DOCS_DIR, "data.json");

const TOKEN_LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list";
const EXCHANGE_INFO_URL = "https://www.binance.com/bapi/defi/v1/public/alpha-trade/get-exchange-info";
const TICKER_URL = (symbol) => `https://www.binance.com/bapi/defi/v1/public/alpha-trade/ticker?symbol=${encodeURIComponent(symbol)}`;
const KLINES_URL = (symbol, limit=1500) => `https://www.binance.com/bapi/defi/v1/public/alpha-trade/klines?interval=1d&limit=${limit}&symbol=${encodeURIComponent(symbol)}`;

function volatilityLabel(vol) {
  if (vol < 0.05) return "稳定";
  if (vol < 0.15) return "一般";
  return "较差";
}

async function getJson(url){
  const r = await fetch(url, { headers: { "User-Agent": "alpha-watch" }});
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  const j = await r.json();
  return j;
}

async function main() {
  const tokenList = await getJson(TOKEN_LIST_URL);
  const tokens = tokenList?.data ?? [];
  const exInfo = await getJson(EXCHANGE_INFO_URL);
  const symbols = (exInfo?.data?.symbols ?? [])
    .filter(s => s.status === "TRADING" && s.quoteAsset === "USDT");

  const rows = [];
  for (const s of symbols) {
    const pair = s.symbol;
    let ticker;
    try {
      const tj = await getJson(TICKER_URL(pair));
      ticker = tj?.data;
    } catch {
      continue;
    }
    if (!ticker) continue;

    const open = Number(ticker.openPrice ?? 0);
    const high = Number(ticker.highPrice ?? 0);
    const low  = Number(ticker.lowPrice  ?? 0);
    const vol  = open > 0 ? (high - low)/open : 0;
    const label= volatilityLabel(vol);

    rows.push({
      pair,
      priceChangePercent: Number(ticker.priceChangePercent ?? 0),
      quoteVolume: Number(ticker.quoteVolume ?? 0),
      openPrice: open,
      highPrice: high,
      lowPrice: low,
      volatility: vol,
      stability: label
    });
  }

  const topVol = [...rows].sort((a,b)=> b.volatility - a.volatility).slice(0,10);

  const payload = {
    updatedAt: new Date().toISOString(),
    rows,
    topVolatility: topVol
  };

  if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`Wrote ${OUT} with ${rows.length} symbols`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
