import { useState } from "react";
import "./App.css";
import ChatPage from "./Chat";
import SemanticSearchPage from "./SemanticSearch";

function App() {
  const [tab, setTab] = useState<"chat" | "search">("chat");

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          padding: 8,
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <button
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            background: tab === "chat" ? "#0f172a" : "#e2e8f0",
            color: tab === "chat" ? "#fff" : "#0f172a",
            fontSize: 14,
          }}
          onClick={() => setTab("chat")}
        >
          Chat
        </button>
        <button
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            background: tab === "search" ? "#0f172a" : "#e2e8f0",
            color: tab === "search" ? "#fff" : "#0f172a",
            fontSize: 14,
          }}
          onClick={() => setTab("search")}
        >
          语义搜索
        </button>
      </div>
      <div style={{ flex: 1 }}>
        {tab === "chat" ? <ChatPage /> : <SemanticSearchPage />}
      </div>
    </div>
  );
}

export default App;
