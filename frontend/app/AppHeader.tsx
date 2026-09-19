"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import NotificationBell from "@/components/NotificationBell";

export default function AppHeader({ name, role }: { name: string; role?: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="wrap site-header">
      <Link href="/" className="logo"><span className="mark">&lt;/&gt;</span> Code Pay</Link>
      <nav className="app-nav" style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 13.5, flexWrap: "wrap" }}>
        <Link href="/projects">Explorar projetos</Link>
        <Link href="/dashboard">Meu painel</Link>
        <Link href="/messages" data-testid="nav-messages-link">Mensagens</Link>
        {role === "DEVELOPER" && (
          <Link href="/profile" data-testid="nav-profile-link">Perfil</Link>
        )}
        <NotificationBell />
        <span style={{ fontWeight: 600 }}>{name}</span>
        <button className="btn btn-outline" onClick={logout} data-testid="logout-button">Sair</button>
      </nav>
    </header>
  );
}
