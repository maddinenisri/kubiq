interface TabNavProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function TabNav({ tabs, activeTab, onTabChange }: TabNavProps) {
  return (
    <nav className="flex bg-bg2 border-b border-border shrink-0">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`px-4 py-2 text-xs font-medium tracking-wide border-b-2 cursor-pointer transition-colors
            ${
              activeTab === tab
                ? "text-accent border-accent"
                : "text-dim border-transparent hover:text-text"
            }`}
        >
          {tab}
        </button>
      ))}
    </nav>
  );
}
