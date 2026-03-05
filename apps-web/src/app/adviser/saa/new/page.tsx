import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateSAAForm } from "./create-form";

export default async function NewSAAPage() {
  await requireUser();

  const taxonomies = await prisma.taxonomy.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans dark:bg-black">
      <div className="mx-auto max-w-lg">
        <Link
          href="/adviser/saa"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
        >
          &larr; Back to SAAs
        </Link>

        <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          New SAA
        </h1>

        <CreateSAAForm taxonomies={taxonomies} />
      </div>
    </div>
  );
}
