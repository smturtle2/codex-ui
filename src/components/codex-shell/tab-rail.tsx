"use client";

type RailTab = {
  id: string;
  label: string;
  title?: string;
  active?: boolean;
  badge?: string | null;
};

type TabRailProps = {
  tabs: RailTab[];
  onSelect: (id: string) => void;
};

export function TabRail({ tabs, onSelect }: TabRailProps) {
  return (
    <nav className="shell-rail" aria-label="Shell panels">
      <div className="shell-rail-stack">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`shell-rail-tab ${tab.active ? "active" : ""}`}
            type="button"
            title={tab.title ?? tab.label}
            aria-pressed={tab.active}
            onClick={() => onSelect(tab.id)}
          >
            <span className="shell-rail-label">{tab.label}</span>
            {tab.badge ? <span className="shell-rail-badge">{tab.badge}</span> : null}
          </button>
        ))}
      </div>
    </nav>
  );
}
