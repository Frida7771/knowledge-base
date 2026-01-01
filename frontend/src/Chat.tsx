import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "./config";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  context?: string[];
};

type ChatSummary = {
  uuid: string;
  title: string;
  update_at?: number;
};

const CHAT_STORAGE_KEY = "kb-last-chat";

type ChatPageProps = {
  token: string;
  onLogout?: () => void;
  initialKbUuid?: string | null;
  onKbChange?: (uuid: string) => void;
};

const ChatPage = ({
  token,
  onLogout,
  initialKbUuid,
  onKbChange,
}: ChatPageProps) => {
  const [kbUuid, setKbUuid] = useState(initialKbUuid || "");
  const [chatUuid, setChatUuid] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage.getItem(CHAT_STORAGE_KEY) || null;
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatListError, setChatListError] = useState<string | null>(null);

  const hasToken = token.trim().length > 0;

  useEffect(() => {
    setKbUuid(initialKbUuid || "");
  }, [initialKbUuid]);

  const persistChatUuid = (uuid: string | null) => {
    setChatUuid(uuid);
    if (typeof window !== "undefined") {
      if (uuid) {
        window.localStorage.setItem(CHAT_STORAGE_KEY, uuid);
      } else {
        window.localStorage.removeItem(CHAT_STORAGE_KEY);
      }
    }
  };

  const handleKbChange = (value: string) => {
    setKbUuid(value);
    onKbChange?.(value);
  };

  const loadChats = async () => {
    if (!hasToken) return;
    setChatsLoading(true);
    setChatListError(null);
    try {
      const authHeader = { Authorization: `Bearer ${token.trim()}` };
      const res = await axios.get(`${API_BASE}/api/v1/chat/list`, {
        headers: authHeader,
        params: { page: 1, size: 50 },
      });
      const list = res.data?.data?.list ?? [];
      setChats(list);
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail?.msg ||
        e?.response?.data?.msg ||
        e?.message ||
        "Failed to load chat list";
      setChatListError(String(msg));
    } finally {
      setChatsLoading(false);
    }
  };

  useEffect(() => {
    loadChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleRenameChat = async (uuid: string, currentTitle: string) => {
    if (!hasToken) return;
    const draft = window.prompt("Rename chat", currentTitle || "");
    if (draft === null) {
      return;
    }
    const trimmed = draft.trim();
    if (!trimmed) {
      alert("Title cannot be empty");
      return;
    }
    try {
      const authHeader = { Authorization: `Bearer ${token.trim()}` };
      await axios.put(
        `${API_BASE}/api/v1/chat/${uuid}`,
        { title: trimmed },
        { headers: authHeader }
      );
      setChats((prev) =>
        prev.map((chat) =>
          chat.uuid === uuid ? { ...chat, title: trimmed } : chat
        )
      );
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail?.msg ||
        e?.response?.data?.msg ||
        e?.message ||
        "Failed to rename chat";
      setChatListError(String(msg));
    }
  };

  useEffect(() => {
    if (!chatUuid || !hasToken) {
      if (!chatUuid) {
        setMessages([]);
      }
      return;
    }
    let cancelled = false;
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const authHeader = { Authorization: `Bearer ${token.trim()}` };
        const res = await axios.get(
          `${API_BASE}/api/v1/chat/${chatUuid}/messages`,
          { headers: authHeader }
        );
        if (cancelled) {
          return;
        }
        const list = Array.isArray(res.data) ? res.data : [];
        setMessages(
          list.map((m: any) => ({
            id: m.uuid as string,
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content as string,
          }))
        );
      } catch (e) {
        if (!cancelled) {
          setMessages([]);
          persistChatUuid(null);
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    };
    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [chatUuid, hasToken, token]);

  const ensureChatExists = async (question: string): Promise<string> => {
    if (chatUuid) {
      return chatUuid;
    }
    const authHeader = { Authorization: `Bearer ${token.trim()}` };
    const res = await axios.post(
      `${API_BASE}/api/v1/chat`,
      {
        kb_uuid: kbUuid.trim() || null,
        title: question.slice(0, 50) || "My conversation",
      },
      { headers: authHeader }
    );
    const created = res.data?.data;
    const createdUuid: string | null =
      (created?.uuid as string | undefined) ?? null;
    if (!createdUuid) {
      throw new Error("Failed to create chat: missing uuid");
    }
    persistChatUuid(createdUuid);
    if (created) {
      setChats((prev) => [created, ...prev.filter((c) => c.uuid !== created.uuid)]);
    }
    return createdUuid;
  };

  const streamAssistantReply = async (
    currentChatUuid: string,
    question: string
  ) => {
    const response = await fetch(
      `${API_BASE}/api/v1/chat/${currentChatUuid}/message/stream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: question }),
      }
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Stream request failed");
    }

    const assistantId = `${Date.now()}-assistant`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    try {
      if (!reader) {
        const text = await response.text();
        if (text) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: msg.content + text }
                : msg
            )
          );
        }
        return;
      }

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: msg.content + chunk }
              : msg
          )
        );
      }
      const remaining = decoder.decode();
      if (remaining) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: msg.content + remaining }
              : msg
          )
        );
      }
    } catch (err) {
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantId));
      throw err;
    }
  };

  const handleSend = async () => {
    const question = input.trim();
    if (!question || !hasToken || loading) return;

    setError(null);
    setInput("");
    const userMessageId = `${Date.now()}-user`;
    setMessages((prev) => [
      ...prev,
      { id: userMessageId, role: "user", content: question },
    ]);

    try {
      setLoading(true);
      const currentChatUuid = await ensureChatExists(question);
      await streamAssistantReply(currentChatUuid, question);
      loadChats();
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.detail?.msg ||
        e?.response?.data?.detail ||
        e?.message ||
        "Request failed, please verify backend service or token";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.layout}>
        <div style={styles.sidebar}>
          <h3 style={styles.sidebarTitle}>Conversation Settings</h3>
          <label style={styles.label}>KB UUID (optional)</label>
          <input
            style={styles.input}
            placeholder="Knowledge base UUID (optional)"
            value={kbUuid}
            onChange={(e) => handleKbChange(e.target.value)}
          />
          <div style={styles.buttonColumn}>
            <button
              style={styles.newChatBtn}
              onClick={() => {
                setMessages([]);
                persistChatUuid(null);
              }}
            >
              New chat
            </button>
            {onLogout && (
              <button style={styles.logoutBtn} onClick={onLogout}>
                Sign out
              </button>
            )}
          </div>
          <div style={styles.chatListHeader}>
            <div>Existing chats</div>
            <button style={styles.refreshBtn} onClick={loadChats}>
              Refresh
            </button>
          </div>
          <div style={styles.chatList}>
            {chatsLoading ? (
              <div style={styles.placeholder}>Loading chats...</div>
            ) : chatListError ? (
              <div style={styles.error}>{chatListError}</div>
            ) : chats.length === 0 ? (
              <div style={styles.placeholder}>No chats yet.</div>
            ) : (
              chats.map((chat) => (
                <div key={chat.uuid} style={styles.chatListRow}>
                  <button
                    style={{
                      ...styles.chatListItem,
                      border:
                        chat.uuid === chatUuid
                          ? "1px solid #2563eb"
                          : "1px solid #e2e8f0",
                      background:
                        chat.uuid === chatUuid
                          ? "#dbeafe"
                          : "rgba(255,255,255,0.6)",
                    }}
                    onClick={() => persistChatUuid(chat.uuid)}
                  >
                    <div style={styles.chatListTitle}>
                      {chat.title || "Untitled chat"}
                    </div>
                    <div style={styles.chatListMeta}>
                      {chat.update_at
                        ? new Date(chat.update_at).toLocaleString()
                        : ""}
                    </div>
                  </button>
                  <button
                    style={styles.renameBtn}
                    onClick={() => handleRenameChat(chat.uuid, chat.title)}
                  >
                    Rename
                  </button>
                </div>
              ))
            )}
          </div>
          <div style={styles.hintBox}>
            <strong>Tip</strong>
            <p>When a knowledge base is bound, answers cite matching snippets.</p>
          </div>
        </div>

        <div style={styles.chatPanel}>
          <div style={styles.chatHeader}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>Intelligent chat</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Every turn is saved and synced into the selected knowledge base.
              </div>
            </div>
          </div>

          <div style={styles.chatBox}>
            {historyLoading ? (
              <div style={styles.placeholder}>Loading conversation...</div>
            ) : messages.length === 0 ? (
              <div style={styles.placeholder}>
                Start chatting and the knowledge will be written into the backend KB.
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    justifyContent:
                      m.role === "user" ? "flex-end" : "flex-start",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      ...styles.bubble,
                      backgroundColor:
                        m.role === "user" ? "#2563eb" : "#f8fafc",
                      color: m.role === "user" ? "#fff" : "#0f172a",
                      boxShadow:
                        m.role === "user"
                          ? "0 12px 30px rgba(37,99,235,0.35)"
                          : "0 10px 24px rgba(15,23,42,0.12)",
                    }}
                  >
                    {m.content}
                    {m.context && m.context.length > 0 && (
                      <div style={styles.contextBox}>
                        <div style={styles.contextTitle}>Referenced snippets</div>
                        {m.context.map((chunk, idx) => (
                          <div key={`${m.id}-ctx-${idx}`} style={styles.contextChunk}>
                            {chunk}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.inputRow}>
            <textarea
              style={styles.textarea}
              placeholder="Ask something..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={2}
              disabled={!hasToken || loading}
            />
            <button
              style={styles.sendBtn}
              onClick={handleSend}
              disabled={!hasToken || loading || !input.trim()}
            >
              {loading ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    width: "100%",
    height: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  layout: {
    width: "100%",
    maxWidth: 1280,
    height: "640px",
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: 24,
    margin: "0 auto",
  },
  sidebar: {
    background: "rgba(255,255,255,0.95)",
    borderRadius: 20,
    padding: 24,
    boxShadow: "0 25px 50px rgba(15,23,42,0.15)",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    height: "100%",
    minHeight: 0,
  },
  sidebarTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
  },
  label: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },
  input: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #d0d7de",
    fontSize: 14,
  },
  chatPanel: {
    background: "rgba(255,255,255,0.97)",
    borderRadius: 24,
    boxShadow: "0 30px 65px rgba(15,23,42,0.18)",
    display: "flex",
    flexDirection: "column",
    padding: 24,
    height: "100%",
    minHeight: 0,
  },
  chatHeader: {
    paddingBottom: 12,
    borderBottom: "1px solid rgba(148,163,184,0.3)",
    marginBottom: 16,
  },
  chatBox: {
    flex: 1,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    padding: 16,
    marginBottom: 16,
    overflowY: "auto",
    background: "#f8fafc",
    minHeight: 0,
  },
  placeholder: {
    textAlign: "center",
    color: "#94a3b8",
    marginTop: 40,
    fontSize: 14,
  },
  bubble: {
    maxWidth: "70%",
    padding: "12px 16px",
    borderRadius: 18,
    fontSize: 15,
    lineHeight: 1.6,
    wordBreak: "break-word",
  },
  inputRow: {
    display: "flex",
    gap: 8,
    marginTop: 4,
  },
  textarea: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #d0d7de",
    fontSize: 14,
    resize: "none",
    fontFamily: "inherit",
  },
  sendBtn: {
    padding: "0 18px",
    borderRadius: 12,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontSize: 14,
    cursor: "pointer",
    minWidth: 100,
    boxShadow: "0 15px 30px rgba(37,99,235,0.4)",
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
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#0f172a",
    fontSize: 14,
    cursor: "pointer",
    marginTop: 8,
  },
  buttonColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 8,
  },
  newChatBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #d0d7de",
    background: "#f1f5f9",
    color: "#0f172a",
    fontSize: 14,
    cursor: "pointer",
  },
  chatListHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
    fontSize: 14,
    color: "#0f172a",
  },
  refreshBtn: {
    border: "none",
    background: "transparent",
    color: "#2563eb",
    cursor: "pointer",
    fontSize: 13,
  },
  chatList: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minHeight: 0,
  },
  chatListRow: {
    display: "flex",
    gap: 6,
    alignItems: "center",
  },
  chatListItem: {
    padding: "10px 12px",
    borderRadius: 12,
    display: "flex",
    flexDirection: "column",
    textAlign: "left",
    cursor: "pointer",
    background: "#fff",
    flex: 1,
  },
  chatListTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#0f172a",
  },
  chatListMeta: {
    fontSize: 12,
    color: "#94a3b8",
  },
  renameBtn: {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid #d0d7de",
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
    color: "#0f172a",
    whiteSpace: "nowrap",
  },
  contextBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    background: "rgba(255,255,255,0.85)",
    color: "#0f172a",
  },
  contextTitle: {
    fontSize: 13,
    marginBottom: 6,
    color: "#475569",
    fontWeight: 600,
  },
  contextChunk: {
    fontSize: 13,
    color: "#0f172a",
    whiteSpace: "pre-wrap",
    marginBottom: 6,
    paddingLeft: 10,
    borderLeft: "3px solid #2563eb",
  },
  hintBox: {
    marginTop: "auto",
    padding: "12px 16px",
    borderRadius: 16,
    background: "rgba(37,99,235,0.08)",
    color: "#1e3a8a",
    fontSize: 14,
    lineHeight: 1.35,
    width: 260,
    alignSelf: "flex-start",
  },
};

export default ChatPage;


