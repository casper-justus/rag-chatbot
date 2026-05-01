import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I'm your knowledge base assistant. Ask me anything about Acme Corp — our products, policies, team, or anything else in our documentation.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

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

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      let assistantMessage = data.answer;

      if (data.sources && data.sources.length > 0) {
        assistantMessage += "\n\n---\n**Sources:**\n";
        data.sources.forEach((src, i) => {
          const sourceName = src.source.split("/").pop();
          assistantMessage += `\n${i + 1}. *${sourceName}*: "${src.content}..."`;
        });
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: assistantMessage },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${err.message}. Make sure the backend is running and documents have been ingested.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>Knowledge Base Chatbot</h1>
          <span style={styles.badge}>RAG-powered</span>
        </div>
      </header>

      <div style={styles.messages}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.messageRow,
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                ...styles.message,
                ...(msg.role === "user"
                  ? styles.userMessage
                  : styles.assistantMessage),
              }}
            >
              {msg.role === "assistant" ? (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => (
                      <p style={{ marginBottom: 8, lineHeight: 1.6 }}>
                        {children}
                      </p>
                    ),
                    strong: ({ children }) => (
                      <strong style={{ color: "#fff" }}>{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em style={{ color: "#a0a0a0" }}>{children}</em>
                    ),
                    ul: ({ children }) => (
                      <ul style={{ marginLeft: 20, marginBottom: 8 }}>
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol style={{ marginLeft: 20, marginBottom: 8 }}>
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li style={{ marginBottom: 4, lineHeight: 1.5 }}>
                        {children}
                      </li>
                    ),
                    code: ({ children }) => (
                      <code style={styles.inlineCode}>{children}</code>
                    ),
                    hr: () => (
                      <hr
                        style={{
                          border: "none",
                          borderTop: "1px solid #333",
                          margin: "12px 0",
                        }}
                      />
                    ),
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ ...styles.messageRow, justifyContent: "flex-start" }}>
            <div style={styles.assistantMessage}>
              <div style={styles.dots}>
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div style={styles.inputArea}>
        <div style={styles.inputContainer}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about products, policies, company info..."
            style={styles.textarea}
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              ...styles.sendButton,
              ...(loading || !input.trim() ? styles.sendButtonDisabled : {}),
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p style={styles.hint}>
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    maxWidth: 900,
    margin: "0 auto",
  },
  header: {
    padding: "16px 24px",
    borderBottom: "1px solid #222",
    background: "#141414",
  },
  headerContent: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: "#fff",
  },
  badge: {
    background: "#1a3a2a",
    color: "#4ade80",
    padding: "3px 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 500,
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  messageRow: {
    display: "flex",
    width: "100%",
  },
  message: {
    maxWidth: "80%",
    padding: "12px 16px",
    borderRadius: 12,
    fontSize: 14,
  },
  userMessage: {
    background: "#2563eb",
    color: "#fff",
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    background: "#1e1e1e",
    color: "#e0e0e0",
    borderBottomLeftRadius: 4,
  },
  inlineCode: {
    background: "#2a2a2a",
    padding: "2px 6px",
    borderRadius: 4,
    fontFamily: "monospace",
    fontSize: 13,
  },
  dots: {
    display: "flex",
    gap: 6,
    padding: "4px 0",
    "& span": {
      width: 8,
      height: 8,
      background: "#555",
      borderRadius: "50%",
      animation: "pulse 1.4s infinite ease-in-out",
    },
    "& span:nth-child(1)": { animationDelay: "-0.32s" },
    "& span:nth-child(2)": { animationDelay: "-0.16s" },
  },
  inputArea: {
    padding: "16px 24px 20px",
    borderTop: "1px solid #222",
    background: "#141414",
  },
  inputContainer: {
    display: "flex",
    gap: 12,
    alignItems: "flex-end",
    background: "#1e1e1e",
    borderRadius: 16,
    padding: 12,
    border: "1px solid #333",
  },
  textarea: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#e0e0e0",
    fontSize: 14,
    resize: "none",
    fontFamily: "inherit",
    lineHeight: 1.5,
    maxHeight: 120,
  },
  sendButton: {
    background: "#2563eb",
    border: "none",
    borderRadius: 10,
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "#fff",
    transition: "background 0.2s",
  },
  sendButtonDisabled: {
    background: "#333",
    cursor: "not-allowed",
    color: "#666",
  },
  hint: {
    textAlign: "center",
    color: "#555",
    fontSize: 12,
    marginTop: 8,
  },
};

export default App;
