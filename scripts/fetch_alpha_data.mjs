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

function normalize(str){ return String(str || "").trim().toUpperCase(); }

async function main() {
  // 1) token meta
  const tokenList = await getJson(TOKEN_LIST_URL);
  const tokens = tokenList?.data ?? [];
  // 建立多键映射：alphaId、symbol、contract 都可查
  const metaIndex = new Map();
  for (const t of tokens) {
    const alphaId = normalize(t.alphaId || t.id || t.tokenId || t.symbol);
    const sym = normalize(t.symbol);
    const contract = normalize(t.contractAddress);
    const meta = {
      alphaId: alphaId || sym,
      name: t.name || "",
      shortSymbol: t.ticker || t.symbol || "",
      chainId: t.chainId || "",
      contractAddress: t.contractAddress || ""
    };
    if (alphaId) metaIndex.set(alphaId, meta);
    if (sym) metaIndex.set(sym, meta);
    if (contract) metaIndex.set(contract, meta);
  }

  // 2) exchange symbols (USDT)
  const exInfo = await getJson(EXCHANGE_INFO_URL);
  const symbols = (exInfo?.data?.symbols ?? [])
    .filter(s => s.status === "TRADING" && s.quoteAsset === "USDT");

  const rows = [];
  for (const s of symbols) {
    const pair = s.symbol;            // e.g., ALPHA_131USDT
    const base = s.baseAsset || "";   // e.g., ALPHA_131

    // map to meta by base
    const meta = metaIndex.get(normalize(base)) || {};

    // 24h ticker
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

    // estimate listed days by daily kline
    let listedDays = null;
    try {
      const kj = await getJson(KLINES_URL(pair, 1500));
      const arr = kj?.data ?? [];
      if (arr.length) {
        const firstOpenTs = Number(arr[0][0]);
        listedDays = Math.floor((Date.now() - firstOpenTs) / (24*3600*1000));
      }
    } catch {}

    const isBSC = (meta.chainId || "").toLowerCase().includes("bsc") || (meta.chainId || "").toLowerCase().includes("bnb");
    const fourX = Boolean(isBSC && listedDays !== null && listedDays <= 30);

    rows.push({
      pair,                      // 原始交易对，保留作跳转用
      baseAsset: s.baseAsset,    // ALPHA_131
      displayName: meta.name || meta.shortSymbol || s.baseAsset,  // 优先展示真实名称
      shortSymbol: meta.shortSymbol || "",
      chainId: meta.chainId || "",
      contract: meta.contractAddress || "",
      priceChangePercent: Number(ticker.priceChangePercent ?? 0),
      quoteVolume: Number(ticker.quoteVolume ?? 0),
      openPrice: open,
      highPrice: high,
      lowPrice: low,
      volatility: vol,
      stability: volatilityLabel(vol),
      listedDays,
      fourX
    });
  }

  // 低波动前十（升序）
  const topLowVol = [...rows]
    .filter(x => Number.isFinite(x.volatility))
    .sort((a,b)=> a.volatility - b.volatility)
    .slice(0,10);

  const payload = {
    updatedAt: new Date().toISOString(),
    rows,
    topLowVolatility: topLowVol
  };

  if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`Wrote ${OUT} with ${rows.length} symbols; top10 lowest volatility ready.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
