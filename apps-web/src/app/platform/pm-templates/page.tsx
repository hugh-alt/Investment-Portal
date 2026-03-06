import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TemplateList, CreateTemplateForm, FundDefaultTable } from "./template-manager";

export default async function PMTemplatesPage() {
  await requireSuperAdmin();

  const templates = await prisma.pMProjectionTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });

  const funds = await prisma.pMFund.findMany({
    include: {
      truth: {
        include: { defaultTemplate: { select: { id: true, name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const templateData = templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
  }));

  const fundTruthData = funds.map((f) => ({
    fundId: f.id,
    fundName: f.name,
    defaultTemplateId: f.truth?.defaultTemplate?.id ?? null,
    defaultTemplateName: f.truth?.defaultTemplate?.name ?? null,
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        PM Projection Templates
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Platform truth data. Define call/distribution pace templates (fast/base/slow) and assign defaults per fund.
      </p>

      <TemplateList templates={templateData} />
      <CreateTemplateForm />
      <FundDefaultTable funds={fundTruthData} templates={templateData} />
    </div>
  );
}
