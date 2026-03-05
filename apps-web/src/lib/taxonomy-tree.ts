import { TaxonomyNodeType } from "../generated/prisma/enums";

export type NodeWithChildren = {
  id: string;
  name: string;
  nodeType: TaxonomyNodeType;
  parentId: string | null;
  sortOrder: number;
  children: NodeWithChildren[];
};

export function buildTree(
  flatNodes: {
    id: string;
    name: string;
    nodeType: TaxonomyNodeType;
    parentId: string | null;
    sortOrder: number;
  }[],
): NodeWithChildren[] {
  const map = new Map<string, NodeWithChildren>();
  const roots: NodeWithChildren[] = [];

  for (const n of flatNodes) {
    map.set(n.id, { ...n, children: [] });
  }
  for (const n of flatNodes) {
    const node = map.get(n.id)!;
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sort = (arr: NodeWithChildren[]) => {
    arr.sort((a, b) => a.sortOrder - b.sortOrder);
    arr.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}
