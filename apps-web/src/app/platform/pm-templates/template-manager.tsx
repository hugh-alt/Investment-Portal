"use client";

import { useState, useActionState } from "react";
import {
  saveTemplateAction,
  toggleTemplateStatusAction,
  setFundDefaultTemplateAction,
  type TemplateFormState,
} from "./actions";

type Template = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
};

type FundTruthRow = {
  fundId: string;
  fundName: string;
  defaultTemplateId: string | null;
  defaultTemplateName: string | null;
};

const initialState: TemplateFormState = {};

// ── Template List ──────────────────────────────────────

export function TemplateList({ templates }: { templates: Template[] }) {
  return (
    <div className="mt-4">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="py-2 font-medium text-zinc-500">Name</th>
            <th className="py-2 font-medium text-zinc-500">Description</th>
            <th className="py-2 font-medium text-zinc-500">Status</th>
            <th className="py-2 font-medium text-zinc-500">Actions</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <TemplateRow key={t.id} template={t} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TemplateRow({ template }: { template: Template }) {
  const [state, action, pending] = useActionState(toggleTemplateStatusAction, initialState);
  const newStatus = template.status === "ACTIVE" ? "RETIRED" : "ACTIVE";

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800/50">
      <td className="py-2 font-medium text-zinc-900 dark:text-zinc-100">{template.name}</td>
      <td className="py-2 text-zinc-500">{template.description ?? "—"}</td>
      <td className="py-2">
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
            template.status === "ACTIVE"
              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
          }`}
        >
          {template.status}
        </span>
      </td>
      <td className="py-2">
        <form action={action}>
          <input type="hidden" name="id" value={template.id} />
          <input type="hidden" name="newStatus" value={newStatus} />
          <button
            type="submit"
            disabled={pending}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
          >
            {pending ? "..." : newStatus === "RETIRED" ? "Retire" : "Activate"}
          </button>
        </form>
        {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      </td>
    </tr>
  );
}

// ── Create Template Form ───────────────────────────────

export function CreateTemplateForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(saveTemplateAction, initialState);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        New Template
      </button>
    );
  }

  return (
    <form action={action} className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">New Projection Template</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-zinc-500">Name</label>
          <input name="name" required className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500">Description</label>
          <input name="description" className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-zinc-500">Call Curve JSON (cumulative % array)</label>
          <textarea name="callCurvePctJson" required rows={3} placeholder='[{"month":"2026-04","cumPct":0.1}]' className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-zinc-500">Dist Curve JSON (cumulative % array)</label>
          <textarea name="distCurvePctJson" required rows={3} placeholder='[{"month":"2026-04","cumPct":0}]' className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        </div>
      </div>
      {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="mt-2 text-sm text-green-600">Template created.</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
          {pending ? "Saving..." : "Create"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Fund Default Template Assignment ───────────────────

export function FundDefaultTable({
  funds,
  templates,
}: {
  funds: FundTruthRow[];
  templates: Template[];
}) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Default Template per Fund</h3>
      <table className="mt-2 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="py-2 font-medium text-zinc-500">Fund</th>
            <th className="py-2 font-medium text-zinc-500">Current Default</th>
            <th className="py-2 font-medium text-zinc-500">Set Default</th>
          </tr>
        </thead>
        <tbody>
          {funds.map((f) => (
            <FundDefaultRow key={f.fundId} fund={f} templates={templates} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FundDefaultRow({ fund, templates }: { fund: FundTruthRow; templates: Template[] }) {
  const [state, action, pending] = useActionState(setFundDefaultTemplateAction, initialState);
  const activeTemplates = templates.filter((t) => t.status === "ACTIVE");

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800/50">
      <td className="py-2 text-zinc-900 dark:text-zinc-100">{fund.fundName}</td>
      <td className="py-2 text-zinc-500">{fund.defaultTemplateName ?? "None"}</td>
      <td className="py-2">
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="fundId" value={fund.fundId} />
          <select
            name="templateId"
            defaultValue={fund.defaultTemplateId ?? ""}
            className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="" disabled>Select...</option>
            {activeTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button type="submit" disabled={pending} className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300">
            {pending ? "..." : "Set"}
          </button>
        </form>
        {state.error && <p className="text-xs text-red-600">{state.error}</p>}
        {state.success && <p className="text-xs text-green-600">Updated.</p>}
      </td>
    </tr>
  );
}
