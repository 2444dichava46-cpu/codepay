import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppHeader from "../AppHeader";
import ProfileForm from "@/components/ProfileForm";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "DEVELOPER") redirect("/dashboard");

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { developerProfile: true },
  });
  if (!user) redirect("/login");
  const p = user.developerProfile;

  return (
    <div>
      <AppHeader name={user.name} role={user.role} />
      <div className="wrap" style={{ maxWidth: 760, padding: "28px 24px 64px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Meu perfil</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: 20, fontSize: 13.5 }}>
          Estas informações aparecem para os clientes no seu perfil público.
        </p>
        <ProfileForm
          initial={{
            name: user.name,
            email: user.email,
            photoUrl: p?.photoUrl ?? null,
            headline: p?.headline ?? "",
            bio: p?.bio ?? "",
            location: p?.location ?? "",
            availability: p?.availability ?? "",
            hourlyRate: p?.hourlyRate != null ? String(p.hourlyRate) : "",
            technologies: p?.technologies ?? "",
            specialties: p?.specialties ?? "",
            portfolio: p?.portfolio ?? "",
          }}
        />
      </div>
    </div>
  );
}
