"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<"CLIENT" | "DEVELOPER">("CLIENT");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível criar a conta.");
        return;
      }
      router.push(role === "CLIENT" ? "/dashboard/client" : "/dashboard/developer");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 440, padding: "56px 24px" }}>
      <div className="logo" style={{ marginBottom: 28 }}><span className="mark">&lt;/&gt;</span> Code Pay</div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Criar conta</h1>
      {error && <div className="error-box">{error}</div>}
      <form onSubmit={onSubmit} className="card" style={{ padding: 24 }}>
        <div className="form-group">
          <label>Eu sou</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setRole("CLIENT")}
              className={role === "CLIENT" ? "btn btn-primary" : "btn btn-outline"} style={{ flex: 1 }} data-testid="register-role-client-button">
              Cliente
            </button>
            <button type="button" onClick={() => setRole("DEVELOPER")}
              className={role === "DEVELOPER" ? "btn btn-primary" : "btn btn-outline"} style={{ flex: 1 }} data-testid="register-role-developer-button">
              Programador
            </button>
          </div>
        </div>
        <div className="form-group">
          <label>Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required data-testid="register-name-input" />
        </div>
        <div className="form-group">
          <label>E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="register-email-input" />
        </div>
        <div className="form-group">
          <label>Senha</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} data-testid="register-password-input" />
        </div>
        <button className="btn btn-primary btn-block" disabled={loading} data-testid="register-submit-button">
          {loading ? "Criando conta…" : "Criar conta"}
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: 13.5, color: "var(--text-muted)" }}>
        Já tem conta? <Link href="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>Entrar</Link>
      </p>
    </div>
  );
}
