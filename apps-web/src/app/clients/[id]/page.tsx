import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MappingScope, TaxonomyNodeType } from "@/generated/prisma/enums";
import { computeAllocation, type HoldingInput, type MappingInput } from "@/lib/allocation";
import { HoldingsTable } from "./holdings-table";
import { AllocationView } from "./allocation-view";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      adviser: true,
      accounts: {
        include: {
          holdings: {
            orderBy: { marketValue: "desc" },
            include: {
              product: true,
              lookthroughHoldings: {
                orderBy: { weight: "desc" },
                include: { underlyingProduct: true },
              },
            },
          },
        },
      },
    },
  });

  if (!client) notFound();

  // Adviser can only view their own clients
  if (user.role === "ADVISER") {
    const adviser = await prisma.adviser.findUnique({
      where: { userId: user.id },
    });
    if (!adviser || client.adviserId !== adviser.id) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
          <div className="max-w-sm text-center">
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Not authorised
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              You can only view your own clients.
            </p>
            <Link
              href="/clients"
              className="mt-4 inline-block text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
            >
              &larr; Back to clients
            </Link>
          </div>
        </div>
      );
    }
  }

  const totalValue = client.accounts.reduce(
    (sum, a) => sum + a.holdings.reduce((s, h) => s + h.marketValue, 0),
    0,
  );

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans dark:bg-black">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/clients"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
        >
          &larr; All clients
        </Link>

        <div className="mt-4 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {client.name}
          </h1>
          <span className="text-sm text-zinc-500">
            Total: ${totalValue.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
          </span>
        </div>

        {client.accounts.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-400">No accounts found.</p>
        ) : (
          <>
            {client.accounts.map((account) => (
              <div key={account.id} className="mt-6">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                    {account.accountName}
                  </h2>
                  <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {account.platform}
                  </span>
                </div>
                <HoldingsTable holdings={account.holdings} />
              </div>
            ))}

            <AllocationSection accounts={client.accounts} clientId={id} />
          </>
        )}
      </div>
    </div>
  );
}

async function AllocationSection({
  accounts,
  clientId,
}: {
  accounts: {
    holdings: {
      productId: string;
      marketValue: number;
      product: { name: string; type: string };
      lookthroughHoldings: {
        underlyingProductId: string;
        underlyingMarketValue: number;
        weight: number;
        underlyingProduct: { name: string };
      }[];
    }[];
  }[];
  clientId: string;
}) {
  // Find the first taxonomy with mappings
  const taxonomy = await prisma.taxonomy.findFirst({
    include: {
      nodes: true,
      productMaps: {
        where: {
          OR: [
            { scope: MappingScope.FIRM_DEFAULT },
            { scope: MappingScope.CLIENT_OVERRIDE, clientId },
          ],
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!taxonomy) return null;

  // Build risk bucket lookup: nodeId → ancestor risk bucket
  const riskBucketById = new Map<string, { id: string; name: string }>();
  const riskBuckets = taxonomy.nodes.filter((n) => n.nodeType === TaxonomyNodeType.RISK);
  for (const rb of riskBuckets) {
    riskBucketById.set(rb.id, { id: rb.id, name: rb.name });
  }
  // For asset class / sub-asset nodes, walk up to find risk bucket parent
  for (const n of taxonomy.nodes) {
    if (n.parentId && riskBucketById.has(n.parentId)) {
      riskBucketById.set(n.id, riskBucketById.get(n.parentId)!);
    }
  }
  // Second pass for sub-assets whose parent is asset class
  for (const n of taxonomy.nodes) {
    if (n.parentId && riskBucketById.has(n.parentId) && !riskBucketById.has(n.id)) {
      riskBucketById.set(n.id, riskBucketById.get(n.parentId)!);
    }
  }

  const nodeById = new Map(taxonomy.nodes.map((n) => [n.id, n]));

  // Build mapping inputs: client overrides take priority over firm defaults
  const mappingsByProduct = new Map<string, typeof taxonomy.productMaps[number]>();
  for (const m of taxonomy.productMaps) {
    const existing = mappingsByProduct.get(m.productId);
    if (!existing || m.scope === MappingScope.CLIENT_OVERRIDE) {
      mappingsByProduct.set(m.productId, m);
    }
  }

  const mappings: MappingInput[] = [];
  for (const [, m] of mappingsByProduct) {
    const node = nodeById.get(m.nodeId);
    if (!node) continue;
    const rb = riskBucketById.get(m.nodeId);
    mappings.push({
      productId: m.productId,
      nodeId: m.nodeId,
      nodeName: node.name,
      nodeType: node.nodeType,
      riskBucketId: rb?.id ?? null,
      riskBucketName: rb?.name ?? null,
    });
  }

  // Build holding inputs from all accounts
  const holdingInputs: HoldingInput[] = accounts.flatMap((a) =>
    a.holdings.map((h) => ({
      productId: h.productId,
      productName: h.product.name,
      productType: h.product.type,
      marketValue: h.marketValue,
      lookthrough: h.lookthroughHoldings.map((lt) => ({
        underlyingProductId: lt.underlyingProductId,
        underlyingProductName: lt.underlyingProduct.name,
        underlyingMarketValue: lt.underlyingMarketValue,
        weight: lt.weight,
      })),
    })),
  );

  const allocation = computeAllocation(holdingInputs, mappings);

  return <AllocationView allocation={allocation} />;
}
