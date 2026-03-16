import { NextResponse } from "next/server";
import { getSessionUser, wealthGroupFilter } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const wgFilter = wealthGroupFilter(user);
  let where: Record<string, unknown> = {};
  if (wgFilter) where = { ...where, ...wgFilter };

  if (user.role === "ADVISER") {
    const adviser = await prisma.adviser.findUnique({ where: { userId: user.id } });
    if (adviser) where = { ...where, adviserId: adviser.id };
    else return NextResponse.json([]);
  }

  const clients = await prisma.client.findMany({
    where,
    select: {
      id: true,
      name: true,
      clientSAA: {
        select: { saa: { select: { name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = clients.map((c) => ({
    id: c.id,
    name: c.name,
    currentSaaName: c.clientSAA?.saa.name ?? null,
  }));

  return NextResponse.json(rows);
}
