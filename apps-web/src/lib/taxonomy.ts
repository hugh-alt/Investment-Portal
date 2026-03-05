import { prisma } from "./prisma";
import { TaxonomyNodeType } from "../generated/prisma/enums";
import { DEFAULT_NODES } from "./taxonomy-defaults";
export { DEFAULT_NODES } from "./taxonomy-defaults";
export { buildTree, type NodeWithChildren } from "./taxonomy-tree";

export async function createTaxonomyWithDefaults(
  name: string,
  userId: string,
  description?: string,
) {
  return prisma.taxonomy.create({
    data: {
      name,
      description,
      createdByUserId: userId,
      nodes: {
        create: DEFAULT_NODES.map((n) => ({
          name: n.name,
          nodeType: n.nodeType,
          sortOrder: n.sortOrder,
        })),
      },
    },
    include: { nodes: true },
  });
}

export async function getTaxonomyWithNodes(id: string) {
  return prisma.taxonomy.findUnique({
    where: { id },
    include: {
      nodes: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
    },
  });
}

export async function addNode(
  taxonomyId: string,
  parentId: string | null,
  name: string,
  nodeType: TaxonomyNodeType,
) {
  const maxSort = await prisma.taxonomyNode.aggregate({
    where: { taxonomyId, parentId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  return prisma.taxonomyNode.create({
    data: { taxonomyId, parentId, name, nodeType, sortOrder },
  });
}

export async function renameNode(nodeId: string, name: string) {
  return prisma.taxonomyNode.update({ where: { id: nodeId }, data: { name } });
}

export async function deleteNode(nodeId: string) {
  return prisma.taxonomyNode.delete({ where: { id: nodeId } });
}

export async function swapSortOrder(nodeIdA: string, nodeIdB: string) {
  const [a, b] = await Promise.all([
    prisma.taxonomyNode.findUniqueOrThrow({ where: { id: nodeIdA } }),
    prisma.taxonomyNode.findUniqueOrThrow({ where: { id: nodeIdB } }),
  ]);
  await prisma.$transaction([
    prisma.taxonomyNode.update({
      where: { id: nodeIdA },
      data: { sortOrder: b.sortOrder },
    }),
    prisma.taxonomyNode.update({
      where: { id: nodeIdB },
      data: { sortOrder: a.sortOrder },
    }),
  ]);
}
