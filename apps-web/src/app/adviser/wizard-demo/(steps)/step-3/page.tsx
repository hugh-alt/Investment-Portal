"use client";

import { useDemoWizard } from "../../wizard-context";

export default function Step3Page() {
  const { data } = useDemoWizard();

  const rows: { label: string; value: string }[] = [
    { label: "Name", value: data.name || "—" },
    { label: "Description", value: data.description || "—" },
    { label: "Category", value: data.category || "—" },
    { label: "Priority", value: data.priority.charAt(0).toUpperCase() + data.priority.slice(1) },
  ];

  return (
    <div>
      <div className="rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.label}
                className={i < rows.length - 1 ? "border-b border-zinc-100" : ""}
              >
                <td className="px-4 py-3 font-medium text-zinc-500 w-36">
                  {row.label}
                </td>
                <td className="px-4 py-3 text-zinc-900">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-zinc-400">
        Click Confirm to complete the wizard. This demo clears the draft and redirects to a success page.
      </p>
    </div>
  );
}
