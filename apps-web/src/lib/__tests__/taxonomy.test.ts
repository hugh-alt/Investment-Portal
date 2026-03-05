import { describe, it, expect } from "vitest";
import { buildTree, type NodeWithChildren } from "../taxonomy-tree";
import { DEFAULT_NODES } from "../taxonomy-defaults";
import { TaxonomyNodeType } from "../../generated/prisma/enums";

describe("DEFAULT_NODES", () => {
  it("contains only Growth and Defensive as RISK nodes", () => {
    expect(DEFAULT_NODES).toHaveLength(2);
    expect(DEFAULT_NODES.every((n) => n.nodeType === TaxonomyNodeType.RISK)).toBe(true);
    expect(DEFAULT_NODES.map((n) => n.name)).toEqual(["Growth", "Defensive"]);
  });

  it("does not contain LIQUIDITY nodes", () => {
    const liq = DEFAULT_NODES.filter(
      (n) => n.nodeType === TaxonomyNodeType.LIQUIDITY,
    );
    expect(liq).toHaveLength(0);
  });

  it("has unique sort orders", () => {
    const orders = DEFAULT_NODES.map((n) => n.sortOrder);
    expect(new Set(orders).size).toBe(orders.length);
  });
});

describe("buildTree", () => {
  it("returns flat root nodes when no parents", () => {
    const flat = [
      { id: "a", name: "A", nodeType: TaxonomyNodeType.RISK, parentId: null, sortOrder: 1 },
      { id: "b", name: "B", nodeType: TaxonomyNodeType.RISK, parentId: null, sortOrder: 0 },
    ];
    const tree = buildTree(flat);
    expect(tree).toHaveLength(2);
    expect(tree[0].name).toBe("B"); // sortOrder 0 first
    expect(tree[1].name).toBe("A");
  });

  it("nests children under parents", () => {
    const flat = [
      { id: "root", name: "Root", nodeType: TaxonomyNodeType.RISK, parentId: null, sortOrder: 0 },
      { id: "child1", name: "Child 1", nodeType: TaxonomyNodeType.ASSET_CLASS, parentId: "root", sortOrder: 0 },
      { id: "child2", name: "Child 2", nodeType: TaxonomyNodeType.ASSET_CLASS, parentId: "root", sortOrder: 1 },
    ];
    const tree = buildTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].name).toBe("Child 1");
    expect(tree[0].children[1].name).toBe("Child 2");
  });

  it("sorts children by sortOrder", () => {
    const flat = [
      { id: "root", name: "Root", nodeType: TaxonomyNodeType.RISK, parentId: null, sortOrder: 0 },
      { id: "c", name: "C", nodeType: TaxonomyNodeType.ASSET_CLASS, parentId: "root", sortOrder: 2 },
      { id: "a", name: "A", nodeType: TaxonomyNodeType.ASSET_CLASS, parentId: "root", sortOrder: 0 },
      { id: "b", name: "B", nodeType: TaxonomyNodeType.ASSET_CLASS, parentId: "root", sortOrder: 1 },
    ];
    const tree = buildTree(flat);
    expect(tree[0].children.map((c: NodeWithChildren) => c.name)).toEqual(["A", "B", "C"]);
  });

  it("handles deeply nested trees", () => {
    const flat = [
      { id: "l1", name: "L1", nodeType: TaxonomyNodeType.RISK, parentId: null, sortOrder: 0 },
      { id: "l2", name: "L2", nodeType: TaxonomyNodeType.ASSET_CLASS, parentId: "l1", sortOrder: 0 },
      { id: "l3", name: "L3", nodeType: TaxonomyNodeType.SUB_ASSET, parentId: "l2", sortOrder: 0 },
    ];
    const tree = buildTree(flat);
    expect(tree[0].children[0].children[0].name).toBe("L3");
  });
});
