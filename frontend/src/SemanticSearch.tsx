import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "./config";

type KeywordResult = {
  kb_uuid: string;
  doc_uuid: string;
  title?: string;
  snippet: string;
  score: number;
};

type SemanticSearchProps = {
  token: string;
  initialKbUuid?: string | null;
  onKbChange?: (uuid: string) => void;
};

const SemanticSearchPage = ({
  token,
  initialKbUuid,
  onKbChange,
}: SemanticSearchProps) => {
  const [kbUuid, setKbUuid] = useState(initialKbUuid || "");
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(5);
  const [results, setResults] = useState<KeywordResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasToken = token.trim().length > 0;

  useEffect(() => {
    setKbUuid(initialKbUuid || "");
  }, [initialKbUuid]);

  const handleKbInput = (value: string) => {
    setKbUuid(value);
    onKbChange?.(value);
  };

  const handleSearch = async () => {
    const q = query.trim();
    const kb = kbUuid.trim();
    if (!hasToken || !kb || !q) {
      setError("请先填写 KB UUID 和查询内容");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE}/api/v1/kb/${kb}/fulltext-search`,
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
      setResults(data as KeywordResult[]);
    } catch (e: any) {
      const msg =
        e?.response?.data?.msg ||
        e?.response?.data?.detail ||
        e?.message ||
        "全文搜索失败，请检查参数或后端日志";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.layout}>
        <div style={styles.searchCard}>
          <div style={styles.headerRow}>
            <h2 style={styles.title}>Keyword Search</h2>
          </div>
          <p style={styles.subtitle}>
            Full-text retrieval powered by Elasticsearch. Highlighted snippets
            show where your query matched.
          </p>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>KB UUID</label>
            <input
              style={styles.input}
              placeholder="Knowledge base UUID"
              value={kbUuid}
              onChange={(e) => handleKbInput(e.target.value)}
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
                aria-label="Top K"
              />
            </div>
          </div>

          <div style={styles.queryRow}>
            <textarea
              style={styles.textarea}
              placeholder="Enter your question or keywords…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
            />
            <button
              style={styles.btn}
              onClick={handleSearch}
              disabled={loading || !hasToken}
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.resultBox}>
          {results.length === 0 && !loading && (
            <div style={styles.placeholder}>
              No keyword matches yet — try different terms.
            </div>
          )}
          {results.map((r, idx) => (
              <div key={r.doc_uuid + idx} style={styles.resultItem}>
                <div
                  style={styles.snippet}
                  dangerouslySetInnerHTML={{ __html: r.snippet }}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={styles.sidePanel}>
          <div style={styles.sidePanelTitle}>Hints</div>
          <ul style={styles.tipsList}>
            <li>Use descriptive phrases to narrow the match scope.</li>
            <li>Highlighted snippets show exactly where the query matched.</li>
            <li>Increase Top K to inspect more results.</li>
          </ul>
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
    maxWidth: 1200,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    gap: 24,
    height: "640px",
    margin: "0 auto",
  },
  searchCard: {
    background: "rgba(255,255,255,0.97)",
    borderRadius: 24,
    boxShadow: "0 30px 65px rgba(15,23,42,0.18)",
    padding: 24,
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  title: {
    margin: "0 0 4px",
    fontSize: 22,
    color: "#0f172a",
    fontWeight: 600,
  },
  subtitle: {
    margin: "0 0 16px",
    color: "#475569",
    fontSize: 13,
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
    padding: "10px 12px",
    borderRadius: 12,
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
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #d0d7de",
    fontSize: 14,
    resize: "vertical",
    fontFamily: "inherit",
  },
  btn: {
    padding: "0 18px",
    borderRadius: 12,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontSize: 14,
    cursor: "pointer",
    minWidth: 100,
    boxShadow: "0 15px 30px rgba(37,99,235,0.35)",
  },
  error: {
    color: "#dc2626",
    fontSize: 12,
    marginBottom: 4,
  },
  resultBox: {
    flex: 1,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    padding: 16,
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
  resultItem: {
    padding: 14,
    borderRadius: 14,
    background: "#fff",
    boxShadow: "0 12px 24px rgba(15,23,42,0.08)",
    marginBottom: 12,
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
    fontSize: 15,
    color: "#0f172a",
    whiteSpace: "pre-wrap",
  },
  keywordTitle: {
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 6,
    color: "#0f172a",
  },
  snippet: {
    fontSize: 14,
    color: "#0f172a",
    lineHeight: 1.5,
  },
  sidePanel: {
    background: "rgba(255,255,255,0.9)",
    borderRadius: 20,
    padding: 24,
    boxShadow: "0 25px 50px rgba(15,23,42,0.15)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    height: "100%",
    overflowY: "auto",
  },
  sidePanelTitle: {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 6,
  },
  tipsList: {
    margin: 0,
    paddingLeft: 20,
    color: "#475569",
    lineHeight: 1.6,
  },
};

export default SemanticSearchPage;


