import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "./config";

type Props = {
  onSuccess: (token: string) => void;
};

const LoginPage = ({ onSuccess }: Props) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);

  // 自动带上上次的用户名
  useEffect(() => {
    const savedEmail = localStorage.getItem("kb-email");
    if (savedEmail) setEmail(savedEmail);
  }, []);

  const loginOnce = async (u: string, p: string) => {
    const res = await axios.post(`${API_BASE}/api/v1/login`, {
      identifier: u,
      password: p,
    });
    const t = res.data?.data?.token as string | undefined;
    if (!t) throw new Error("Login failed: token missing");
    return t;
  };

  const handleLogin = async () => {
    const u = email.trim();
    const p = password;
    if (!u || !p) {
      setError("Please enter email and password");
      return;
    }
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const token = await loginOnce(u, p);
      localStorage.setItem("kb-token", token);
      localStorage.setItem("kb-email", u);
      onSuccess(token);
      setPassword("");
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const detailMsg =
        typeof detail === "string" ? detail : detail?.msg || detail?.message;
      const rawMsg =
        detailMsg || e?.response?.data?.msg || e?.message || "";
      // 如果是用户不存在，引导去注册
      if (
        String(rawMsg).includes("不存在") ||
        String(rawMsg).includes("未找到") ||
        String(rawMsg).toLowerCase().includes("not found")
      ) {
        setShowRegister(true);
        setError("User not found, please register first");
      } else {
        setError(String(rawMsg || "Login failed, please check credentials"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const u = email.trim();
    const p = password;
    if (!u || !p) {
      setError("Please enter email and password");
      return;
    }
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/api/v1/register`, {
        password: p,
        email: u,
      });
      setInfo("Registration succeeded, please sign in.");
      setShowRegister(false);
      localStorage.setItem("kb-email", u);
      setPassword("");
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const msg =
        (typeof detail === "string" ? detail : detail?.msg || detail?.message) ||
        e?.response?.data?.msg ||
        e?.message ||
        "Register/login failed, please check credentials";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.hero}>
          <h1 style={styles.heroTitle}>Knowledge Base Studio</h1>
          <p style={styles.heroDesc}>
            Converse with AI, capture every answer, and build a private knowledge
            brain you can search anytime.
          </p>
        </div>

        <div style={styles.card}>
          <h2 style={styles.title}>{showRegister ? "Sign up" : "Sign in"}</h2>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleLogin();
                }
              }}
            />
          </div>
          {error && <div style={styles.error}>{error}</div>}
          {info && <div style={styles.info}>{info}</div>}
          {showRegister ? (
            <button
              style={styles.btn}
              onClick={handleRegister}
              disabled={loading || !email.trim() || !password.trim()}
            >
              {loading ? "Please wait…" : "Sign up & sign in"}
            </button>
          ) : (
            <>
              <button
                style={styles.btn}
                onClick={handleLogin}
                disabled={loading || !email.trim() || !password.trim()}
              >
                {loading ? "Please wait…" : "Sign in"}
              </button>
              <button
                style={styles.secondaryBtn}
                onClick={() => setShowRegister(true)}
                disabled={loading}
              >
                New here? Create an account
              </button>
            </>
          )}
          {showRegister && (
            <button
              style={styles.secondaryBtn}
              onClick={() => {
                setShowRegister(false);
                setInfo(null);
                setError(null);
              }}
              disabled={loading}
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  container: {
    width: "100%",
    maxWidth: 1100,
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: 32,
    alignItems: "stretch",
    margin: "0 auto",
  },
  hero: {
    background:
      "linear-gradient(135deg, rgba(59,130,246,0.92), rgba(79,70,229,0.9))",
    borderRadius: 32,
    padding: 48,
    color: "#fff",
    boxShadow: "0 40px 70px rgba(59,130,246,0.35)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 38,
    margin: "0 0 18px",
  },
  heroDesc: {
    fontSize: 18,
    lineHeight: 1.6,
    margin: 0,
    maxWidth: 360,
  },
  card: {
    background: "rgba(255,255,255,0.98)",
    borderRadius: 24,
    padding: 32,
    boxShadow: "0 30px 55px rgba(15,23,42,0.15)",
  },
  title: {
    margin: "0 0 16px",
    fontSize: 24,
    color: "#0f172a",
    fontWeight: 600,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 12,
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
  btn: {
    width: "100%",
    padding: "12px 0",
    borderRadius: 12,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontSize: 15,
    cursor: "pointer",
    marginTop: 4,
    boxShadow: "0 15px 30px rgba(37,99,235,0.35)",
  },
  secondaryBtn: {
    width: "100%",
    padding: "10px 0",
    borderRadius: 12,
    border: "1px solid #d0d7de",
    background: "#fff",
    color: "#0f172a",
    fontSize: 15,
    cursor: "pointer",
    marginTop: 8,
  },
  error: {
    color: "#dc2626",
    fontSize: 12,
    marginBottom: 4,
  },
  info: {
    color: "#059669",
    fontSize: 13,
    marginTop: 6,
  },
};

export default LoginPage;

