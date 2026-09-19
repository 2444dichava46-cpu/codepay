"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível entrar.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 420, padding: "56px 24px" }}>
      <div className="logo" style={{ marginBottom: 28 }}><span className="mark">&lt;/&gt;</span> Code Pay</div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Entrar</h1>
      {error && <div className="error-box">{error}</div>}
      <form onSubmit={onSubmit} className="card" style={{ padding: 24 }}>
        <div className="form-group">
          <label>E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="login-email-input" />
        </div>
        <div className="form-group">
          <label>Senha</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="login-password-input" />
        </div>
        <button className="btn btn-primary btn-block" disabled={loading} data-testid="login-submit-button">
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: 13.5, color: "var(--text-muted)" }}>
        Não tem conta? <Link href="/register" style={{ color: "var(--primary)", fontWeight: 600 }}>Criar conta</Link>
      </p>
    </div>
  );
}
