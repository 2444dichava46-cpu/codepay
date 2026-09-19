import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppHeader from "../../../AppHeader";
import EditProjectForm from "@/components/EditProjectForm";

export default async function EditProjectPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();
  if (project.clientId !== session.sub) redirect(`/projects/${params.id}`);
  if (project.status !== "OPEN") redirect(`/projects/${params.id}`);

  return (
    <div>
      <AppHeader name={session.name} role={session.role} />
      <div className="wrap" style={{ maxWidth: 640, padding: "40px 24px 64px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Editar projeto</h1>
        <EditProjectForm
          projectId={project.id}
          initial={{
            title: project.title,
            description: project.description,
            category: project.category,
            technologies: project.technologies,
            budgetMin: String(project.budgetMin),
            budgetMax: String(project.budgetMax),
            deadlineDays: String(project.deadlineDays),
          }}
        />
      </div>
    </div>
  );
}
