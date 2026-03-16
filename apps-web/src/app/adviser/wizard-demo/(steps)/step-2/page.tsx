"use client";

import { useDemoWizard } from "../../wizard-context";

const CATEGORIES = ["Equity", "Fixed Income", "Alternatives", "Cash"];
const PRIORITIES = ["low", "medium", "high"];

export default function Step2Page() {
  const { data, update } = useDemoWizard();

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-zinc-700">
          Category <span className="text-red-500">*</span>
        </label>
        <select
          id="category"
          value={data.category}
          onChange={(e) => update({ category: e.target.value })}
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          <option value="">Select a category...</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        {data.category.trim().length === 0 && (
          <p className="mt-1 text-xs text-zinc-400">Required to proceed.</p>
        )}
      </div>

      <div>
        <fieldset>
          <legend className="block text-sm font-medium text-zinc-700">Priority</legend>
          <div className="mt-2 flex gap-3">
            {PRIORITIES.map((p) => (
              <label
                key={p}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
                  data.priority === p
                    ? "border-amber-300 bg-amber-50 text-amber-700"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                <input
                  type="radio"
                  name="priority"
                  value={p}
                  checked={data.priority === p}
                  onChange={(e) => update({ priority: e.target.value })}
                  className="sr-only"
                />
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
