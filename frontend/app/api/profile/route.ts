import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "DEVELOPER") {
    return NextResponse.json({ error: "Apenas programadores têm este perfil." }, { status: 403 });
  }
  const profile = await prisma.developerProfile.findUnique({
    where: { userId: session.sub },
  });
  return NextResponse.json({ profile });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "DEVELOPER") {
    return NextResponse.json({ error: "Apenas programadores têm este perfil." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const {
    name,
    headline,
    bio,
    location,
    availability,
    hourlyRate,
    technologies,
    specialties,
    portfolio,
    photoUrl,
  } = body ?? {};

  if (name != null && !String(name).trim()) {
    return NextResponse.json({ error: "O nome não pode ficar vazio." }, { status: 400 });
  }
  if (availability != null && availability !== "" && !["available", "busy"].includes(availability)) {
    return NextResponse.json({ error: "Disponibilidade inválida." }, { status: 400 });
  }
  if (hourlyRate != null && hourlyRate !== "" && !Number.isFinite(Number(hourlyRate))) {
    return NextResponse.json({ error: "Valor por hora inválido." }, { status: 400 });
  }

  // Name lives on User; the rest on DeveloperProfile.
  if (name != null && String(name).trim() !== session.name) {
    await prisma.user.update({
      where: { id: session.sub },
      data: { name: String(name).trim() },
    });
  }

  const rateValue =
    hourlyRate == null || hourlyRate === "" ? null : Number(hourlyRate);

  const profile = await prisma.developerProfile.upsert({
    where: { userId: session.sub },
    update: {
      photoUrl: photoUrl ?? undefined,
      headline: headline ?? undefined,
      bio: bio ?? undefined,
      location: location ?? undefined,
      availability: availability === "" ? null : (availability ?? undefined),
      hourlyRate: rateValue,
      technologies: technologies ?? undefined,
      specialties: specialties ?? undefined,
      portfolio: portfolio ?? undefined,
    },
    create: {
      userId: session.sub,
      photoUrl: photoUrl ?? null,
      headline: headline ?? null,
      bio: bio ?? null,
      location: location ?? null,
      availability: availability === "" ? null : (availability ?? null),
      hourlyRate: rateValue,
      technologies: technologies ?? "",
      specialties: specialties ?? "",
      portfolio: portfolio ?? null,
    },
  });

  return NextResponse.json({ profile });
}
