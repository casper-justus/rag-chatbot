import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm your knowledge base assistant. Ask me anything about Acme Corp — our products, policies, team, or anything else in our documentation.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState("checking"); // "checking" | "ok" | "error"
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState(null);
  const messagesEndRef = useRef(null);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/health`);
      setHealth(res.ok ? "ok" : "error");
    } catch {
      setHealth("error");
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      let assistantMessage = data.answer;
      if (data.sources?.length > 0) {
        assistantMessage += "\n\n---\n**Sources:**\n";
        data.sources.forEach((src, i) => {
          const name = src.source.split("/").pop();
          assistantMessage += `\n${i + 1}. *${name}*: "${src.content}..."`;
        });
      }
      setMessages((prev) => [...prev, { role: "assistant", content: assistantMessage }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const runIngest = async () => {
    setIngesting(true);
    setIngestMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/ingest`, { method: "POST" });
      const data = await res.json();
      setIngestMsg(res.ok ? { type: "ok", text: data.message || "Ingestion complete" } : { type: "err", text: data.detail || "Ingestion failed" });
    } catch (err) {
      setIngestMsg({ type: "err", text: err.message });
    } finally {
      setIngesting(false);
      setTimeout(() => setIngestMsg(null), 4000);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const healthColor = { checking: "#888", ok: "#4ade80", error: "#f87171" }[health];
  const healthLabel = { checking: "Checking…", ok: "Backend online", error: "Backend offline" }[health];

  return (
    <div style={s.root}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.logo}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <span style={s.title}>Knowledge Base</span>
          <span style={s.badge}>RAG · Gemini</span>
        </div>
        <div style={s.headerRight}>
          {/* Health pill */}
          <div style={s.healthPill}>
            <span style={{ ...s.healthDot, background: healthColor }} />
            <span style={{ ...s.healthText, color: healthColor }}>{healthLabel}</span>
          </div>
          {/* Re-ingest button */}
          <button onClick={runIngest} disabled={ingesting} style={{ ...s.ingestBtn, ...(ingesting ? s.ingestBtnDisabled : {}) }} title="Re-run document ingestion">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: ingesting ? "spin 1s linear infinite" : "none" }}>
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-4" />
            </svg>
            {ingesting ? "Ingesting…" : "Re-ingest"}
          </button>
        </div>
      </header>

      {/* Ingest toast */}
      {ingestMsg && (
        <div style={{ ...s.toast, background: ingestMsg.type === "ok" ? "#14532d" : "#450a0a", borderColor: ingestMsg.type === "ok" ? "#4ade80" : "#f87171" }}>
          {ingestMsg.type === "ok" ? "✓" : "✗"} {ingestMsg.text}
        </div>
      )}

      {/* Messages */}
      <div style={s.messages}>
        {messages.map((msg, i) => (
          <div key={i} style={{ ...s.row, justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            {msg.role === "assistant" && (
              <div style={s.avatar}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                </svg>
              </div>
            )}
            <div style={{ ...s.bubble, ...(msg.role === "user" ? s.userBubble : s.aiBubble) }}>
              {msg.role === "assistant" ? (
                <ReactMarkdown components={{
                  p: ({ children }) => <p style={{ margin: "0 0 8px", lineHeight: 1.65 }}>{children}</p>,
                  strong: ({ children }) => <strong style={{ color: "#e2e8f0" }}>{children}</strong>,
                  em: ({ children }) => <em style={{ color: "#94a3b8" }}>{children}</em>,
                  code: ({ children }) => <code style={s.code}>{children}</code>,
                  hr: () => <hr style={{ border: "none", borderTop: "1px solid #334155", margin: "10px 0" }} />,
                  ul: ({ children }) => <ul style={{ paddingLeft: 18, margin: "0 0 8px" }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ paddingLeft: 18, margin: "0 0 8px" }}>{children}</ol>,
                  li: ({ children }) => <li style={{ marginBottom: 3, lineHeight: 1.5 }}>{children}</li>,
                }}>{msg.content}</ReactMarkdown>
              ) : msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ ...s.row, justifyContent: "flex-start" }}>
            <div style={s.avatar}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
              </svg>
            </div>
            <div style={s.aiBubble}><div style={s.typing}><span /><span /><span /></div></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={s.inputWrap}>
        <div style={s.inputBox}>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Ask anything about your knowledge base…" style={s.textarea} rows={1} />
          <button onClick={sendMessage} disabled={loading || !input.trim()}
            style={{ ...s.sendBtn, ...(loading || !input.trim() ? s.sendBtnOff : {}) }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p style={s.hint}>Enter to send · Shift+Enter for new line</p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f0f13; font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
      `}</style>
    </div>
  );
}

const s = {
  root: { display: "flex", flexDirection: "column", height: "100vh", maxWidth: 860, margin: "0 auto", color: "#cbd5e1" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #1e293b", background: "#0f0f13", gap: 12 },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  logo: { width: 32, height: 32, borderRadius: 8, background: "#1e1b4b", display: "flex", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: 600, color: "#e2e8f0", letterSpacing: "-0.01em" },
  badge: { fontSize: 11, fontWeight: 500, color: "#818cf8", background: "#1e1b4b", padding: "2px 8px", borderRadius: 20, border: "1px solid #312e81" },
  healthPill: { display: "flex", alignItems: "center", gap: 6, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 20, padding: "4px 10px" },
  healthDot: { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },
  healthText: { fontSize: 11, fontWeight: 500 },
  ingestBtn: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "#94a3b8", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "5px 12px", cursor: "pointer", transition: "all 0.15s" },
  ingestBtnDisabled: { opacity: 0.5, cursor: "not-allowed" },
  toast: { margin: "8px 20px 0", padding: "8px 14px", borderRadius: 8, border: "1px solid", fontSize: 13, fontWeight: 500 },
  messages: { flex: 1, overflowY: "auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20 },
  row: { display: "flex", alignItems: "flex-start", gap: 10, width: "100%" },
  avatar: { width: 28, height: 28, borderRadius: 8, background: "#1e1b4b", border: "1px solid #312e81", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 },
  bubble: { maxWidth: "78%", padding: "10px 14px", borderRadius: 12, fontSize: 14, lineHeight: 1.6 },
  userBubble: { background: "linear-gradient(135deg, #3730a3, #4f46e5)", color: "#fff", borderBottomRightRadius: 3, marginLeft: "auto" },
  aiBubble: { background: "#131929", color: "#cbd5e1", borderBottomLeftRadius: 3, border: "1px solid #1e293b" },
  code: { background: "#0f172a", color: "#a5f3fc", padding: "1px 6px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, border: "1px solid #1e293b" },
  typing: { display: "flex", gap: 5, padding: "4px 2px", alignItems: "center" },
  inputWrap: { padding: "12px 20px 18px", borderTop: "1px solid #1e293b", background: "#0f0f13" },
  inputBox: { display: "flex", gap: 10, alignItems: "flex-end", background: "#131929", borderRadius: 14, padding: "10px 10px 10px 14px", border: "1px solid #1e293b" },
  textarea: { flex: 1, background: "transparent", border: "none", outline: "none", color: "#e2e8f0", fontSize: 14, resize: "none", fontFamily: "inherit", lineHeight: 1.5, maxHeight: 120 },
  sendBtn: { background: "linear-gradient(135deg, #3730a3, #4f46e5)", border: "none", borderRadius: 9, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff", flexShrink: 0 },
  sendBtnOff: { background: "#1e293b", cursor: "not-allowed", color: "#475569" },
  hint: { textAlign: "center", color: "#334155", fontSize: 11, marginTop: 7 },
};
