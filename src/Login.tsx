import { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

type Props = {
  onSuccess: (token: string) => void;
};

const LoginPage = ({ onSuccess }: Props) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);

  // 自动带上上次的用户名
  useEffect(() => {
    const savedEmail = localStorage.getItem("kb-email");
    if (savedEmail) setEmail(savedEmail);
  }, []);

  const loginOnce = async (u: string, p: string) => {
    const res = await axios.post(`${API_BASE}/api/v1/login`, {
      username: u,
      password: p,
    });
    const t = res.data?.data?.token as string | undefined;
    if (!t) throw new Error("登录失败：未返回 token");
    return t;
  };

  const handleLogin = async () => {
    const u = email.trim();
    const p = password;
    if (!u || !p) {
      setError("请输入邮箱和密码");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const token = await loginOnce(u, p);
      localStorage.setItem("kb-token", token);
      localStorage.setItem("kb-email", u);
      onSuccess(token);
      setPassword("");
    } catch (e: any) {
      const rawMsg =
        e?.response?.data?.msg ||
        e?.response?.data?.detail ||
        e?.message ||
        "";
      // 如果是用户不存在，引导去注册
      if (String(rawMsg).includes("不存在") || String(rawMsg).includes("未找到")) {
        setShowRegister(true);
        setError("用户名不存在，请先注册");
      } else {
        setError(
          String(
            rawMsg ||
              "登录失败，请检查邮箱/密码"
          )
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const u = email.trim();
    const p = password;
    if (!u || !p) {
      setError("请输入邮箱和密码");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const randomUsername =
        "user-" +
        (crypto?.randomUUID
          ? crypto.randomUUID().slice(0, 8)
          : Math.random().toString(36).slice(2, 10));
      await axios.post(`${API_BASE}/api/v1/register`, {
        username: randomUsername,
        password: p,
        email: u,
      });
      const token = await loginOnce(u, p);
      localStorage.setItem("kb-token", token);
      localStorage.setItem("kb-email", u);
      onSuccess(token);
      setPassword("");
    } catch (e: any) {
      const msg =
        e?.response?.data?.msg ||
        e?.response?.data?.detail ||
        e?.message ||
        "注册或登录失败，请检查邮箱/密码";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>{showRegister ? "注册" : "登录"}</h2>
        <div style={styles.field}>
          <label style={styles.label}>邮箱</label>
          <input
            style={styles.input}
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>密码</label>
          <input
            style={styles.input}
            type="password"
            placeholder="密码"
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
        {showRegister ? (
          <button
            style={styles.btn}
            onClick={handleRegister}
            disabled={loading || !email.trim() || !password.trim()}
          >
            {loading ? "请稍候..." : "注册并登录"}
          </button>
        ) : (
          <>
            <button
              style={styles.btn}
              onClick={handleLogin}
              disabled={loading || !email.trim() || !password.trim()}
            >
              {loading ? "请稍候..." : "登录"}
            </button>
            <button
              style={styles.secondaryBtn}
              onClick={() => setShowRegister(true)}
              disabled={loading}
            >
              我是新用户，去注册
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f0f2f5",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "#fff",
    borderRadius: 12,
    padding: 24,
    boxShadow:
      "0 12px 24px rgba(15,23,42,0.08), 0 0 0 1px rgba(148,163,184,0.2)",
    boxSizing: "border-box",
  },
  title: {
    margin: "0 0 16px",
    fontSize: 20,
    color: "#0f172a",
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
    borderRadius: 8,
    border: "1px solid #d0d7de",
    fontSize: 14,
  },
  btn: {
    width: "100%",
    padding: "10px 0",
    borderRadius: 8,
    border: "none",
    background: "#1677ff",
    color: "#fff",
    fontSize: 15,
    cursor: "pointer",
    marginTop: 4,
  },
  secondaryBtn: {
    width: "100%",
    padding: "10px 0",
    borderRadius: 8,
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
};

export default LoginPage;

