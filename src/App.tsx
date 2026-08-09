import { useEffect } from "react";
import { NameGate } from "@/components/NameGate";
import { Hud } from "@/components/Hud";
import { AgentList } from "@/components/AgentList";
import { ChatPanel } from "@/components/ChatPanel";
import { SettingsModal } from "@/components/SettingsModal";
import { MapEditor } from "@/components/MapEditor";
import { ArenaScene } from "@/components/scene/ArenaScene";
import { useArenaStore } from "@/store/arenaStore";
import {
  unlockAmbience,
  setAmbienceProfile,
  setAmbienceDayNight,
  setAmbienceEnabled,
  setAmbienceVolume,
} from "@/lib/audio/ambienceBus";
import { resolveAmbienceId } from "@/lib/maps/ambience";

export default function App() {
  const hydrate = useArenaStore((s) => s.hydrate);
  const userName = useArenaStore((s) => s.userName);
  const toast = useArenaStore((s) => s.toast);
  const mapEditorOpen = useArenaStore((s) => s.mapEditorOpen);
  const dayNight = useArenaStore((s) => s.dayNight);
  const activeMap = useArenaStore((s) => s.activeMap);
  const graphics = useArenaStore((s) => s.graphics);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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
        let next = s.dayNightBlend + dir * 0.55 * dt;
        next = Math.min(1, Math.max(0, next));
        if (Math.abs(next - target) < 0.01) next = target;
        useArenaStore.setState({ dayNightBlend: next });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Procedural ambience (unlocked on first pointer/key — browser autoplay policy).
  useEffect(() => {
    const unlock = () => {
      void unlockAmbience();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const profile = activeMap ? resolveAmbienceId(activeMap) : "none";
    setAmbienceProfile(profile);
    setAmbienceDayNight(dayNight);
    setAmbienceEnabled(graphics.ambientAudio !== false);
    setAmbienceVolume(graphics.ambientVolume ?? 0.35);
  }, [activeMap, dayNight, graphics.ambientAudio, graphics.ambientVolume]);

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
