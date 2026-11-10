import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { useArenaStore } from "@/store/arenaStore";
import { GeneralTab } from "@/components/SettingsModal/GeneralTab";
import { ModelsTab } from "@/components/SettingsModal/ModelsTab";
import { AgentsTab } from "@/components/SettingsModal/AgentsTab";
import { MapTab } from "@/components/SettingsModal/MapTab";
import { GraphicsTab } from "@/components/SettingsModal/GraphicsTab";
import { SettingsNavProvider } from "@/components/SettingsModal/SettingsNavContext";
import { useSettingsNav } from "@/components/SettingsModal/settingsNav";
import {
  centeredScrollLeft,
  resolveTabKeyIndex,
  resolveTablistBlurFocusIndex,
  tabStripScrollEdgeAttr,
  tabStripScrollEdges,
} from "@/lib/settingsTabs";

const TABS = ["general", "models", "agents", "map", "graphics"] as const;

function SettingsModalChrome() {
  const { t, i18n } = useTranslation();
  const open = useArenaStore((s) => s.settingsOpen);
  const tab = useArenaStore((s) => s.settingsTab);
  const setSettingsOpen = useArenaStore((s) => s.setSettingsOpen);
  const setSettingsTab = useArenaStore((s) => s.setSettingsTab);
  const { canGoBack, goBack, saveVisible, saveDisabled, save } = useSettingsNav();
  const navRef = useRef<HTMLDivElement>(null);
  const [focusIndex, setFocusIndex] = useState(() =>
    Math.max(0, TABS.indexOf(tab as (typeof TABS)[number])),
  );
  const [scrollEdgeAttr, setScrollEdgeAttr] = useState("");

  useEffect(() => {
    const idx = TABS.indexOf(tab as (typeof TABS)[number]);
    if (idx >= 0) setFocusIndex(idx);
  }, [tab]);

  const updateScrollEdges = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const edges = tabStripScrollEdges({
      scrollLeft: nav.scrollLeft,
      clientWidth: nav.clientWidth,
      scrollWidth: nav.scrollWidth,
    });
    setScrollEdgeAttr(tabStripScrollEdgeAttr(edges));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLElement>(`#settings-tab-${tab}`);
    if (!active) return;
    const navRect = nav.getBoundingClientRect();
    const tabRect = active.getBoundingClientRect();
    const tabLeft = tabRect.left - navRect.left + nav.scrollLeft;
    nav.scrollLeft = centeredScrollLeft({
      tabLeft,
      tabWidth: tabRect.width,
      stripClientWidth: nav.clientWidth,
      stripScrollWidth: nav.scrollWidth,
    });
    updateScrollEdges();
  }, [tab, i18n.language, open, updateScrollEdges]);

  useEffect(() => {
    if (!open) return;
    const nav = navRef.current;
    if (!nav) return;
    updateScrollEdges();
    nav.addEventListener("scroll", updateScrollEdges, { passive: true });
    window.addEventListener("resize", updateScrollEdges);
    return () => {
      nav.removeEventListener("scroll", updateScrollEdges);
      window.removeEventListener("resize", updateScrollEdges);
    };
  }, [open, i18n.language, updateScrollEdges]);

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = resolveTabKeyIndex(event, index, TABS.length);
    if (next === null) return;
    event.preventDefault();
    setFocusIndex(next);
    const buttons = navRef.current?.querySelectorAll<HTMLElement>('[role="tab"]');
    buttons?.[next]?.focus();
  };

  const onTablistBlur = (event: FocusEvent<HTMLDivElement>) => {
    const selectedIndex = Math.max(0, TABS.indexOf(tab as (typeof TABS)[number]));
    const inside =
      event.relatedTarget instanceof Node &&
      !!navRef.current?.contains(event.relatedTarget);
    const next = resolveTablistBlurFocusIndex(inside, selectedIndex);
    if (next !== null) setFocusIndex(next);
  };

  if (!open) return null;

  return (
    <div
      className="settings-modal"
      role="dialog"
      aria-modal="true"
      aria-label={t("settings.title")}
      onClick={() => setSettingsOpen(false)}
    >
      <div className="settings-modal__card" onClick={(e) => e.stopPropagation()}>
        <div
          className="settings-modal__nav"
          role="tablist"
          aria-label={t("settings.title")}
          ref={navRef}
          data-scroll-edge={scrollEdgeAttr || undefined}
          onBlur={onTablistBlur}
        >
          <div className="settings-modal__nav-title" aria-hidden="true">
            {t("settings.title")}
          </div>
          {TABS.map((id, index) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`settings-tab-${id}`}
              aria-selected={tab === id}
              aria-controls="settings-tabpanel"
              tabIndex={focusIndex === index ? 0 : -1}
              className={tab === id ? "is-active" : undefined}
              onClick={() => setSettingsTab(id)}
              onKeyDown={(e) => onTabKeyDown(e, index)}
            >
              {t(`settings.tabs.${id}`)}
            </button>
          ))}
        </div>
        <div className="settings-modal__body">
          <header className="settings-modal__header">
            <div className="settings-modal__header-lead">
              {canGoBack && (
                <button
                  type="button"
                  className="settings-modal__back"
                  onClick={goBack}
                >
                  ← {t("settings.back")}
                </button>
              )}
              <h2>{t(`settings.tabs.${tab}`)}</h2>
            </div>
            <div className="settings-modal__header-actions">
              {saveVisible && (
                <button
                  type="button"
                  className="btn btn--primary settings-modal__save"
                  disabled={saveDisabled}
                  onClick={save}
                >
                  {t("settings.save")}
                </button>
              )}
              <button
                type="button"
                className="settings-modal__close"
                onClick={() => setSettingsOpen(false)}
              >
                {t("settings.close")}
              </button>
            </div>
          </header>
          <div
            className="settings-modal__content"
            id="settings-tabpanel"
            role="tabpanel"
            aria-labelledby={`settings-tab-${tab}`}
          >
            {tab === "general" && <GeneralTab />}
            {tab === "models" && <ModelsTab />}
            {tab === "agents" && <AgentsTab />}
            {tab === "map" && <MapTab />}
            {tab === "graphics" && <GraphicsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsModal() {
  const open = useArenaStore((s) => s.settingsOpen);
  const tab = useArenaStore((s) => s.settingsTab);

  if (!open) return null;

  return (
    <SettingsNavProvider resetKey={tab}>
      <SettingsModalChrome />
    </SettingsNavProvider>
  );
}
