import { useState } from "react";
import "./App.css";
import ChatPage from "./Chat";
import SemanticSearchPage from "./SemanticSearch";
import LoginPage from "./Login";
import KnowledgeBasesPage from "./KnowledgeBases";

const TAB_KEY = "kb-tab";

function App() {
  const [tab, setTab] = useState<"chat" | "search" | "kb">(() => {
    if (typeof window === "undefined") {
      return "chat";
    }
    const saved = window.localStorage.getItem(TAB_KEY);
    if (saved === "search" || saved === "kb") {
      return saved;
    }
    return "chat";
  });
  const [token, setToken] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.localStorage.getItem("kb-token") || "";
  });
  const [selectedKb, setSelectedKb] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.localStorage.getItem("kb-default") || "";
  });

  const handleLoginSuccess = (newToken: string) => {
    setToken(newToken);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("kb-token", newToken);
    }
  };

  const handleLogout = () => {
    setToken("");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("kb-token");
    }
  };

  const handleSelectKb = (uuid: string) => {
    const value = uuid || "";
    setSelectedKb(value);
    if (typeof window !== "undefined") {
      if (value) {
        window.localStorage.setItem("kb-default", value);
      } else {
        window.localStorage.removeItem("kb-default");
      }
    }
  };

  if (!token) {
    return <LoginPage onSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-shell">
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 32px",
          borderBottom: "1px solid rgba(148,163,184,0.3)",
          backdropFilter: "blur(6px)",
          width: "100%",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 600 }}>AtlasKB Studio</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: tab === "chat" ? "#1d4ed8" : "#e2e8f0",
              color: tab === "chat" ? "#fff" : "#0f172a",
              fontSize: 14,
              boxShadow:
                tab === "chat"
                  ? "0 6px 20px rgba(29,78,216,0.25)"
                  : "0 2px 6px rgba(15,23,42,0.1)",
            }}
            onClick={() => {
              setTab("chat");
              if (typeof window !== "undefined") {
                window.localStorage.setItem(TAB_KEY, "chat");
              }
            }}
          >
            Chat
          </button>
          <button
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: tab === "search" ? "#1d4ed8" : "#e2e8f0",
              color: tab === "search" ? "#fff" : "#0f172a",
              fontSize: 14,
              boxShadow:
                tab === "search"
                  ? "0 6px 20px rgba(29,78,216,0.25)"
                  : "0 2px 6px rgba(15,23,42,0.1)",
            }}
            onClick={() => {
              setTab("search");
              if (typeof window !== "undefined") {
                window.localStorage.setItem(TAB_KEY, "search");
              }
            }}
          >
            Semantic Search
          </button>
          <button
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: tab === "kb" ? "#1d4ed8" : "#e2e8f0",
              color: tab === "kb" ? "#fff" : "#0f172a",
              fontSize: 14,
              boxShadow:
                tab === "kb"
                  ? "0 6px 20px rgba(29,78,216,0.25)"
                  : "0 2px 6px rgba(15,23,42,0.1)",
            }}
            onClick={() => {
              setTab("kb");
              if (typeof window !== "undefined") {
                window.localStorage.setItem(TAB_KEY, "kb");
              }
            }}
          >
            AtlasKB
          </button>
        </div>
        <button
          style={{
            padding: "8px 18px",
            borderRadius: 999,
            border: "1px solid rgba(15,23,42,0.15)",
            background: "#fff",
            color: "#0f172a",
            fontSize: 14,
            cursor: "pointer",
          }}
          onClick={handleLogout}
        >
          Log out
        </button>
      </header>

      <main className="app-main">
        {tab === "chat" ? (
          <ChatPage
            token={token}
            onLogout={handleLogout}
            initialKbUuid={selectedKb}
            onKbChange={handleSelectKb}
          />
        ) : tab === "search" ? (
          <SemanticSearchPage
            token={token}
            initialKbUuid={selectedKb}
            onKbChange={handleSelectKb}
          />
        ) : (
          <KnowledgeBasesPage
            token={token}
            selectedKbUuid={selectedKb}
            onSelectKb={handleSelectKb}
          />
        )}
      </main>
    </div>
  );
}

export default App;
