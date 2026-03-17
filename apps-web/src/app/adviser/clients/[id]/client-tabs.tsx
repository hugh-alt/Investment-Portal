"use client";

import { useState, useCallback, createContext, useContext } from "react";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "portfolio", label: "Portfolio" },
  { key: "sleeve", label: "Sleeve" },
  { key: "saa", label: "SAA" },
  { key: "rebalance", label: "Rebalance" },
  { key: "projections", label: "Projections" },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

/** Context to allow child components to switch tabs */
const TabSwitchContext = createContext<((tab: TabKey) => void) | null>(null);

export function useTabSwitch() {
  return useContext(TabSwitchContext);
}

export function ClientTabs({
  children,
}: {
  children: Record<TabKey, React.ReactNode>;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const switchTab = useCallback((tab: TabKey) => {
    setActiveTab(tab);
  }, []);

  return (
    <TabSwitchContext.Provider value={switchTab}>
      <div>
        {/* Tab bar */}
        <div className="border-b border-zinc-200">
          <nav className="flex gap-0 -mb-px" aria-label="Client tabs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === tab.key
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div className="mt-6">
          {children[activeTab]}
        </div>
      </div>
    </TabSwitchContext.Provider>
  );
}
