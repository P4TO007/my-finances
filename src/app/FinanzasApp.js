"use client";
import { useState, useEffect, useRef } from "react";

const CATEGORIES = {
  income: ["Trabajo", "Freelance", "Regalo", "Inversión", "Otro ingreso"],
  expense: ["Comida", "Transporte", "Entretenimiento", "Salud", "Ropa", "Educación", "Servicios", "Otro gasto"],
};

const CATEGORY_ICONS = {
  "Trabajo": "💼", "Freelance": "💻", "Regalo": "🎁", "Inversión": "📈", "Otro ingreso": "💰",
  "Comida": "🍔", "Transporte": "🚗", "Entretenimiento": "🎮", "Salud": "💊",
  "Ropa": "👕", "Educación": "📚", "Servicios": "🔧", "Otro gasto": "📦",
};

const STORAGE_KEY = "finanzas_v1";

function formatMXN(amount) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(amount);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

async function parseWithAI(text, apiKey) {
  const prompt = `Analiza este texto de registro de finanzas y extrae la información en JSON.
Texto: "${text}"

Responde SOLO con un JSON válido con esta estructura exacta (sin markdown, sin explicación):
{
  "type": "income" o "expense",
  "amount": número (solo dígitos, sin símbolo de moneda),
  "category": una de estas categorías exactas según el tipo:
    - Si es ingreso: "Trabajo", "Freelance", "Regalo", "Inversión", "Otro ingreso"
    - Si es gasto: "Comida", "Transporte", "Entretenimiento", "Salud", "Ropa", "Educación", "Servicios", "Otro gasto"
  "note": descripción corta del movimiento (máx 40 chars)
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-allow-browser": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  const raw = data.content.map(b => b.text || "").join("").trim();
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export default function FinanzasApp() {
  const [transactions, setTransactions] = useState([]);
  const [view, setView] = useState("home");
  const [quickText, setQuickText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [parseError, setParseError] = useState("");
  const [manualForm, setManualForm] = useState({ type: "expense", amount: "", category: "", note: "" });
  const [filterType, setFilterType] = useState("all");
  const [toast, setToast] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [showApiSetup, setShowApiSetup] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setTransactions(JSON.parse(saved));
      const savedKey = localStorage.getItem("finanzas_api_key");
      if (savedKey) { setApiKey(savedKey); setApiKeySaved(true); }
    } catch (_) {}
  }, []);

  const save = (txns) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(txns)); } catch (_) {}
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const saveApiKey = () => {
    try {
      localStorage.setItem("finanzas_api_key", apiKey);
      setApiKeySaved(true);
      setShowApiSetup(false);
      showToast("✅ API Key guardada");
    } catch (_) {}
  };

  const addTransaction = (tx) => {
    const newTx = { ...tx, id: Date.now(), date: new Date().toISOString() };
    const updated = [newTx, ...transactions];
    setTransactions(updated);
    save(updated);
    showToast(tx.type === "income" ? "✅ Ingreso registrado" : "✅ Gasto registrado");
    setView("home");
    setQuickText(""); setParsed(null); setParseError("");
    setManualForm({ type: "expense", amount: "", category: "", note: "" });
  };

  const deleteTransaction = (id) => {
    const updated = transactions.filter(t => t.id !== id);
    setTransactions(updated);
    save(updated);
    showToast("🗑️ Movimiento eliminado", "info");
  };

  const handleQuickParse = async () => {
    if (!quickText.trim()) return;
    if (!apiKeySaved) { setShowApiSetup(true); return; }
    setParsing(true); setParseError(""); setParsed(null);
    try {
      const result = await parseWithAI(quickText, apiKey);
      if (!result.amount || !result.type || !result.category) throw new Error("Datos incompletos");
      setParsed(result);
    } catch (e) {
      setParseError("No entendí bien. Intenta: 'Gasté 200 en comida' o 'Recibí 1500 de trabajo'");
    }
    setParsing(false);
  };

  const totalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;
  const filtered = filterType === "all" ? transactions : transactions.filter(t => t.type === filterType);
  const expenseByCategory = transactions.filter(t => t.type === "expense").reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {});
  const topCategory = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1])[0];
  const isManualValid = manualForm.amount && parseFloat(manualForm.amount) > 0 && manualForm.category && manualForm.note.trim();

  const s = {
    app: { fontFamily: "'Inter', system-ui, sans-serif", background: "#0f1117", minHeight: "100vh", color: "#f1f5f9", maxWidth: 430, margin: "0 auto", position: "relative", paddingBottom: 80 },
    header: { padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" },
    title: { fontSize: 18, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.3px" },
    balanceCard: { margin: "16px 16px 0", borderRadius: 20, padding: "24px 24px 20px", background: balance >= 0 ? "linear-gradient(135deg, #1a2e1a 0%, #0d1f0d 100%)" : "linear-gradient(135deg, #2e1a1a 0%, #1f0d0d 100%)", border: `1px solid ${balance >= 0 ? "#2d5a2d" : "#5a2d2d"}` },
    balanceLabel: { fontSize: 12, color: "#94a3b8", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 },
    balanceAmount: { fontSize: 38, fontWeight: 800, letterSpacing: "-1px", color: balance >= 0 ? "#4ade80" : "#f87171", lineHeight: 1.1 },
    statsRow: { display: "flex", gap: 10, marginTop: 16 },
    statBox: { flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "10px 12px" },
    statLabel: { fontSize: 11, color: "#64748b", marginBottom: 2, fontWeight: 500 },
    section: { margin: "20px 16px 0" },
    sectionTitle: { fontSize: 13, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10 },
    txCard: { background: "#1a1f2e", borderRadius: 14, padding: "13px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 },
    txIcon: { fontSize: 22, width: 40, height: 40, background: "#0f1117", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
    txInfo: { flex: 1, minWidth: 0 },
    txNote: { fontSize: 14, fontWeight: 600, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    txMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
    fab: { position: "fixed", bottom: 88, right: "calc(50% - 215px + 20px)", width: 56, height: 56, borderRadius: 28, background: "#6366f1", border: "none", color: "#fff", fontSize: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(99,102,241,0.5)", zIndex: 10 },
    navbar: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#1a1f2e", borderTop: "1px solid #252b3b", display: "flex", zIndex: 20, padding: "8px 0 12px" },
    modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 30, display: "flex", alignItems: "flex-end" },
    modalCard: { background: "#1a1f2e", borderRadius: "24px 24px 0 0", padding: "24px 20px 40px", width: "100%", maxWidth: 430, margin: "0 auto", maxHeight: "90vh", overflowY: "auto" },
    input: { width: "100%", background: "#0f1117", border: "1px solid #252b3b", borderRadius: 12, padding: "12px 14px", color: "#f1f5f9", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" },
    textarea: { width: "100%", background: "#0f1117", border: "1px solid #252b3b", borderRadius: 12, padding: "14px", color: "#f1f5f9", fontSize: 15, outline: "none", resize: "none", fontFamily: "inherit", boxSizing: "border-box", minHeight: 80 },
    btn: (color) => ({ width: "100%", background: color || "#6366f1", border: "none", borderRadius: 14, padding: "14px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 10 }),
    btnOutline: { width: "100%", background: "transparent", border: "1px solid #252b3b", borderRadius: 14, padding: "13px", color: "#94a3b8", fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 8 },
    chip: (active) => ({ padding: "7px 14px", borderRadius: 20, border: `1px solid ${active ? "#6366f1" : "#252b3b"}`, background: active ? "#6366f122" : "transparent", color: active ? "#818cf8" : "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" }),
    typeToggle: { display: "flex", background: "#0f1117", borderRadius: 12, padding: 4, gap: 4, marginBottom: 16 },
    typeBtn: (active, color) => ({ flex: 1, padding: "9px", borderRadius: 9, border: "none", background: active ? color : "transparent", color: active ? "#fff" : "#64748b", fontSize: 14, fontWeight: 700, cursor: "pointer" }),
    catGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 },
    catBtn: (active) => ({ padding: "10px 8px", borderRadius: 10, border: `1px solid ${active ? "#6366f1" : "#252b3b"}`, background: active ? "#6366f122" : "transparent", color: active ? "#818cf8" : "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "center" }),
    label: { fontSize: 13, color: "#94a3b8", fontWeight: 600, marginBottom: 6, display: "block" },
    toast: (type) => ({ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: type === "success" ? "#1a2e1a" : "#1a1f2e", border: `1px solid ${type === "success" ? "#2d5a2d" : "#252b3b"}`, color: "#f1f5f9", padding: "10px 20px", borderRadius: 20, fontSize: 14, fontWeight: 600, zIndex: 99, whiteSpace: "nowrap" }),
    emptyState: { textAlign: "center", padding: "40px 20px", color: "#475569" },
    navBtn: (active) => ({ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: active ? "#6366f1" : "#475569", padding: "4px 0" }),
  };

  return (
    <div style={s.app}>
      {toast && <div style={s.toast(toast.type)}>{toast.msg}</div>}

      {/* API Key Setup Modal */}
      {showApiSetup && (
        <div style={s.modal} onClick={() => setShowApiSetup(false)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>🔑 Configura tu API Key</div>
            <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>
              Para usar el registro con IA necesitas una API Key de Anthropic. Obtén una gratis en{" "}
              <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: "#818cf8" }}>console.anthropic.com</a>
            </p>
            <label style={s.label}>Tu API Key</label>
            <input type="password" style={{ ...s.input, marginBottom: 4 }} placeholder="sk-ant-..." value={apiKey} onChange={e => setApiKey(e.target.value)} />
            <p style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>Se guarda localmente en tu dispositivo, nunca se envía a ningún servidor externo excepto Anthropic.</p>
            <button style={s.btn()} onClick={saveApiKey} disabled={!apiKey.startsWith("sk-")}>Guardar API Key</button>
            <button style={s.btnOutline} onClick={() => setShowApiSetup(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* HOME */}
      {view === "home" && (
        <>
          <div style={s.header}>
            <span style={s.title}>Mis Finanzas</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#475569" }}>{new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" })}</span>
              <button onClick={() => setShowApiSetup(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }} title="Configurar API Key">⚙️</button>
            </div>
          </div>
          <div style={s.balanceCard}>
            <div style={s.balanceLabel}>Balance actual</div>
            <div style={s.balanceAmount}>{formatMXN(balance)}</div>
            <div style={s.statsRow}>
              <div style={s.statBox}>
                <div style={s.statLabel}>↑ Ingresos</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#4ade80" }}>{formatMXN(totalIncome)}</div>
              </div>
              <div style={s.statBox}>
                <div style={s.statLabel}>↓ Gastos</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#f87171" }}>{formatMXN(totalExpense)}</div>
              </div>
            </div>
          </div>
          {topCategory && (
            <div style={s.section}>
              <div style={s.sectionTitle}>Mayor gasto</div>
              <div style={{ background: "#1a1f2e", borderRadius: 14, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, color: "#94a3b8" }}>{CATEGORY_ICONS[topCategory[0]]} {topCategory[0]}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#f87171" }}>{formatMXN(topCategory[1])}</span>
              </div>
            </div>
          )}
          <div style={s.section}>
            <div style={s.sectionTitle}>Recientes</div>
            {transactions.length === 0 ? (
              <div style={s.emptyState}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📊</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Sin movimientos aún</div>
                <div style={{ fontSize: 13 }}>Toca + para registrar tu primer movimiento</div>
              </div>
            ) : transactions.slice(0, 5).map(tx => (
              <div key={tx.id} style={s.txCard}>
                <div style={s.txIcon}>{CATEGORY_ICONS[tx.category]}</div>
                <div style={s.txInfo}>
                  <div style={s.txNote}>{tx.note}</div>
                  <div style={s.txMeta}>{tx.category} · {formatDate(tx.date)}</div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: tx.type === "income" ? "#4ade80" : "#f87171", flexShrink: 0 }}>
                  {tx.type === "income" ? "+" : "-"}{formatMXN(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* HISTORY */}
      {view === "history" && (
        <>
          <div style={s.header}><span style={s.title}>Historial</span></div>
          <div style={{ ...s.section, display: "flex", gap: 8 }}>
            {[["all", "Todos"], ["income", "Ingresos"], ["expense", "Gastos"]].map(([val, label]) => (
              <button key={val} style={s.chip(filterType === val)} onClick={() => setFilterType(val)}>{label}</button>
            ))}
          </div>
          <div style={{ ...s.section, marginTop: 14 }}>
            {filtered.length === 0 ? (
              <div style={s.emptyState}><div style={{ fontSize: 13 }}>Sin movimientos</div></div>
            ) : filtered.map(tx => (
              <div key={tx.id} style={s.txCard}>
                <div style={s.txIcon}>{CATEGORY_ICONS[tx.category]}</div>
                <div style={s.txInfo}>
                  <div style={s.txNote}>{tx.note}</div>
                  <div style={s.txMeta}>{tx.category} · {formatDate(tx.date)}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: tx.type === "income" ? "#4ade80" : "#f87171" }}>
                    {tx.type === "income" ? "+" : "-"}{formatMXN(tx.amount)}
                  </div>
                  <button onClick={() => deleteTransaction(tx.id)} style={{ background: "none", border: "none", color: "#475569", fontSize: 14, cursor: "pointer", padding: 0 }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* FAB */}
      {(view === "home" || view === "history") && (
        <button style={s.fab} onClick={() => setView("add")}>+</button>
      )}

      {/* NAVBAR */}
      <nav style={s.navbar}>
        {[["home", "🏠", "Inicio"], ["history", "📋", "Historial"]].map(([v, icon, label]) => (
          <button key={v} style={s.navBtn(view === v)} onClick={() => setView(v)}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ fontSize: 10, fontWeight: view === v ? 700 : 500 }}>{label}</span>
          </button>
        ))}
      </nav>

      {/* ADD MODAL */}
      {view === "add" && (
        <div style={s.modal} onClick={() => { setView("home"); setParsed(null); setParseError(""); setQuickText(""); }}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Registrar movimiento</div>
            <label style={s.label}>✨ Registro rápido con IA</label>
            <textarea ref={inputRef} style={s.textarea}
              placeholder={'Describe tu movimiento...\n"Gasté 200 en comida"\n"Recibí 3000 de mi trabajo"'}
              value={quickText} onChange={e => { setQuickText(e.target.value); setParsed(null); setParseError(""); }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleQuickParse(); } }}
            />
            {parseError && <div style={{ color: "#f87171", fontSize: 13, marginTop: 10, padding: "10px 14px", background: "#2e1a1a", borderRadius: 10 }}>{parseError}</div>}
            {parsed && (
              <div style={{ background: "#0f1117", borderRadius: 14, padding: 16, marginTop: 14 }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, fontWeight: 600 }}>IA detectó:</div>
                {[["Tipo", parsed.type === "income" ? "↑ Ingreso" : "↓ Gasto", parsed.type === "income" ? "#4ade80" : "#f87171"], ["Monto", formatMXN(parsed.amount), "#f1f5f9"], ["Categoría", `${CATEGORY_ICONS[parsed.category]} ${parsed.category}`, "#f1f5f9"], ["Nota", parsed.note, "#f1f5f9"]].map(([k, v, c]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ color: "#94a3b8", fontSize: 13 }}>{k}</span>
                    <span style={{ color: c, fontWeight: 700, fontSize: 13 }}>{v}</span>
                  </div>
                ))}
                <button style={s.btn(parsed.type === "income" ? "#16a34a" : "#dc2626")} onClick={() => addTransaction(parsed)}>Confirmar y guardar</button>
                <button style={s.btnOutline} onClick={() => setParsed(null)}>Corregir</button>
              </div>
            )}
            {!parsed && (
              <button style={s.btn(parsing || !quickText.trim() ? "#374151" : "#6366f1")} onClick={handleQuickParse} disabled={parsing || !quickText.trim()}>
                {parsing ? "⏳ Analizando..." : "Analizar con IA →"}
              </button>
            )}
            {!apiKeySaved && (
              <p style={{ fontSize: 12, color: "#475569", textAlign: "center", marginTop: 8 }}>
                ⚙️ <span style={{ cursor: "pointer", color: "#818cf8" }} onClick={() => setShowApiSetup(true)}>Configura tu API Key</span> para usar la IA
              </p>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 16px" }}>
              <div style={{ flex: 1, height: 1, background: "#252b3b" }} />
              <span style={{ color: "#475569", fontSize: 12 }}>o registra manualmente</span>
              <div style={{ flex: 1, height: 1, background: "#252b3b" }} />
            </div>
            <div style={s.typeToggle}>
              <button style={s.typeBtn(manualForm.type === "expense", "#dc2626")} onClick={() => setManualForm(f => ({ ...f, type: "expense", category: "" }))}>↓ Gasto</button>
              <button style={s.typeBtn(manualForm.type === "income", "#16a34a")} onClick={() => setManualForm(f => ({ ...f, type: "income", category: "" }))}>↑ Ingreso</button>
            </div>
            <label style={s.label}>Monto (MXN)</label>
            <input type="number" style={{ ...s.input, marginBottom: 14 }} placeholder="0.00" value={manualForm.amount} onChange={e => setManualForm(f => ({ ...f, amount: e.target.value }))} inputMode="decimal" />
            <label style={s.label}>Categoría</label>
            <div style={s.catGrid}>
              {CATEGORIES[manualForm.type].map(cat => (
                <button key={cat} style={s.catBtn(manualForm.category === cat)} onClick={() => setManualForm(f => ({ ...f, category: cat }))}>
                  {CATEGORY_ICONS[cat]} {cat}
                </button>
              ))}
            </div>
            <label style={s.label}>Nota</label>
            <input type="text" style={{ ...s.input, marginBottom: 4 }} placeholder="Ej. Súper del lunes" value={manualForm.note} onChange={e => setManualForm(f => ({ ...f, note: e.target.value }))} maxLength={40} />
            <button style={s.btn(isManualValid ? (manualForm.type === "income" ? "#16a34a" : "#dc2626") : "#374151")} disabled={!isManualValid} onClick={() => addTransaction(manualForm)}>
              Guardar movimiento
            </button>
            <button style={s.btnOutline} onClick={() => { setView("home"); setParsed(null); setParseError(""); setQuickText(""); }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
