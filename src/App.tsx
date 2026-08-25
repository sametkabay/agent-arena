import { useEffect } from "react";
import { NameGate } from "@/components/NameGate";
import { Hud } from "@/components/Hud";
import { ArenaSidePanels } from "@/components/ArenaSidePanels";
import { ChatPanel } from "@/components/ChatPanel";
import { FloatingChatLog } from "@/components/FloatingChatLog";
import { AgentChatterLoop } from "@/components/AgentChatterLoop";
import { SettingsModal } from "@/components/SettingsModal";
import { MapEditor } from "@/components/MapEditor";
import { ArenaScene } from "@/components/scene/ArenaScene";
import { useArenaStore } from "@/store/arenaStore";
import { appConfig } from "@/lib/config";

export default function App() {
  const hydrate = useArenaStore((s) => s.hydrate);
  const hydrateUserAssetsFromDb = useArenaStore((s) => s.hydrateUserAssetsFromDb);
  const userName = useArenaStore((s) => s.userName);
  const toast = useArenaStore((s) => s.toast);
  const mapEditorOpen = useArenaStore((s) => s.mapEditorOpen);
  const dayNight = useArenaStore((s) => s.dayNight);

  useEffect(() => {
    hydrate();
    void hydrateUserAssetsFromDb();
  }, [hydrate, hydrateUserAssetsFromDb]);

  useEffect(() => {
    document.documentElement.dataset.dayNight = dayNight;
  }, [dayNight]);

  // Smooth day/night blend even when the arena Canvas is dormant (map editor open).
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = useArenaStore.getState();
      const target = s.dayNight === "night" ? 1 : 0;
      if (Math.abs(s.dayNightBlend - target) > 0.001) {
        const dir = target > s.dayNightBlend ? 1 : -1;
        let next = s.dayNightBlend + dir * appConfig.ui.dayNightBlendSpeed * dt;
        next = Math.min(1, Math.max(0, next));
        if (Math.abs(next - target) < 0.01) next = target;
        useArenaStore.setState({ dayNightBlend: next });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!userName) {
    return <NameGate />;
  }

  return (
    <div className="app" data-day-night={dayNight}>
      {/* Keep the arena WebGL context alive while the map editor is open —
          remounting the Canvas each time caused "Context Lost" warnings. */}
      <div
        className={
          "arena-layer" + (mapEditorOpen ? " arena-layer--dormant" : "")
        }
        aria-hidden={mapEditorOpen}
      >
        <ArenaScene dormant={mapEditorOpen} />
      </div>
      {!mapEditorOpen && (
        <>
          <Hud />
          <ArenaSidePanels />
          <ChatPanel />
          <FloatingChatLog />
          <AgentChatterLoop />
          <SettingsModal />
        </>
      )}
      <MapEditor />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
