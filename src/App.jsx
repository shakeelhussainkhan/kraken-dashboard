import express from "express";
import cors from "cors";
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
app.use(cors());
app.use(express.json());

let agentConfig = null;
let agentInterval = null;
let anthropic = null;
let sseClients = [];

const dailyStats = {
  dailyTrades: 0,
  dailyLoss: 0,
  maxDailyLoss: 200,
  maxDailyTrades: 20,
  circuitBreakerActive: false,
};

function scheduleDailyReset() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  setTimeout(() => {
    dailyStats.dailyTrades = 0;
    dailyStats.dailyLoss = 0;
    dailyStats.circuitBreakerActive = false;
    broadcast("log", { time: new Date().toISOString(), level: "info", message: "Daily stats reset at midnight." });
    scheduleDailyReset();
  }, midnight - now);
}
scheduleDailyReset();

function broadcast(event, data) {
  const msg = "event: " + event + "\ndata: " + JSON.stringify(data) + "\n\n";
  sseClients.forEach(function(res) { res.write(msg); });
}

function log(level, message) {
  console.log("[" + level.toUpperCase() + "] " + message);
  broadcast("log", { time: new Date().toISOString(), level: level, message: message });
}

const KRAKEN_BASE = "https://api.kraken.com";

async function krakenPublic(path, params) {
  if (!params) params = {};
  const qs = new URLSearchParams(params).toString();
  const url = KRAKEN_BASE + path + (qs ? "?" + qs : "");
  const res = await fetch(url);
  const json = await res.json();
  if (json.error && json.error.length) {
    throw new Error("Kraken error: " + json.error.join(", "));
  }
  return json.result;
}

async function krakenPrivate(path, params) {
  if (!params) params = {};
  const apiKey = agentConfig.krakenApiKey;
  const apiSecret = agentConfig.krakenApiSecret;
  const nonce = Date.now().toString();
  const body = new URLSearchParams(Object.assign({ nonce: nonce }, params)).toString();
  const secret = Buffer.from(apiSecret, "base64");
  const hash = crypto.createHash("sha256").update(nonce + body).digest("binary");
  const hmac = crypto.createHmac("sha512", secret).update(path + hash, "binary").digest("base64");
  const res = await fetch(KRAKEN_BASE + path, {
    method: "POST",
    headers: {
      "API-Key": apiKey,
      "API-Sign": hmac,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body,
  });
  const json = await res.json();
  if (json.error && json.error.length) {
    throw new Error("Kraken error: " + json.error.join(", "));
  }
  return json.result;
}

async function getOHLCV(pair, interval) {
  if (!interval) interval = 15;
  const data = await krakenPublic("/0/public/OHLC", { pair: pair, interval: interval });
  const key = Object.keys(data).find(function(k) { return k !== "last"; });
  return data[key].slice(-50);
}

async function getTicker(pair) {
  const data = await krakenPublic("/0/public/Ticker", { pair: pair });
  const key = Object.keys(data)[0];
  return data[key];
}

async function getBalance() {
  return krakenPrivate("/0/private/Balance");
}

async function placeOrder(pair, type, volume) {
  return krakenPrivate("/0/private/AddOrder", {
    pair: pair,
    type: type,
    ordertype: "market",
    volume: String(volume),
  });
}

function calcRSI(closes, period) {
  if (!period) period = 14;
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const rs = gains / (losses || 0.0001);
  return 100 - 100 / (1 + rs);
}

function calcEMA(closes, period) {
  const k = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcMACD(closes) {
  const ema12 = calcEMA(closes.slice(-26), 12);
  const ema26 = calcEMA(closes.slice(-26), 26);
  return { macd: ema12 - ema26, ema12: ema12, ema26: ema26 };
}

function calcBB(closes, period) {
  if (!period) period = 20;
  const slice = closes.slice(-period);
  const mean = slice.reduce(function(a, b) { return a + b; }, 0) / slice.length;
  const std = Math.sqrt(slice.reduce(function(a, b) { return a + Math.pow(b - mean, 2); }, 0) / slice.length);
  return { upper: mean + 2 * std, lower: mean - 2 * std, middle: mean };
}

function buildMarketSummary(pair, candles, ticker) {
  const closes = candles.map(function(c) { return parseFloat(c[4]); });
  const volumes = candles.map(function(c) { return parseFloat(c[6]); });
  const rsi = calcRSI(closes);
  const macdData = calcMACD(closes);
  const bb = calcBB(closes);
  const currentPrice = parseFloat(ticker.c[0]);
  const avgVolume = volumes.slice(-10).reduce(function(a, b) { return a + b; }, 0) / 10;
  const lastVolume = volumes[volumes.length - 1];
  return {
    pair: pair,
    currentPrice: currentPrice,
    rsi: rsi ? rsi.toFixed(2) : "n/a",
    macd: macdData.macd.toFixed(4),
    ema12: macdData.ema12.toFixed(2),
    ema26: macdData.ema26.toFixed(2),
    bbUpper: bb.upper.toFixed(2),
    bbLower: bb.lower.toFixed(2),
    bbMiddle: bb.middle.toFixed(2),
    volRatio: (lastVolume / avgVolume).toFixed(2),
    ask: ticker.a[0],
    bid: ticker.b[0],
    high: ticker.h[1],
    low: ticker.l[1],
    closes: closes.slice(-10).map(function(c) { return c.toFixed(2); }).join(","),
  };
}

async function getClaudeDecision(md, cfg) {
  const lines = [
    "You are an expert crypto trading analyst.",
    "Analyze this market data and reply with JSON only. No prose.",
    "Pair: " + md.pair,
    "Price: " + md.currentPrice,
    "RSI: " + md.rsi,
    "MACD: " + md.macd,
    "EMA12: " + md.ema12 + " EMA26: " + md.ema26,
    "BB Upper: " + md.bbUpper + " Middle: " + md.bbMiddle + " Lower: " + md.bbLower,
    "Volume ratio: " + md.volRatio,
    "24h High: " + md.high + " Low: " + md.low,
    "Ask: " + md.ask + " Bid: " + md.bid,
    "Last 10 closes: " + md.closes,
    "Risk profile: " + cfg.riskProfile,
    "Max position USD: " + cfg.maxPositionUSD,
    "Max risk per trade %: " + cfg.maxRiskPercent,
    "Return this exact JSON structure:",
    "{",
    '  "action": "buy" or "sell" or "hold",',
    '  "confidence": number between 0 and 1,',
    '  "reason": "one sentence string",',
    '  "signals": ["signal1", "signal2"],',
    '  "size_usd": number,',
    '  "stop_loss_pct": number,',
    '  "take_profit_pct": number',
    "}",
  ];
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    messages: [{ role: "user", content: lines.join("\n") }],
  });
  const raw = response.content[0].text.trim().replace(/```json|```/g, "").trim();
  return JSON.parse(raw);
}

async function executeOrder(pair, decision, price) {
  const sizeUSD = Math.min(decision.size_usd || agentConfig.maxPositionUSD, agentConfig.maxPositionUSD);
  const volume = (sizeUSD / price).toFixed(8);
  const tradeRecord = {
    type: decision.action,
    pair: pair,
    price: price,
    volume: volume,
    usd_value: sizeUSD,
    reason: decision.reason,
    simulated: agentConfig.dryRun,
    timestamp: new Date().toISOString(),
  };
  if (agentConfig.dryRun) {
    log("info", "[PAPER] " + decision.action.toUpperCase() + " " + volume + " " + pair + " @ $" + price);
    sendTelegram("📝 PAPER TRADE\n" + decision.action.toUpperCase() + " " + volume + " " + pair + " @ $" + price + "\nReason: " + decision.reason);
  } else {
    try {
      log("info", "[LIVE] Placing " + decision.action.toUpperCase() + " order for " + volume + " " + pair);
      const result = await placeOrder(pair, decision.action, volume);
      tradeRecord.orderId = result.txid && result.txid[0];
      log("info", "Order placed successfully: " + tradeRecord.orderId);
      sendTelegram("💰 LIVE TRADE PLACED\n" + decision.action.toUpperCase() + " " + volume + " " + pair + " @ $" + price + "\nValue: $" + sizeUSD + "\nConfidence: " + Math.round(decision.confidence * 100) + "%\nReason: " + decision.reason);
    } catch (err) {
      log("error", "Order failed: " + err.message);
      sendTelegram("🚨 ORDER FAILED\nPair: " + pair + "\nError: " + err.message);
      return;
    }
  }
  dailyStats.dailyTrades++;
  broadcast("trade", tradeRecord);
}

async function runCycle() {
  if (!agentConfig) return;
  if (dailyStats.circuitBreakerActive) {
    log("warn", "Circuit breaker active - skipping cycle.");
    return;
  }
  for (const pair of agentConfig.pairs) {
    try {
      log("info", "[" + pair + "] Fetching market data...");
      const candles = await getOHLCV(pair, agentConfig.intervalMinutes);
      const ticker = await getTicker(pair);
      const md = buildMarketSummary(pair, candles, ticker);
      log("info", "[" + pair + "] Price $" + md.currentPrice + " RSI:" + md.rsi + " MACD:" + md.macd);
      log("info", "[" + pair + "] Asking Claude for decision...");
      const decision = await getClaudeDecision(md, agentConfig);
      decision.pair = pair;
      decision.timestamp = new Date().toISOString();
      broadcast("decision", { pair: pair, decision: decision });
      log("info", "[" + pair + "] " + decision.action.toUpperCase() + " @ " + Math.round(decision.confidence * 100) + "% - " + decision.reason);
      const canTrade = decision.action !== "hold"
        && decision.confidence >= agentConfig.minConfidence
        && dailyStats.dailyTrades < agentConfig.maxDailyTrades;
      if (canTrade) {
        await executeOrder(pair, decision, md.currentPrice);
      } else if (decision.action !== "hold") {
        log("warn", "[" + pair + "] Skipped - confidence too low or daily limit reached");
      }
    } catch (err) {
      log("error", "[" + pair + "] Cycle error: " + err.message);
    }
  }
  try {
    if (!agentConfig.dryRun) {
      const bal = await getBalance();
      broadcast("portfolio", bal);
    }
  } catch (e) {}
  broadcast("status", { dailyStats: dailyStats });
}

app.get("/api/stream", function(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  sseClients.push(res);
  log("debug", "SSE client connected. Total: " + sseClients.length);
  req.on("close", function() {
    sseClients = sseClients.filter(function(c) { return c !== res; });
  });
});

app.post("/api/start", async function(req, res) {
  if (agentInterval) clearInterval(agentInterval);
  agentConfig = req.body;
  if (!agentConfig.claudeApiKey) {
    return res.status(400).json({ error: "Claude API key required" });
  }
  anthropic = new Anthropic({ apiKey: agentConfig.claudeApiKey });
  dailyStats.maxDailyLoss = agentConfig.maxDailyLossUSD;
  dailyStats.maxDailyTrades = agentConfig.maxDailyTrades;
  log("info", "Agent started - pairs: " + agentConfig.pairs.join(", ") + " | mode: " + (agentConfig.dryRun ? "PAPER" : "LIVE"));
  runCycle();
  agentInterval = setInterval(runCycle, agentConfig.intervalMinutes * 60 * 1000);
  res.json({ message: "Agent started" });
});

app.post("/api/stop", function(req, res) {
  if (agentInterval) clearInterval(agentInterval);
  agentInterval = null;
  agentConfig = null;
  log("info", "Agent stopped.");
  res.json({ message: "Agent stopped" });
});

app.post("/api/run-cycle", function(req, res) {
  runCycle();
  res.json({ message: "Cycle triggered" });
});

app.get("/api/status", function(req, res) {
  res.json({ running: !!agentConfig, dailyStats: dailyStats, config: agentConfig });
});

// ── Telegram Alerts ───────────────────────────────────────────────────────────
const TELEGRAM_TOKEN = "8445957862:AAGyEV7tiRsENjOkQ5bbxn0-3DABAMQ_rj4";
const TELEGRAM_CHAT_ID = "8695847775";

async function sendTelegram(message) {
  try {
    const url = "https://api.telegram.org/bot" + TELEGRAM_TOKEN + "/sendMessage";
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: "HTML" }),
    });
  } catch (err) {
    console.log("Telegram error: " + err.message);
  }
}

const PORT = 3000;
app.listen(PORT, function() {
  console.log("\n🤖 Kraken AI Agent running on http://localhost:" + PORT + "\n");
  sendTelegram("🤖 Kraken AI Agent started and running on cloud server!");
});
