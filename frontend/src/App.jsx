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
  const [health, setHealth] = useState("checking");
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState(null);
  const [focused, setFocused] = useState(false);

  // Input history (like a terminal)
  const historyRef = useRef([]);      // sent messages
  const histIdxRef = useRef(-1);      // -1 = live input
  const draftRef = useRef("");        // saves unsent draft when navigating

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
    const id = setInterval(checkHealth, 30000);
    return () => clearInterval(id);
  }, [checkHealth]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    // Push to front of history, deduplicate
    historyRef.current = [userMessage, ...historyRef.current.filter((m) => m !== userMessage)].slice(0, 50);
    histIdxRef.current = -1;
    draftRef.current = "";
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
      let reply = data.answer;
      if (data.sources?.length > 0) {
        reply += "\n\n---\n**Sources:**\n";
        data.sources.forEach((src, i) => {
          reply += `\n${i + 1}. *${src.source.split("/").pop()}*: "${src.content}..."`;
        });
      }
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
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
      setIngestMsg(res.ok
        ? { type: "ok", text: data.message || "Ingestion complete" }
        : { type: "err", text: data.detail || "Ingestion failed" });
    } catch (err) {
      setIngestMsg({ type: "err", text: err.message });
    } finally {
      setIngesting(false);
      setTimeout(() => setIngestMsg(null), 4000);
    }
  };

  const handleKeyDown = (e) => {
    const history = historyRef.current;

    if (e.key === "ArrowUp") {
      if (history.length === 0) return;
      e.preventDefault();
      if (histIdxRef.current === -1) draftRef.current = input; // save draft
      const next = Math.min(histIdxRef.current + 1, history.length - 1);
      histIdxRef.current = next;
      setInput(history[next]);
      return;
    }

    if (e.key === "ArrowDown") {
      if (histIdxRef.current === -1) return;
      e.preventDefault();
      const next = histIdxRef.current - 1;
      histIdxRef.current = next;
      setInput(next === -1 ? draftRef.current : history[next]);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const healthColor = { checking: "#64748b", ok: "#4ade80", error: "#f87171" }[health];
  const healthLabel = { checking: "Checking…", ok: "Online", error: "Offline" }[health];

  return (
    <div style={s.root}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.logo}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <span style={s.title}>Knowledge Base</span>
          <span style={s.badge}>RAG · Gemini</span>
        </div>
        <div style={s.headerRight}>
          <div style={s.healthPill}>
            <span style={{ ...s.healthDot, background: healthColor }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: healthColor }}>{healthLabel}</span>
          </div>
          <button onClick={runIngest} disabled={ingesting}
            style={{ ...s.ingestBtn, ...(ingesting ? s.ingestBtnOff : {}) }}
            title="Re-run document ingestion">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: ingesting ? "spin 1s linear infinite" : "none" }}>
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-4" />
            </svg>
            {ingesting ? "Ingesting…" : "Re-ingest"}
          </button>
        </div>
      </header>

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
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
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
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
              </svg>
            </div>
            <div style={s.aiBubble}>
              <div style={s.typing}><span /><span /><span /></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={s.inputWrap}>
        <div style={{ ...s.inputBox, ...(focused ? s.inputBoxFocused : {}) }}>
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              histIdxRef.current = -1; // any manual edit resets history cursor
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Ask anything… (↑↓ for history)"
            style={s.textarea}
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              ...s.sendBtn,
              ...(input.trim() && !loading ? s.sendBtnActive : s.sendBtnOff),
            }}
            title="Send (Enter)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p style={s.hint}>↑↓ history · Enter send · Shift+Enter newline</p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink {
          0%, 80%, 100% { opacity: 0.15; transform: scale(0.75); }
          40% { opacity: 1; transform: scale(1); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f0f13; font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; }
        textarea::placeholder { color: #334155; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
      `}</style>
    </div>
  );
}

const s = {
  root: { display: "flex", flexDirection: "column", height: "100vh", maxWidth: 860, margin: "0 auto", color: "#cbd5e1" },

  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #1e293b", background: "#0f0f13" },
  headerLeft: { display: "flex", alignItems: "center", gap: 9 },
  headerRight: { display: "flex", alignItems: "center", gap: 8 },
  logo: { width: 30, height: 30, borderRadius: 7, background: "#1e1b4b", display: "flex", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 14, fontWeight: 600, color: "#e2e8f0", letterSpacing: "-0.01em" },
  badge: { fontSize: 10, fontWeight: 500, color: "#818cf8", background: "#1e1b4b", padding: "2px 7px", borderRadius: 20, border: "1px solid #312e81" },

  healthPill: { display: "flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 20, background: "#0f172a", border: "1px solid #1e293b" },
  healthDot: { width: 6, height: 6, borderRadius: "50%" },

  ingestBtn: { display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500, color: "#64748b", background: "transparent", border: "1px solid #1e293b", borderRadius: 7, padding: "4px 10px", cursor: "pointer", transition: "color 0.15s, border-color 0.15s" },
  ingestBtnOff: { opacity: 0.45, cursor: "not-allowed" },

  toast: { margin: "6px 20px 0", padding: "7px 13px", borderRadius: 7, border: "1px solid", fontSize: 12, fontWeight: 500 },

  messages: { flex: 1, overflowY: "auto", padding: "22px 20px", display: "flex", flexDirection: "column", gap: 18 },
  row: { display: "flex", alignItems: "flex-start", gap: 9, width: "100%" },
  avatar: { width: 26, height: 26, borderRadius: 7, background: "#1e1b4b", border: "1px solid #312e81", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 },
  bubble: { maxWidth: "78%", padding: "9px 13px", borderRadius: 11, fontSize: 14, lineHeight: 1.6 },
  userBubble: { background: "linear-gradient(135deg, #3730a3, #4f46e5)", color: "#fff", borderBottomRightRadius: 3, marginLeft: "auto" },
  aiBubble: { background: "#131929", color: "#cbd5e1", borderBottomLeftRadius: 3, border: "1px solid #1e293b" },
  code: { background: "#0f172a", color: "#a5f3fc", padding: "1px 5px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, border: "1px solid #1e293b" },
  typing: { display: "flex", gap: 4, padding: "3px 1px", alignItems: "center" },

  // Minimal input
  inputWrap: { padding: "10px 20px 16px", borderTop: "1px solid #1e293b", background: "#0f0f13" },
  inputBox: { display: "flex", alignItems: "flex-end", gap: 6, borderBottom: "1px solid #1e293b", paddingBottom: 6, transition: "border-color 0.15s" },
  inputBoxFocused: { borderColor: "#312e81" },
  textarea: { flex: 1, background: "transparent", border: "none", outline: "none", color: "#e2e8f0", fontSize: 14, resize: "none", fontFamily: "inherit", lineHeight: 1.5, maxHeight: 120, paddingBottom: 2 },

  // Ghost send button — just the icon, minimal
  sendBtn: { background: "transparent", border: "none", padding: "4px 6px", borderRadius: 6, cursor: "pointer", transition: "color 0.15s", flexShrink: 0, lineHeight: 0 },
  sendBtnActive: { color: "#818cf8" },
  sendBtnOff: { color: "#1e293b", cursor: "not-allowed" },

  hint: { textAlign: "center", color: "#1e293b", fontSize: 10, marginTop: 6, letterSpacing: "0.02em" },
};
