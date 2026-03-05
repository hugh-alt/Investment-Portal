"use client";

import { useActionState, useState } from "react";
import {
  addNodeAction,
  renameNodeAction,
  deleteNodeAction,
  reorderNodeAction,
  type NodeActionState,
} from "../actions";
import type { NodeWithChildren } from "@/lib/taxonomy-tree";
import { TaxonomyNodeType } from "@/generated/prisma/enums";

/** Hierarchy rules: root → RISK, RISK → ASSET_CLASS, ASSET_CLASS → SUB_ASSET */
function childTypeFor(
  parentType: TaxonomyNodeType | null,
): { value: TaxonomyNodeType; label: string } | null {
  switch (parentType) {
    case null:
      return { value: TaxonomyNodeType.RISK, label: "Risk Bucket" };
    case TaxonomyNodeType.RISK:
      return { value: TaxonomyNodeType.ASSET_CLASS, label: "Asset Class" };
    case TaxonomyNodeType.ASSET_CLASS:
      return { value: TaxonomyNodeType.SUB_ASSET, label: "Sub-Asset" };
    default:
      return null; // SUB_ASSET and LIQUIDITY have no children
  }
}

const NODE_TYPE_LABELS: Record<string, string> = {
  RISK: "Risk Bucket",
  ASSET_CLASS: "Asset Class",
  SUB_ASSET: "Sub-Asset",
};

const NODE_TYPE_COLORS: Record<string, string> = {
  RISK: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  ASSET_CLASS:
    "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  SUB_ASSET:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

// ── TreeEditor root ──────────────────────────────────────

export function TreeEditor({
  taxonomyId,
  tree,
}: {
  taxonomyId: string;
  tree: NodeWithChildren[];
}) {
  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
        {Object.entries(NODE_TYPE_LABELS).map(([key, label]) => (
          <span
            key={key}
            className={`rounded px-1.5 py-0.5 ${NODE_TYPE_COLORS[key] ?? ""}`}
          >
            {label}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-1">
        {tree.map((node, idx) => (
          <TreeNode
            key={node.id}
            node={node}
            taxonomyId={taxonomyId}
            siblings={tree}
            index={idx}
            depth={0}
          />
        ))}
      </div>

      <AddNodeForm taxonomyId={taxonomyId} parentId={null} parentType={null} />
    </div>
  );
}

// ── Single tree node ─────────────────────────────────────

function TreeNode({
  node,
  taxonomyId,
  siblings,
  index,
  depth,
}: {
  node: NodeWithChildren;
  taxonomyId: string;
  siblings: NodeWithChildren[];
  index: number;
  depth: number;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canMoveUp = index > 0;
  const canMoveDown = index < siblings.length - 1;

  return (
    <div style={{ marginLeft: depth * 24 }}>
      <div className="group flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
        <span
          className={`rounded px-1.5 py-0.5 text-xs ${NODE_TYPE_COLORS[node.nodeType] ?? "bg-zinc-100 text-zinc-600"}`}
        >
          {NODE_TYPE_LABELS[node.nodeType] ?? node.nodeType}
        </span>

        {editing ? (
          <RenameForm
            taxonomyId={taxonomyId}
            nodeId={node.id}
            currentName={node.name}
            onDone={() => setEditing(false)}
          />
        ) : (
          <span className="flex-1 text-sm text-zinc-900 dark:text-zinc-100">
            {node.name}
          </span>
        )}

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Rename
            </button>
          )}
          {canMoveUp && (
            <button
              onClick={() =>
                reorderNodeAction(taxonomyId, node.id, siblings[index - 1].id)
              }
              className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              &uarr;
            </button>
          )}
          {canMoveDown && (
            <button
              onClick={() =>
                reorderNodeAction(taxonomyId, node.id, siblings[index + 1].id)
              }
              className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              &darr;
            </button>
          )}
          {confirmDelete ? (
            <>
              <span className="text-xs text-red-600">
                {node.children.length > 0
                  ? `Delete subtree (${node.children.length})?`
                  : "Delete?"}
              </span>
              <button
                onClick={() => deleteNodeAction(taxonomyId, node.id)}
                className="rounded bg-red-600 px-1.5 py-0.5 text-xs text-white hover:bg-red-700"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                No
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {node.children.length > 0 && (
        <div className="mt-1 flex flex-col gap-1">
          {node.children.map((child, idx) => (
            <TreeNode
              key={child.id}
              node={child}
              taxonomyId={taxonomyId}
              siblings={node.children}
              index={idx}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {childTypeFor(node.nodeType) && (
        <AddNodeForm
          taxonomyId={taxonomyId}
          parentId={node.id}
          parentType={node.nodeType}
          depth={depth + 1}
        />
      )}
    </div>
  );
}

// ── Rename inline form ───────────────────────────────────

function RenameForm({
  taxonomyId,
  nodeId,
  currentName,
  onDone,
}: {
  taxonomyId: string;
  nodeId: string;
  currentName: string;
  onDone: () => void;
}) {
  const initial: NodeActionState = {};
  const [state, formAction, pending] = useActionState(async (prev: NodeActionState, fd: FormData) => {
    const result = await renameNodeAction(prev, fd);
    if (!result.error) onDone();
    return result;
  }, initial);

  return (
    <form action={formAction} className="flex flex-1 items-center gap-2">
      <input type="hidden" name="taxonomyId" value={taxonomyId} />
      <input type="hidden" name="nodeId" value={nodeId} />
      <input
        name="name"
        defaultValue={currentName}
        autoFocus
        className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-2 py-1 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Save
      </button>
      <button
        type="button"
        onClick={onDone}
        className="text-xs text-zinc-500"
      >
        Cancel
      </button>
      {state.error && (
        <span className="text-xs text-red-600">{state.error}</span>
      )}
    </form>
  );
}

// ── Add node form ────────────────────────────────────────

function AddNodeForm({
  taxonomyId,
  parentId,
  parentType,
  depth = 0,
}: {
  taxonomyId: string;
  parentId: string | null;
  parentType: TaxonomyNodeType | null;
  depth?: number;
}) {
  const child = childTypeFor(parentType);
  const [open, setOpen] = useState(false);
  const initial: NodeActionState = {};
  const [state, formAction, pending] = useActionState(async (prev: NodeActionState, fd: FormData) => {
    const result = await addNodeAction(prev, fd);
    if (!result.error) setOpen(false);
    return result;
  }, initial);

  if (!child) return null;

  if (!open) {
    return (
      <div style={{ marginLeft: depth * 24 }}>
        <button
          onClick={() => setOpen(true)}
          className="mt-1 rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          + Add {child.label.toLowerCase()}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{ marginLeft: depth * 24 }}
      className="mt-1 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="taxonomyId" value={taxonomyId} />
        <input type="hidden" name="parentId" value={parentId ?? ""} />
        <input type="hidden" name="nodeType" value={child.value} />
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">{child.label} name</span>
          <input
            name="name"
            required
            autoFocus
            placeholder={`e.g. ${child.label}`}
            className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-3 py-1 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-zinc-500"
        >
          Cancel
        </button>
        {state.error && (
          <span className="text-xs text-red-600">{state.error}</span>
        )}
      </form>
    </div>
  );
}
