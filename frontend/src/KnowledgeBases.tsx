import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE } from "./config";

type KnowledgeBase = {
  uuid: string;
  name: string;
  description?: string | null;
  create_at: number;
  update_at: number;
};

type Props = {
  token: string;
  selectedKbUuid?: string | null;
  onSelectKb?: (uuid: string) => void;
};

const KnowledgeBasesPage = ({ token, selectedKbUuid, onSelectKb }: Props) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [exportingKb, setExportingKb] = useState<string | null>(null);

  const hasToken = token.trim().length > 0;

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token.trim()}` }),
    [token]
  );

  const PAGE_SIZE = 5;

  const fetchList = async (targetPage = page) => {
    if (!hasToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/kb/list`, {
        params: { page: targetPage, size: PAGE_SIZE },
        headers,
      });
      const data = res.data?.data;
      setItems(data?.list ?? []);
      setTotal(data?.total ?? 0);
      setPage(targetPage);
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail?.msg ||
        e?.response?.data?.msg ||
        e?.message ||
        "Failed to load knowledge bases";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await axios.post(
        `${API_BASE}/api/v1/kb`,
        { name: name.trim(), description: description.trim() || undefined },
        { headers }
      );
      setName("");
      setDescription("");
      const created = res.data?.data as KnowledgeBase | undefined;
      if (created) {
        setItems((prev) => {
          const next = [created, ...prev];
          return next.slice(0, PAGE_SIZE);
        });
        setTotal((prev) => prev + 1);
        setPage(1);
        if (onSelectKb) {
          onSelectKb(created.uuid);
        }
      } else {
        fetchList(1);
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail?.msg ||
        e?.response?.data?.msg ||
        e?.message ||
        "Failed to create knowledge base";
      setError(String(msg));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (uuid: string) => {
    if (!window.confirm("Delete this knowledge base? This cannot be undone.")) {
      return;
    }
    setError(null);
    try {
      await axios.delete(`${API_BASE}/api/v1/kb/${uuid}`, { headers });
      fetchList();
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail?.msg ||
        e?.response?.data?.msg ||
        e?.message ||
        "Failed to delete knowledge base";
      setError(String(msg));
    }
  };

  const handleSelect = (uuid: string) => {
    if (onSelectKb) {
      onSelectKb(uuid);
    }
    window.navigator.clipboard?.writeText(uuid).catch(() => {});
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleExport = async (kbUuid: string, kbName: string) => {
    if (!hasToken) return;
    setExportingKb(kbUuid);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/kb/${kbUuid}/export`, {
        headers,
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/zip" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const contentDisposition = res.headers["content-disposition"];
      let filename = contentDisposition
        ? contentDisposition.split("filename=")[1]?.replace(/"/g, "")
        : `${kbName || "knowledge-base"}.zip`;
      if (!filename) {
        filename = `${kbName || "knowledge-base"}.zip`;
      }
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail?.msg ||
        e?.response?.data?.msg ||
        e?.message ||
        "Failed to export knowledge base";
      setError(String(msg));
    } finally {
      setExportingKb(null);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={styles.heroCard}>
          <h2 style={styles.heading}>Knowledge Bases</h2>
          <p style={styles.subheading}>
            create your own knowledge bases, inspect existing ones,
            copy their UUIDs for chat/search, and export full backups with one
            click.
          </p>
        </div>

        <div style={styles.cardsRow}>
          <div style={styles.createCard}>
            <h3 style={styles.cardTitle}>Create knowledge base</h3>
            <label style={styles.label}>Name</label>
            <input
              style={styles.input}
              placeholder="e.g. Interview Prep"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={creating || !hasToken}
            />
            <label style={styles.label}>Description (optional)</label>
            <textarea
              style={styles.textarea}
              placeholder="Short description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={creating || !hasToken}
            />
            <button
              style={styles.primaryBtn}
              onClick={handleCreate}
              disabled={creating || !hasToken}
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>

          <div style={styles.listCard}>
            <div style={styles.listHeader}>
              <div>
                <h3 style={styles.cardTitle}>My knowledge bases</h3>
                <p style={styles.cardHint}>
                  Selecting one copies its UUID for chat/search binding.
                </p>
              </div>
              <div style={styles.pagination}>
                <button
                  style={styles.pageBtn}
                  onClick={() => fetchList(Math.max(1, page - 1))}
                  disabled={loading || page <= 1}
                >
                  Prev
                </button>
                <span style={styles.pageInfo}>
                  Page {page} / {totalPages}
                </span>
                <button
                  style={styles.pageBtn}
                  onClick={() => fetchList(Math.min(totalPages, page + 1))}
                  disabled={loading || page >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>

            {error && <div style={styles.error}>{error}</div>}
            {loading ? (
              <div style={styles.placeholder}>Loading...</div>
            ) : items.length === 0 ? (
              <div style={styles.placeholder}>No knowledge bases yet.</div>
            ) : (
              <div style={styles.listWrapper}>
                <div style={styles.list}>
                  {items.map((kb) => (
                    <div key={kb.uuid} style={styles.listItem}>
                      <div>
                        <div style={styles.kbName}>{kb.name}</div>
                        <div style={styles.kbUuid}>{kb.uuid}</div>
                        {kb.description && (
                          <div style={styles.kbDesc}>{kb.description}</div>
                        )}
                      </div>
                      <div style={styles.actions}>
                        <button
                          style={{
                            ...styles.secondaryBtn,
                            background:
                              kb.uuid === selectedKbUuid ? "#dbeafe" : "#fff",
                            color:
                              kb.uuid === selectedKbUuid ? "#1d4ed8" : "#0f172a",
                          }}
                          onClick={() => handleSelect(kb.uuid)}
                        >
                          {kb.uuid === selectedKbUuid
                            ? "Selected"
                            : "Use & copy"}
                        </button>
                        <button
                          style={styles.exportBtn}
                          onClick={() => handleExport(kb.uuid, kb.name)}
                          disabled={exportingKb === kb.uuid}
                        >
                          {exportingKb === kb.uuid ? "Preparing..." : "Export"}
                        </button>
                        <button
                          style={styles.deleteBtn}
                          onClick={() => handleDelete(kb.uuid)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    width: "100%",
    height: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "16px 0",
  },
  container: {
    width: "100%",
    maxWidth: 1200,
    padding: "0 24px",
    height: 640,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  heroCard: {
    background: "rgba(255,255,255,0.97)",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 25px 60px rgba(15,23,42,0.18)",
  },
  heading: {
    margin: "0 0 8px",
    fontSize: 28,
  },
  subheading: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.6,
  },
  cardsRow: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 360px) 1fr",
    gap: 24,
    flex: 1,
    minHeight: 0,
  },
  createCard: {
    background: "rgba(255,255,255,0.97)",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 30px 65px rgba(15,23,42,0.15)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minHeight: 0,
  },
  listCard: {
    background: "rgba(255,255,255,0.97)",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 30px 65px rgba(15,23,42,0.15)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    height: "100%",
    minHeight: 0,
  },
  cardTitle: {
    margin: 0,
    fontSize: 18,
  },
  cardHint: {
    margin: "4px 0 0",
    fontSize: 13,
    color: "#94a3b8",
  },
  label: {
    fontSize: 13,
    color: "#64748b",
  },
  input: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #d0d7de",
    fontSize: 14,
  },
  textarea: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #d0d7de",
    fontSize: 14,
    resize: "vertical",
    fontFamily: "inherit",
  },
  primaryBtn: {
    border: "none",
    borderRadius: 12,
    background: "#2563eb",
    color: "#fff",
    padding: "10px 16px",
    fontSize: 14,
    cursor: "pointer",
    marginTop: 4,
  },
  listWrapper: {
    flex: 1,
    overflowY: "auto",
    paddingRight: 6,
    minHeight: 0,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  listItem: {
    padding: 16,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#fff",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  kbName: {
    fontSize: 16,
    fontWeight: 600,
  },
  kbUuid: {
    fontFamily: "monospace",
    fontSize: 13,
    color: "#475569",
  },
  kbDesc: {
    fontSize: 13,
    color: "#475569",
    marginTop: 4,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
  },
  secondaryBtn: {
    padding: "5px 14px",
    borderRadius: 12,
    border: "1px solid #cbd5f5",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
  },
  exportBtn: {
    padding: "5px 12px",
    borderRadius: 12,
    border: "1px solid #d0d7de",
    background: "#eef2ff",
    cursor: "pointer",
    fontSize: 13,
  },
  deleteBtn: {
    padding: "5px 14px",
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fee2e2",
    color: "#b91c1c",
    cursor: "pointer",
    fontSize: 13,
  },
  placeholder: {
    textAlign: "center",
    color: "#64748b",
    padding: 32,
  },
  error: {
    color: "#dc2626",
    fontSize: 13,
  },
  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  pageBtn: {
    padding: "6px 12px",
    borderRadius: 10,
    border: "1px solid #d0d7de",
    background: "#fff",
    cursor: "pointer",
    minWidth: 70,
  },
  pageInfo: {
    fontSize: 13,
    color: "#475569",
  },
};

export default KnowledgeBasesPage;

