import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

// POST /api/profile/photo — multipart upload of the developer profile photo.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "DEVELOPER") {
    return NextResponse.json(
      { error: "Apenas programadores podem enviar foto de perfil." },
      { status: 403 }
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie uma imagem." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "A imagem deve ter no máximo 2MB." },
      { status: 400 }
    );
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Formato inválido. Use PNG, JPG, WEBP ou GIF." },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const fileName = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, fileName), bytes);

  const url = `/uploads/${fileName}`;
  await prisma.developerProfile.upsert({
    where: { userId: session.sub },
    update: { photoUrl: url },
    create: { userId: session.sub, photoUrl: url, technologies: "", specialties: "" },
  });

  return NextResponse.json({ url });
}
