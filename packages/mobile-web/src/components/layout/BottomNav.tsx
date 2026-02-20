import React from "react";
import type { LucideIcon } from "lucide-react";
import {
  MessageCircle,
  Settings,
  Sparkles,
  TerminalSquare,
  Wrench,
} from "lucide-react";
import { useMobileI18n } from "../../i18n/provider";

export type MobileTabKey =
  | "chat"
  | "terminal"
  | "skills"
  | "tools"
  | "settings";

interface BottomNavProps {
  activeTab: MobileTabKey;
  onChange: (tab: MobileTabKey) => void;
}

const TABS: Array<{ key: MobileTabKey; icon: LucideIcon }> = [
  { key: "chat", icon: MessageCircle },
  { key: "terminal", icon: TerminalSquare },
  { key: "skills", icon: Sparkles },
  { key: "tools", icon: Wrench },
  { key: "settings", icon: Settings },
];

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChange,
}) => {
  const { t } = useMobileI18n();
  const labels: Record<MobileTabKey, string> = {
    chat: t.tabs.chat,
    terminal: t.tabs.terminal,
    skills: t.tabs.skills,
    tools: t.tabs.tools,
    settings: t.tabs.settings,
  };

  return (
    <nav className="bottom-nav" aria-label={t.tabs.navLabel}>
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const label = labels[tab.key];
        return (
          <button
            key={tab.key}
            type="button"
            className={`bottom-nav-item ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => onChange(tab.key)}
            aria-label={label}
            title={label}
          >
            <Icon size={16} />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </nav>
  );
};
