import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const taxonomies = await prisma.taxonomy.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(taxonomies);
}
