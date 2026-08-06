import { useEffect } from "react";
import { NameGate } from "@/components/NameGate";
import { Hud } from "@/components/Hud";
import { AgentList } from "@/components/AgentList";
import { ChatPanel } from "@/components/ChatPanel";
import { SettingsModal } from "@/components/SettingsModal";
import { MapEditor } from "@/components/MapEditor";
import { ArenaScene } from "@/components/scene/ArenaScene";
import { useArenaStore } from "@/store/arenaStore";

export default function App() {
  const hydrate = useArenaStore((s) => s.hydrate);
  const userName = useArenaStore((s) => s.userName);
  const toast = useArenaStore((s) => s.toast);
  const mapEditorOpen = useArenaStore((s) => s.mapEditorOpen);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!userName) {
    return <NameGate />;
  }

  return (
    <div className="app">
      {!mapEditorOpen && <ArenaScene />}
      {!mapEditorOpen && (
        <>
          <Hud />
          <AgentList />
          <ChatPanel />
          <SettingsModal />
        </>
      )}
      <MapEditor />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
