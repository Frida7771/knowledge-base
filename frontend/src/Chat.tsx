import { useState } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const ChatPage = () => {
  const [token, setToken] = useState("");
  const [kbUuid, setKbUuid] = useState("");
  const [chatUuid, setChatUuid] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasToken = token.trim().length > 0;

  const handleSend = async () => {
    const question = input.trim();
    if (!question || !hasToken || loading) return;

    setError(null);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-user`, role: "user", content: question },
    ]);

    try {
      setLoading(true);

      const authHeader = { Authorization: `Bearer ${token.trim()}` };

      let currentChatUuid = chatUuid;

      // 第一次发送：如果还没有 chat，则先创建一个
      if (!currentChatUuid) {
        const createRes = await axios.post(
          `${API_BASE}/api/v1/chat`,
          {
            kb_uuid: kbUuid.trim() || null,
            title: "我的对话",
            first_question: question,
          },
          { headers: authHeader }
        );
        const created = createRes.data?.data;
        const createdUuid: string | null =
          (created?.uuid as string | undefined) ?? null;
        if (!createdUuid) {
          throw new Error("创建对话失败，未返回 uuid");
        }
        currentChatUuid = createdUuid;
        setChatUuid(createdUuid);

        // 拉一次消息列表，展示完整对话
        const msgRes = await axios.get(
          `${API_BASE}/api/v1/chat/${currentChatUuid}/messages`,
          { headers: authHeader }
        );
        const list = msgRes.data as any[];
        setMessages(
          list.map((m) => ({
            id: m.uuid as string,
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content as string,
          }))
        );
      } else {
        // 已有 chat，直接发消息
        const sendRes = await axios.post(
          `${API_BASE}/api/v1/chat/${currentChatUuid}/message`,
          { content: question },
          { headers: authHeader }
        );
        const reply = sendRes.data as { answer: string };

        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-assistant`,
            role: "assistant",
            content: reply.answer,
          },
        ]);
      }
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.detail?.msg ||
        e?.response?.data?.detail ||
        e?.message ||
        "请求失败，请检查后端或 token";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* 顶部配置区 */}
        <div style={styles.configRow}>
          <div style={styles.configItem}>
            <label style={styles.label}>Token</label>
            <input
              style={styles.input}
              placeholder="粘贴 /api/v1/login 返回的 token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <div style={styles.configItem}>
            <label style={styles.label}>KB UUID（可选）</label>
            <input
              style={styles.input}
              placeholder="绑定的知识库 uuid，可留空"
              value={kbUuid}
              onChange={(e) => setKbUuid(e.target.value)}
            />
          </div>
        </div>

        {/* 中间聊天区 */}
        <div style={styles.chatBox}>
          {messages.length === 0 && (
            <div style={styles.placeholder}>
              开始聊天吧，知识会自动写入后端 KB。
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent:
                  m.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  ...styles.bubble,
                  backgroundColor:
                    m.role === "user" ? "#1677ff" : "#f5f5f5",
                  color: m.role === "user" ? "#fff" : "#000",
                }}
              >
                {m.content}
              </div>
            </div>
          ))}
        </div>

        {/* 底部输入区 */}
        {error && <div style={styles.error}>{error}</div>}
        <div style={styles.inputRow}>
          <input
            style={styles.textarea}
            placeholder={
              hasToken ? "输入你的问题..." : "请先在上面填入 token 再开始聊天"
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={!hasToken || loading}
          />
          <button
            style={styles.sendBtn}
            onClick={handleSend}
            disabled={!hasToken || loading || !input.trim()}
          >
            {loading ? "发送中..." : "发送"}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f0f2f5",
    padding: 16,
    boxSizing: "border-box",
  },
  card: {
    width: "100%",
    maxWidth: 900,
    height: "100%",
    maxHeight: 700,
    background: "#fff",
    borderRadius: 16,
    boxShadow:
      "0 12px 24px rgba(15,23,42,0.08), 0 0 0 1px rgba(148,163,184,0.25)",
    display: "flex",
    flexDirection: "column",
    padding: 16,
    boxSizing: "border-box",
  },
  configRow: {
    display: "flex",
    gap: 12,
    marginBottom: 12,
  },
  configItem: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  label: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },
  input: {
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid #d0d7de",
    fontSize: 14,
  },
  chatBox: {
    flex: 1,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    padding: 12,
    marginBottom: 12,
    overflowY: "auto",
    background: "#fafafa",
  },
  placeholder: {
    textAlign: "center",
    color: "#94a3b8",
    marginTop: 40,
    fontSize: 14,
  },
  bubble: {
    maxWidth: "70%",
    padding: "8px 12px",
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  inputRow: {
    display: "flex",
    gap: 8,
    marginTop: 4,
  },
  textarea: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #d0d7de",
    fontSize: 14,
  },
  sendBtn: {
    padding: "0 16px",
    borderRadius: 8,
    border: "none",
    background: "#1677ff",
    color: "#fff",
    fontSize: 14,
    cursor: "pointer",
    minWidth: 80,
  },
  error: {
    color: "#dc2626",
    fontSize: 12,
    marginBottom: 4,
  },
  loginBtn: {
    padding: "0 16px",
    borderRadius: 8,
    border: "none",
    background: "#1677ff",
    color: "#fff",
    fontSize: 14,
    cursor: "pointer",
    minWidth: 80,
    alignSelf: "flex-end",
  },
  logoutBtn: {
    padding: "0 16px",
    borderRadius: 8,
    border: "1px solid #d0d7de",
    background: "#fff",
    color: "#0f172a",
    fontSize: 14,
    cursor: "pointer",
    minWidth: 80,
    alignSelf: "flex-end",
  },
  chip: {
    padding: "6px 10px",
    borderRadius: 8,
    background: "#e0f2fe",
    color: "#0369a1",
    fontSize: 13,
    border: "1px solid #bae6fd",
  },
};

export default ChatPage;


