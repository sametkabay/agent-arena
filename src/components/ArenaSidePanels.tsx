import { useEffect, useState } from "react";
import { AgentList } from "@/components/AgentList";
import { MapList } from "@/components/MapList";
import { appConfig } from "@/lib/config";

const STORAGE_KEY = appConfig.storage.sidePanelsKey;

type SidePanelOpenState = {
  agents: boolean;
  maps: boolean;
};

function loadOpenState(): SidePanelOpenState {
  // Default to collapsed on narrow viewports so the lists don't cover the
  // scene on first visit; a saved preference always wins.
  const defaults = { agents: window.innerWidth > 720, maps: window.innerWidth > 720 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<SidePanelOpenState>;
    return {
      agents: parsed.agents ?? defaults.agents,
      maps: parsed.maps ?? defaults.maps,
    };
  } catch {
    return defaults;
  }
}

/** Left HUD column: agents + maps, matching panel size. */
export function ArenaSidePanels() {
  const [open, setOpen] = useState<SidePanelOpenState>(loadOpenState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(open));
  }, [open]);

  return (
    <aside className="arena-side-panels">
      <AgentList
        collapsed={!open.agents}
        onToggle={() => setOpen((s) => ({ ...s, agents: !s.agents }))}
      />
      <MapList
        collapsed={!open.maps}
        onToggle={() => setOpen((s) => ({ ...s, maps: !s.maps }))}
      />
    </aside>
  );
}
