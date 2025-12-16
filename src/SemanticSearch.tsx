import { useState } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

type SearchResult = {
  kb_uuid: string;
  doc_uuid: string;
  chunk: string;
  score: number;
};

const SemanticSearchPage = () => {
  const [token, setToken] = useState("");
  const [kbUuid, setKbUuid] = useState("");
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(5);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasToken = token.trim().length > 0;

  const handleSearch = async () => {
    const q = query.trim();
    const kb = kbUuid.trim();
    if (!hasToken || !kb || !q) {
      setError("请先填写 Token、KB UUID 和查询内容");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE}/api/v1/kb/${kb}/semantic-search`,
        {
          query: q,
          top_k: topK,
        },
        {
          headers: {
            Authorization: `Bearer ${token.trim()}`,
          },
        }
      );
      const data = res.data?.data ?? [];
      setResults(data as SearchResult[]);
    } catch (e: any) {
      const msg =
        e?.response?.data?.msg ||
        e?.response?.data?.detail ||
        e?.message ||
        "搜索失败，请检查参数或后端日志";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>语义搜索（向量检索）</h2>

        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Token</label>
            <input
              style={styles.input}
              placeholder="粘贴 /api/v1/login 返回的 token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>KB UUID</label>
            <input
              style={styles.input}
              placeholder="要搜索的知识库 uuid"
              value={kbUuid}
              onChange={(e) => setKbUuid(e.target.value)}
            />
          </div>
          <div style={styles.fieldNarrow}>
            <label style={styles.label}>Top K</label>
            <input
              style={styles.input}
              type="number"
              min={1}
              max={20}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value) || 5)}
            />
          </div>
        </div>

        <div style={styles.queryRow}>
          <textarea
            style={styles.textarea}
            placeholder="输入你要检索的问题或关键词..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
          />
          <button
            style={styles.btn}
            onClick={handleSearch}
            disabled={loading || !hasToken}
          >
            {loading ? "搜索中..." : "搜索"}
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.resultBox}>
          {results.length === 0 && !loading && (
            <div style={styles.placeholder}>暂无结果，先提一个问题进行搜索。</div>
          )}
          {results.map((r, idx) => (
            <div key={r.doc_uuid + idx} style={styles.resultItem}>
              <div style={styles.resultHeader}>
                <span style={styles.score}>
                  相似度: {r.score.toFixed(3)}
                </span>
                <span style={styles.docId}>doc_uuid: {r.doc_uuid}</span>
              </div>
              <div style={styles.chunk}>{r.chunk}</div>
            </div>
          ))}
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
    maxWidth: 960,
    maxHeight: 720,
    background: "#fff",
    borderRadius: 16,
    boxShadow:
      "0 12px 24px rgba(15,23,42,0.08), 0 0 0 1px rgba(148,163,184,0.25)",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  },
  title: {
    margin: "0 0 12px",
    fontSize: 20,
    color: "#0f172a",
  },
  row: {
    display: "flex",
    gap: 12,
    marginBottom: 12,
  },
  field: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  fieldNarrow: {
    width: 80,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  label: {
    fontSize: 12,
    color: "#64748b",
  },
  input: {
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid #d0d7de",
    fontSize: 14,
  },
  queryRow: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  },
  textarea: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #d0d7de",
    fontSize: 14,
    resize: "vertical",
  },
  btn: {
    padding: "0 16px",
    borderRadius: 8,
    border: "none",
    background: "#1677ff",
    color: "#fff",
    fontSize: 14,
    cursor: "pointer",
    minWidth: 90,
  },
  error: {
    color: "#dc2626",
    fontSize: 12,
    marginBottom: 4,
  },
  resultBox: {
    flex: 1,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    padding: 12,
    overflowY: "auto",
    background: "#fafafa",
  },
  placeholder: {
    textAlign: "center",
    color: "#94a3b8",
    marginTop: 40,
    fontSize: 14,
  },
  resultItem: {
    padding: 10,
    borderRadius: 8,
    background: "#fff",
    boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
    marginBottom: 8,
  },
  resultHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 4,
    fontSize: 12,
    color: "#64748b",
  },
  score: {
    fontWeight: 500,
    color: "#0369a1",
  },
  docId: {
    fontFamily: "monospace",
  },
  chunk: {
    fontSize: 14,
    color: "#0f172a",
    whiteSpace: "pre-wrap",
  },
};

export default SemanticSearchPage;


