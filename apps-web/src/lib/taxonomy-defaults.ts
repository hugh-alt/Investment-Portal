import { TaxonomyNodeType } from "../generated/prisma/enums";

export const DEFAULT_NODES: {
  name: string;
  nodeType: TaxonomyNodeType;
  sortOrder: number;
}[] = [
  { name: "Growth", nodeType: TaxonomyNodeType.RISK, sortOrder: 0 },
  { name: "Defensive", nodeType: TaxonomyNodeType.RISK, sortOrder: 1 },
];
