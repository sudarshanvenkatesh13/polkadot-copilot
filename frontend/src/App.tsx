import { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import Dashboard from "./Dashboard";
import { API_BASE } from "./config";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

interface CodeResult {
  explanation: string;
  code: string;
  setup: string;
  next_steps: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"chat" | "code" | "dashboard">("chat");

  // Chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hey! I'm **PolkadotCopilot** 👋 Ask me anything about Polkadot, parachains, XCM, Substrate, staking — I've got you covered.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Code generator state
  const [intent, setIntent] = useState("");
  const [codeResult, setCodeResult] = useState<CodeResult | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const question = input;
    const userMessage: Message = { role: "user", content: question };

    setChatError("");
    setMessages((prev) => [...prev, userMessage, { role: "assistant", content: "", sources: [] }]);
    setInput("");
    setLoading(true);

    try {
      const history = messages
        .filter((m) => m.content)
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });

      if (!response.ok || !response.body) throw new Error("Request failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value, { stream: true }).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) {
              setChatError("Something went wrong. Please try again.");
              break;
            }
            if (data.token) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = { ...last, content: last.content + data.token };
                return updated;
              });
            }
            if (data.sources) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], sources: data.sources };
                return updated;
              });
            }
          } catch {
            // incomplete JSON chunk, skip
          }
        }
      }
    } catch {
      setChatError("Couldn't reach the backend. Make sure it's running.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const generateCode = async () => {
    if (!intent.trim() || codeLoading) return;
    setCodeLoading(true);
    setCodeResult(null);
    setCodeError("");
    try {
      const response = await axios.post(`${API_BASE}/generate`, { intent });
      setCodeResult(response.data);
    } catch {
      setCodeError("Generation failed. Make sure the backend is running and try again.");
    } finally {
      setCodeLoading(false);
    }
  };

  const copyCode = () => {
    if (codeResult?.code) {
      navigator.clipboard.writeText(codeResult.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>⬡</div>
          <div>
            <div style={styles.headerTitle}>PolkadotCopilot</div>
            <div style={styles.headerSubtitle}>AI Developer Assistant for the Polkadot Ecosystem</div>
          </div>
        </div>
        <div style={styles.tabs}>
          {(["chat", "code", "dashboard"] as const).map((tab) => (
            <button
              key={tab}
              style={{ ...styles.tab, ...(activeTab === tab ? styles.activeTab : {}) }}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "chat" ? "💬 Ask Anything" : tab === "code" ? "⚡ Code Generator" : "📊 Friction Map"}
            </button>
          ))}
        </div>
        <div style={styles.badge}>Powered by RAG</div>
      </div>

      {/* CHAT TAB */}
      {activeTab === "chat" && (
        <>
          <div style={styles.chatArea}>
            {messages.map((msg, i) => (
              <div
                key={`${msg.role}-${i}`}
                style={{ ...styles.messageRow, justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}
              >
                {msg.role === "assistant" && <div style={styles.avatar}>⬡</div>}
                <div style={{ ...styles.bubble, ...(msg.role === "user" ? styles.userBubble : styles.assistantBubble) }}>
                  {msg.content ? (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : (
                    <span style={styles.typing}>
                      <span style={styles.dot} />
                      <span style={styles.dot} />
                      <span style={styles.dot} />
                    </span>
                  )}
                  {msg.sources && msg.sources.length > 0 && (
                    <div style={styles.sources}>
                      <span style={styles.sourcesLabel}>Sources: </span>
                      {msg.sources.map((src) => (
                        <a key={src} href={src} target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>
                          {src.split("/").pop()}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatError && <div style={styles.errorBanner}>{chatError}</div>}
            <div ref={bottomRef} />
          </div>

          {messages.length === 1 && (
            <div style={styles.suggestions}>
              {[
                "What is a parachain?",
                "How does XCM work?",
                "How do I start building on Polkadot?",
                "What is the difference between Polkadot and Kusama?",
              ].map((q) => (
                <button key={q} style={styles.suggestionBtn} onClick={() => setInput(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <div style={styles.inputArea}>
            <textarea
              style={styles.input}
              placeholder="Ask anything about Polkadot..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              style={{ ...styles.sendBtn, opacity: loading || !input.trim() ? 0.5 : 1 }}
              onClick={sendMessage}
              disabled={loading || !input.trim()}
            >
              Send
            </button>
          </div>
        </>
      )}

      {/* CODE GENERATOR TAB */}
      {activeTab === "code" && (
        <div style={styles.codeContainer}>
          <div style={styles.codeHeader}>
            <div style={styles.codeHeaderTitle}>⚡ Intent to Code</div>
            <div style={styles.codeHeaderSubtitle}>
              Describe what you want to build in plain English — get working Polkadot starter code instantly
            </div>
          </div>

          <div style={styles.intentExamples}>
            {[
              "Build a pallet that tracks token balances",
              "Create a parachain that handles NFT transfers",
              "Build a staking mechanism with rewards",
              "Create a governance voting system",
            ].map((ex) => (
              <button key={ex} style={styles.exampleBtn} onClick={() => setIntent(ex)}>
                {ex}
              </button>
            ))}
          </div>

          <div style={styles.intentInputRow}>
            <textarea
              style={styles.intentInput}
              placeholder="e.g. I want to build a pallet that tracks token balances across accounts..."
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              rows={3}
            />
            <button
              style={{ ...styles.generateBtn, opacity: codeLoading || !intent.trim() ? 0.5 : 1 }}
              onClick={generateCode}
              disabled={codeLoading || !intent.trim()}
            >
              {codeLoading ? (
                <span>
                  <span style={styles.dot} />
                  <span style={styles.dot} />
                  <span style={styles.dot} />
                </span>
              ) : (
                "Generate Code ⚡"
              )}
            </button>
          </div>

          {codeError && <div style={styles.errorBanner}>{codeError}</div>}

          {codeResult && (
            <div style={styles.codeResults}>
              <div style={styles.resultSection}>
                <div style={styles.resultLabel}>📖 Explanation</div>
                <div style={styles.resultText}>{codeResult.explanation}</div>
              </div>

              <div style={styles.resultSection}>
                <div style={styles.resultLabel}>🛠 Setup Commands</div>
                <SyntaxHighlighter language="bash" style={vscDarkPlus} customStyle={styles.highlighter}>
                  {codeResult.setup}
                </SyntaxHighlighter>
              </div>

              <div style={styles.resultSection}>
                <div style={styles.resultLabelRow}>
                  <div style={styles.resultLabel}>💻 Starter Code</div>
                  <button style={styles.copyBtn} onClick={copyCode}>
                    {copied ? "✅ Copied!" : "Copy"}
                  </button>
                </div>
                <SyntaxHighlighter language="rust" style={vscDarkPlus} customStyle={styles.highlighter}>
                  {codeResult.code}
                </SyntaxHighlighter>
              </div>

              <div style={styles.resultSection}>
                <div style={styles.resultLabel}>🚀 Next Steps</div>
                <div style={styles.resultText}>
                  <ReactMarkdown>{codeResult.next_steps}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DASHBOARD TAB */}
      {activeTab === "dashboard" && <Dashboard />}

      <style>{`
        @keyframes blink {
          0%, 80%, 100% { opacity: 0; }
          40% { opacity: 1; }
        }
        @media (max-width: 768px) {
          .pc-header { flex-wrap: wrap; gap: 12px; }
          .pc-tabs { order: 3; width: 100%; justify-content: center; }
          .pc-badge { display: none; }
        }
      `}</style>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: "#0a0a0f",
    color: "#e2e8f0",
    fontFamily: "'Inter', sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 24px",
    borderBottom: "1px solid #1e1e2e",
    backgroundColor: "#0d0d1a",
    flexWrap: "wrap",
    gap: "12px",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  logo: {
    fontSize: "28px",
    color: "#e6007a",
  },
  headerTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#ffffff",
  },
  headerSubtitle: {
    fontSize: "12px",
    color: "#64748b",
  },
  tabs: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  tab: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "1px solid #1e1e2e",
    backgroundColor: "transparent",
    color: "#64748b",
    fontSize: "13px",
    cursor: "pointer",
  },
  activeTab: {
    backgroundColor: "#1a0a2e",
    color: "#e6007a",
    border: "1px solid #e6007a44",
  },
  badge: {
    fontSize: "11px",
    padding: "4px 10px",
    borderRadius: "20px",
    backgroundColor: "#1a0a2e",
    color: "#e6007a",
    border: "1px solid #e6007a44",
  },
  chatArea: {
    flex: 1,
    overflowY: "auto",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  messageRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
  },
  avatar: {
    fontSize: "20px",
    color: "#e6007a",
    marginTop: "4px",
    flexShrink: 0,
  },
  bubble: {
    maxWidth: "70%",
    padding: "12px 16px",
    borderRadius: "12px",
    fontSize: "14px",
    lineHeight: "1.6",
  },
  userBubble: {
    backgroundColor: "#e6007a",
    color: "#ffffff",
    borderBottomRightRadius: "4px",
  },
  assistantBubble: {
    backgroundColor: "#13131f",
    color: "#e2e8f0",
    border: "1px solid #1e1e2e",
    borderBottomLeftRadius: "4px",
  },
  typing: {
    display: "inline-flex",
    gap: "4px",
    alignItems: "center",
    padding: "4px 0",
  },
  dot: {
    display: "inline-block",
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: "#e6007a",
    animation: "blink 1.4s infinite both",
  },
  sources: {
    marginTop: "8px",
    paddingTop: "8px",
    borderTop: "1px solid #1e1e2e",
    fontSize: "11px",
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    alignItems: "center",
  },
  sourcesLabel: {
    color: "#64748b",
  },
  sourceLink: {
    color: "#e6007a",
    textDecoration: "none",
    padding: "2px 8px",
    borderRadius: "10px",
    border: "1px solid #e6007a44",
    backgroundColor: "#1a0a2e",
  },
  errorBanner: {
    backgroundColor: "#2d0a1e",
    border: "1px solid #e6007a44",
    color: "#ff4da6",
    borderRadius: "8px",
    padding: "10px 16px",
    fontSize: "13px",
  },
  suggestions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    padding: "0 24px 16px",
  },
  suggestionBtn: {
    padding: "8px 14px",
    borderRadius: "20px",
    border: "1px solid #e6007a44",
    backgroundColor: "#1a0a2e",
    color: "#e6007a",
    fontSize: "12px",
    cursor: "pointer",
  },
  inputArea: {
    display: "flex",
    gap: "12px",
    padding: "16px 24px",
    borderTop: "1px solid #1e1e2e",
    backgroundColor: "#0d0d1a",
  },
  input: {
    flex: 1,
    backgroundColor: "#13131f",
    border: "1px solid #1e1e2e",
    borderRadius: "8px",
    padding: "12px 16px",
    color: "#e2e8f0",
    fontSize: "14px",
    resize: "none",
    outline: "none",
  },
  sendBtn: {
    padding: "12px 24px",
    backgroundColor: "#e6007a",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
  codeContainer: {
    flex: 1,
    overflowY: "auto",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  codeHeader: {
    textAlign: "center",
    padding: "20px 0 8px",
  },
  codeHeaderTitle: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: "8px",
  },
  codeHeaderSubtitle: {
    fontSize: "14px",
    color: "#64748b",
  },
  intentExamples: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    justifyContent: "center",
  },
  exampleBtn: {
    padding: "8px 14px",
    borderRadius: "20px",
    border: "1px solid #e6007a44",
    backgroundColor: "#1a0a2e",
    color: "#e6007a",
    fontSize: "12px",
    cursor: "pointer",
  },
  intentInputRow: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  intentInput: {
    backgroundColor: "#13131f",
    border: "1px solid #1e1e2e",
    borderRadius: "8px",
    padding: "14px 16px",
    color: "#e2e8f0",
    fontSize: "14px",
    resize: "none",
    outline: "none",
    lineHeight: "1.6",
  },
  generateBtn: {
    padding: "14px 24px",
    backgroundColor: "#e6007a",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
  },
  codeResults: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  resultSection: {
    backgroundColor: "#13131f",
    border: "1px solid #1e1e2e",
    borderRadius: "12px",
    padding: "16px",
  },
  resultLabel: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#e6007a",
    marginBottom: "10px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  resultLabelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  resultText: {
    fontSize: "14px",
    color: "#e2e8f0",
    lineHeight: "1.6",
  },
  highlighter: {
    borderRadius: "8px",
    fontSize: "13px",
    margin: 0,
  },
  copyBtn: {
    padding: "4px 12px",
    borderRadius: "6px",
    border: "1px solid #e6007a44",
    backgroundColor: "#1a0a2e",
    color: "#e6007a",
    fontSize: "12px",
    cursor: "pointer",
  },
};
