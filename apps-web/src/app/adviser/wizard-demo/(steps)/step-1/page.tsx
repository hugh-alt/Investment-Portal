"use client";

import { useDemoWizard } from "../../wizard-context";

export default function Step1Page() {
  const { data, update } = useDemoWizard();

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-700">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={data.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Enter a name..."
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        {data.name.trim().length === 0 && (
          <p className="mt-1 text-xs text-zinc-400">Required to proceed.</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-zinc-700">
          Description
        </label>
        <textarea
          id="description"
          value={data.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Optional description..."
          rows={3}
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </div>
    </div>
  );
}
