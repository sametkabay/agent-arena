import { useEffect, type RefObject } from "react";
import { useArenaStore } from "@/store/arenaStore";

type ExportTarget = "agents" | "models" | "map";

/** Focus + brief highlight the export control when settingsFocusExport matches. */
export function useFocusExport(
  target: ExportTarget,
  ref: RefObject<HTMLElement | null>,
): void {
  const settingsFocusExport = useArenaStore((s) => s.settingsFocusExport);
  const clearSettingsFocusExport = useArenaStore(
    (s) => s.clearSettingsFocusExport,
  );

  useEffect(() => {
    if (settingsFocusExport !== target) return;
    clearSettingsFocusExport();
    const btn = ref.current;
    if (!btn) return;
    btn.scrollIntoView({ block: "nearest" });
    btn.focus();
    btn.classList.add("settings-export-focus");
    const timer = window.setTimeout(() => {
      btn.classList.remove("settings-export-focus");
    }, 2000);
    return () => {
      window.clearTimeout(timer);
      btn.classList.remove("settings-export-focus");
    };
  }, [settingsFocusExport, clearSettingsFocusExport, target, ref]);
}
