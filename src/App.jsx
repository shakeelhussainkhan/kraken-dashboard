import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = "https://143.110.234.110.nip.io";

const C = {
  bg: "#0a0c10", panel: "#0f1218", border: "#1c2230",
  accent: "#00d4aa", accentDim: "#00d4aa22",
  red: "#ff4d6d", redDim: "#ff4d6d22",
  yellow: "#f4c542", blue: "#4d9fff",
  text: "#e2e8f0", muted: "#64748b", subtle: "#1e2533",
};

function mono(text, color) {
  color = color || C.text;
  return <span style={{ fontFamily: "monospace", color: color, fontSize: 12 }}>{text}</span>;
}

function Badge({ label, color }) {
  color = color || C.accent;
  return (
    <span style={{
      background: color + "22", color: color, border: "1px solid " + color + "44",
      borderRadius: 4, padding: "2px 8px", fontSize: 10,
      fontFamily: "monospace", letterSpacing: 1, fontWeight: 700, textTransform: "uppercase",
    }}>{label}</span>
  );
}

function Panel({ children, style }) {
  style = style || {};
  return (
    <div style={{
      background: C.panel, border: "1px solid " + C.border,
      borderRadius: 12, padding: 20, ...style,
    }}>{children}</div>
  );
}

function Stat({ label, value, color }) {
  color = color || C.text;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color }}>{value !== undefined ? value : "—"}</div>
    </div>
  );
}

function SetupForm({ onStart }) {
  const [form, setForm] = useState({
    krakenApiKey: "", krakenApiSecret: "", claudeApiKey: "",
    pairs: "XBTUSD", intervalMinutes: "15", maxPositionUSD: "500",
    maxRiskPercent: "2", maxDailyLossUSD: "200", maxDailyTrades: "20",
    minConfidence: "0.65", riskProfile: "moderate", dryRun: true,
  });

  function set(k) {
    return function(e) {
      setForm(function(p) {
        const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        return Object.assign({}, p, { [k]: v });
      });
    };
  }

  const inp = {
    background: C.subtle, border: "1px solid " + C.border, borderRadius: 8,
    color: C.text, padding: "10px 14px", width: "100%",
    fontFamily: "monospace", fontSize: 13,
  };
  const lbl = { fontSize: 11, color: C.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6, display: "block" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: C.bg }}>
      <div style={{ width: "100%", maxWidth: 600 }}>
        <div style={{ marginBottom: 40, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.accent, letterSpacing: 4, textTransform: "uppercase", marginBottom: 12 }}>◈ KRAKEN × CLAUDE</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: C.text, lineHeight: 1.1 }}>AI Trading Agent</h1>
          <p style={{ color: C.muted, marginTop: 10, fontSize: 14 }}>Connect your accounts and configure the agent below</p>
        </div>
        <Panel>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ borderBottom: "1px solid " + C.border, paddingBottom: 20 }}>
              <div style={{ fontSize: 13, color: C.accent, fontWeight: 600, marginBottom: 16 }}>API Credentials</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[["krakenApiKey","Kraken API Key","KrakenAPIKEY..."],["krakenApiSecret","Kraken API Secret","KrakenSecret..."],["claudeApiKey","Claude (Anthropic) API Key","sk-ant-..."]].map(function(item) {
                  return (
                    <div key={item[0]}>
                      <label style={lbl}>{item[1]}</label>
                      <input type="password" placeholder={item[2]} value={form[item[0]]} onChange={set(item[0])} style={inp} />
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: C.accent, fontWeight: 600, marginBottom: 16 }}>Trading Configuration</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={lbl}>Trading Pairs (comma-separated)</label>
                  <input value={form.pairs} onChange={set("pairs")} style={inp} placeholder="XBTUSD, ETHUSD" />
                </div>
                {[["intervalMinutes","Analysis Interval (min)","15"],["maxPositionUSD","Max Position Size (USD)","500"],["maxRiskPercent","Max Risk Per Trade (%)","2"],["maxDailyLossUSD","Daily Loss Limit (USD)","200"],["maxDailyTrades","Max Trades Per Day","20"],["minConfidence","Min Confidence (0-1)","0.65"]].map(function(item) {
                  return (
                    <div key={item[0]}>
                      <label style={lbl}>{item[1]}</label>
                      <input value={form[item[0]]} onChange={set(item[0])} style={inp} placeholder={item[2]} type="number" />
                    </div>
                  );
                })}
                <div>
                  <label style={lbl}>Risk Profile</label>
                  <select value={form.riskProfile} onChange={set("riskProfile")} style={inp}>
                    <option value="conservative">Conservative</option>
                    <option value="moderate">Moderate</option>
                    <option value="aggressive">Aggressive</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              background: form.dryRun ? C.accentDim : C.redDim,
              border: "1px solid " + (form.dryRun ? C.accent : C.red) + "44",
              borderRadius: 10, padding: "14px 16px",
            }}>
              <input type="checkbox" checked={form.dryRun} onChange={set("dryRun")} style={{ width: 18, height: 18, accentColor: C.accent }} />
              <div>
                <div style={{ fontWeight: 700, color: form.dryRun ? C.accent : C.red }}>
                  {form.dryRun ? "📝 Paper Trading (Safe Mode)" : "💸 LIVE TRADING — Real Money"}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {form.dryRun ? "Simulates trades without using real funds." : "Warning: agent will place real orders on your Kraken account."}
                </div>
              </div>
            </div>
            <button onClick={function() {
              onStart(Object.assign({}, form, {
                pairs: form.pairs.split(",").map(function(s) { return s.trim(); }),
                intervalMinutes: +form.intervalMinutes,
                maxPositionUSD: +form.maxPositionUSD,
                maxRiskPercent: +form.maxRiskPercent,
                maxDailyLossUSD: +form.maxDailyLossUSD,
                maxDailyTrades: +form.maxDailyTrades,
                minConfidence: +form.minConfidence,
              }));
            }} style={{
              background: C.accent, color: "#000", fontWeight: 800,
              fontSize: 15, padding: "14px 24px", borderRadius: 10, border: "none", cursor: "pointer",
            }}>
              Launch Agent →
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function LogFeed({ logs }) {
  const ref = useRef(null);
  useEffect(function() { if (ref.current) ref.current.scrollTop = 0; }, [logs.length]);
  const lvlColor = { info: C.accent, warn: C.yellow, error: C.red, debug: C.muted };
  return (
    <div ref={ref} style={{ height: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
      {logs.length === 0
        ? <div style={{ color: C.muted, fontSize: 12, fontFamily: "monospace" }}>Waiting for agent activity...</div>
        : logs.map(function(log, i) {
          return (
            <div key={i} style={{ display: "flex", gap: 10, fontSize: 11, fontFamily: "monospace", lineHeight: 1.5 }}>
              <span style={{ color: C.muted, flexShrink: 0 }}>{new Date(log.time).toLocaleTimeString()}</span>
              <span style={{ color: lvlColor[log.level] || C.text, flexShrink: 0, width: 40 }}>[{(log.level || "").toUpperCase()}]</span>
              <span style={{ color: C.text }}>{log.message}</span>
            </div>
          );
        })}
    </div>
  );
}

function DecisionCard({ pair, decision }) {
  if (!decision) return null;
  const ac = { buy: C.accent, sell: C.red, hold: C.yellow }[decision.action] || C.text;
  return (
    <div style={{ background: ac + "11", border: "1px solid " + ac + "33", borderRadius: 10, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1 }}>{pair}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: ac, textTransform: "uppercase" }}>{decision.action}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: C.muted }}>Confidence</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: ac }}>{(decision.confidence * 100).toFixed(0)}%</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{decision.reason}</div>
      {decision.signals && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {decision.signals.map(function(s, i) { return <Badge key={i} label={s} color={ac} />; })}
        </div>
      )}
      {decision.size_usd > 0 && (
        <div style={{ marginTop: 10, display: "flex", gap: 16, fontSize: 11, fontFamily: "monospace" }}>
          <span style={{ color: C.muted }}>Size: <span style={{ color: C.text }}>${decision.size_usd}</span></span>
          <span style={{ color: C.muted }}>SL: <span style={{ color: C.red }}>{decision.stop_loss_pct}%</span></span>
          <span style={{ color: C.muted }}>TP: <span style={{ color: C.accent }}>{decision.take_profit_pct}%</span></span>
        </div>
      )}
      <div style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>{new Date(decision.timestamp).toLocaleTimeString()}</div>
    </div>
  );
}

function TradeRow({ trade }) {
  const isBuy = trade.type === "buy";
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "auto 1fr auto auto auto",
      gap: 12, alignItems: "center", padding: "10px 0",
      borderBottom: "1px solid " + C.border, fontSize: 12,
    }}>
      <Badge label={trade.type} color={isBuy ? C.accent : C.red} />
      <div>
        <div style={{ fontWeight: 600 }}>{trade.pair}</div>
        <div style={{ fontSize: 10, color: C.muted }}>{(trade.reason || "").slice(0, 40)}</div>
      </div>
      {mono("$" + parseFloat(trade.price || 0).toFixed(2), C.text)}
      {mono("$" + parseFloat(trade.usd_value || 0).toFixed(2), C.accent)}
      {trade.simulated && <Badge label="paper" color={C.muted} />}
    </div>
  );
}

function Dashboard({ config, onStop }) {
  const [logs, setLogs] = useState([]);
  const [trades, setTrades] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [portfolio, setPortfolio] = useState(null);
  const [connected, setConnected] = useState(false);
  const [dailyStats, setDailyStats] = useState(null);
  const esRef = useRef(null);

  const addLog = useCallback(function(entry) {
    setLogs(function(p) { return [entry, ...p].slice(0, 200); });
  }, []);

  useEffect(function() {
    fetch(API_BASE + "/api/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        addLog({ time: new Date().toISOString(), level: "info", message: "Agent started: " + d.message });
      })
      .catch(function() {
        addLog({ time: new Date().toISOString(), level: "error", message: "Cannot reach agent server at " + API_BASE });
      });

    const es = new EventSource(API_BASE + "/api/stream");
    esRef.current = es;
    es.onopen = function() { setConnected(true); };
    es.onerror = function() { setConnected(false); };
    es.addEventListener("log", function(e) { addLog(JSON.parse(e.data)); });
    es.addEventListener("status", function(e) {
      const d = JSON.parse(e.data);
      setDailyStats(d.dailyStats);
    });
    es.addEventListener("trade", function(e) {
      setTrades(function(p) { return [JSON.parse(e.data), ...p].slice(0, 100); });
    });
    es.addEventListener("decision", function(e) {
      const d = JSON.parse(e.data);
      setDecisions(function(p) { return Object.assign({}, p, { [d.pair]: d.decision }); });
    });
    es.addEventListener("portfolio", function(e) { setPortfolio(JSON.parse(e.data)); });

    const poll = setInterval(function() {
      fetch(API_BASE + "/api/status").then(function(r) { return r.json(); }).then(function(d) {
        if (d.dailyStats) setDailyStats(d.dailyStats);
      }).catch(function() {});
    }, 10000);

    return function() { es.close(); clearInterval(poll); };
  }, []);

  function handleStop() {
    fetch(API_BASE + "/api/stop", { method: "POST" }).catch(function() {});
    if (esRef.current) esRef.current.close();
    onStop();
  }

  function handleRunNow() {
    fetch(API_BASE + "/api/run-cycle", { method: "POST" }).catch(function() {});
    addLog({ time: new Date().toISOString(), level: "info", message: "Manual cycle triggered" });
  }

  const isLive = !config.dryRun;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>⬡ Kraken AI Agent</div>
          <Badge label={isLive ? "LIVE" : "PAPER"} color={isLive ? C.red : C.yellow} />
          <Badge label={connected ? "CONNECTED" : "DISCONNECTED"} color={connected ? C.accent : C.red} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleRunNow} style={{
            background: C.subtle, color: C.text, borderRadius: 8,
            padding: "8px 16px", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
          }}>↺ Run Now</button>
          <button onClick={handleStop} style={{
            background: C.redDim, color: C.red, border: "1px solid " + C.red + "44",
            borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>■ Stop Agent</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, marginBottom: 24 }}>
        <Panel><Stat label="Daily Trades" value={dailyStats ? dailyStats.dailyTrades : "—"} /></Panel>
        <Panel><Stat label="Daily Loss" value={dailyStats ? "$" + dailyStats.dailyLoss.toFixed(2) : "—"} /></Panel>
        <Panel><Stat label="Loss Limit" value={dailyStats ? "$" + dailyStats.maxDailyLoss : "—"} color={C.muted} /></Panel>
        <Panel><Stat label="Pairs" value={config.pairs ? config.pairs.join(", ") : "—"} color={C.accent} /></Panel>
        <Panel><Stat label="Interval" value={config.intervalMinutes + "m"} /></Panel>
        <Panel><Stat label="Max Position" value={"$" + config.maxPositionUSD} /></Panel>
      </div>

      {dailyStats && dailyStats.circuitBreakerActive && (
        <Panel style={{ marginBottom: 20, borderColor: C.red + "55", background: C.redDim }}>
          <div style={{ fontWeight: 800, color: C.red, fontSize: 16 }}>🔴 CIRCUIT BREAKER ACTIVE — Trading halted for today</div>
          <div style={{ color: C.muted, marginTop: 6, fontSize: 13 }}>Daily loss limit reached. Will reset at midnight.</div>
        </Panel>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <Panel>
          <div style={{ fontSize: 13, color: C.accent, fontWeight: 600, marginBottom: 16 }}>🤖 CLAUDE DECISIONS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Object.keys(decisions).length === 0
              ? <div style={{ color: C.muted, fontSize: 12, fontFamily: "monospace" }}>Waiting for first analysis cycle...</div>
              : Object.entries(decisions).map(function(entry) {
                return <DecisionCard key={entry[0]} pair={entry[0]} decision={entry[1]} />;
              })}
          </div>
        </Panel>
        <Panel>
          <div style={{ fontSize: 13, color: C.accent, fontWeight: 600, marginBottom: 16 }}>💼 PORTFOLIO BALANCES</div>
          {portfolio ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(portfolio).filter(function(e) { return parseFloat(e[1]) > 0.00001; }).map(function(e) {
                return (
                  <div key={e[0]} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid " + C.border }}>
                    <span style={{ fontWeight: 600, color: C.text }}>{e[0]}</span>
                    {mono(parseFloat(e[1]).toFixed(8), C.accent)}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: C.muted, fontSize: 12, fontFamily: "monospace" }}>Fetching balances...</div>
          )}
        </Panel>
      </div>

      <Panel style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.accent, fontWeight: 600, marginBottom: 16 }}>📋 TRADE HISTORY</div>
        {trades.length === 0
          ? <div style={{ color: C.muted, fontSize: 12, fontFamily: "monospace" }}>No trades yet this session.</div>
          : trades.map(function(t, i) { return <TradeRow key={i} trade={t} />; })}
      </Panel>

      <Panel>
        <div style={{ fontSize: 13, color: C.accent, fontWeight: 600, marginBottom: 16 }}>📡 AGENT LOGS</div>
        <LogFeed logs={logs} />
      </Panel>

      <Panel style={{ marginTop: 20 }}>
        <div style={{ fontSize: 13, color: C.muted, fontWeight: 600, marginBottom: 12 }}>ACTIVE CONFIGURATION</div>
        <pre style={{ fontFamily: "monospace", fontSize: 11, color: C.muted, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
          {JSON.stringify({
            pairs: config.pairs, intervalMinutes: config.intervalMinutes,
            maxPositionUSD: config.maxPositionUSD, maxRiskPercent: config.maxRiskPercent,
            maxDailyLossUSD: config.maxDailyLossUSD, minConfidence: config.minConfidence,
            riskProfile: config.riskProfile, dryRun: config.dryRun,
          }, null, 2)}
        </pre>
      </Panel>
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState(null);
  return config
    ? <Dashboard config={config} onStop={function() { setConfig(null); }} />
    : <SetupForm onStart={setConfig} />;
}
