import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const DOCS_DIR = path.join(process.cwd(), "docs");
const OUT = path.join(DOCS_DIR, "data.json");

const TOKEN_LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list";
const EXCHANGE_INFO_URL = "https://www.binance.com/bapi/defi/v1/public/alpha-trade/get-exchange-info";
const TICKER_URL = (symbol) => `https://www.binance.com/bapi/defi/v1/public/alpha-trade/ticker?symbol=${encodeURIComponent(symbol)}`;
const K5M_URL = (symbol) => `https://www.binance.com/bapi/defi/v1/public/alpha-trade/klines?interval=5m&limit=1&symbol=${encodeURIComponent(symbol)}`;
const KD1_URL = (symbol, limit=1500) => `https://www.binance.com/bapi/defi/v1/public/alpha-trade/klines?interval=1d&limit=${limit}&symbol=${encodeURIComponent(symbol)}`;

function isBSCChain(v){
  if (v == null) return false;
  const s = String(v).toLowerCase();
  if (s.includes("bsc") || s.includes("bnb") || s.includes("bep20")) return true;
  if (s === "56" || s === "0x38") return true; // common numeric id for BSC
  return false;
}
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
  const tokenList = await getJson(TOKEN_LIST_URL);
  const tokens = tokenList?.data ?? [];
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

  const exInfo = await getJson(EXCHANGE_INFO_URL);
  const symbols = (exInfo?.data?.symbols ?? [])
    .filter(s => s.status === "TRADING" && s.quoteAsset === "USDT");

  const rows = [];
  for (const s of symbols) {
    const pair = s.symbol;
    const base = normalize(s.baseAsset || "");
    const meta = metaIndex.get(base) || {};
    const chainId = meta.chainId || "";
    if (!isBSCChain(chainId)) continue;

    let ticker;
    try {
      const tj = await getJson(TICKER_URL(pair));
      ticker = tj?.data;
    } catch {
      continue;
    }
    if (!ticker) continue;

    const quoteVolume24h = Number(ticker.quoteVolume ?? 0);
    if (!(quoteVolume24h > 50_000_000)) continue;

    let k5 = null;
    try {
      const kj = await getJson(K5M_URL(pair));
      const arr = kj?.data ?? [];
      if (arr.length) k5 = arr[arr.length - 1];
    } catch {}

    let open5 = null, high5 = null, low5 = null, close5 = null;
    if (k5 && k5.length >= 5) {
      open5 = Number(k5[1]);
      high5 = Number(k5[2]);
      low5  = Number(k5[3]);
      close5= Number(k5[4]);
    }
    if (!(open5 && high5 && low5 && close5)) continue;

    const vol5 = open5 > 0 ? (high5 - low5) / open5 : 0;
    const chg5 = open5 > 0 ? (close5 - open5) / open5 : 0;

    let listedDays = null;
    try {
      const kd = await getJson(KD1_URL(pair, 1500));
      const darr = kd?.data ?? [];
      if (darr.length) {
        const firstOpenTs = Number(darr[0][0]);
        listedDays = Math.floor((Date.now() - firstOpenTs) / (24*3600*1000));
      }
    } catch {}

    const fourX = Boolean(isBSCChain(chainId) && listedDays !== null && listedDays <= 30);

    rows.push({
      shortSymbol: meta.shortSymbol || s.baseAsset || "",
      chainId: meta.chainId || "",
      fourX,
      change5m: chg5,
      volatility5m: vol5,
      stability: volatilityLabel(vol5),
      quoteVolume24h: quoteVolume24h,
      pair,
      listedDays
    });
  }

  // asc by 5m vol by default
  const sorted = rows.sort((a,b)=> (a.volatility5m||0) - (b.volatility5m||0));

  const payload = {
    updatedAt: new Date().toISOString(),
    rows: sorted
  };

  if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`Wrote ${OUT} with ${rows.length} symbols (BSC only, >50M quote volume).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
