import { useTranslation } from "react-i18next";
import { useArenaStore } from "@/store/arenaStore";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
};

export function AgentList({ collapsed, onToggle }: Props) {
  const { t } = useTranslation();
  const agents = useArenaStore((s) => s.agents);
  const activeAgents = agents.filter((a) => a.enabled !== false);
  const selectedAgentId = useArenaStore((s) => s.selectedAgentId);
  const selectAgent = useArenaStore((s) => s.selectAgent);
  const setSettingsTab = useArenaStore((s) => s.setSettingsTab);

  return (
    <div
      className={
        "side-panel agent-list" + (collapsed ? " side-panel--collapsed" : "")
      }
    >
      <button
        type="button"
        className="side-panel__header"
        aria-expanded={!collapsed}
        onClick={onToggle}
      >
        <span>{t("agentList.title")}</span>
        <span className="side-panel__chevron" aria-hidden>
          {collapsed ? "▸" : "▾"}
        </span>
      </button>
      {!collapsed && (
        <div className="side-panel__items">
          {activeAgents.length === 0 ? (
            <button
              type="button"
              className="side-panel__empty side-panel__empty--action"
              onClick={() => setSettingsTab("agents")}
            >
              {t("agentList.empty")}
            </button>
          ) : (
            activeAgents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                className={
                  "side-panel__item" +
                  (selectedAgentId === agent.id
                    ? " side-panel__item--active"
                    : "")
                }
                onClick={() => selectAgent(agent.id)}
              >
                <span
                  className="side-panel__swatch"
                  style={{ background: agent.color }}
                  aria-hidden
                />
                <span className="side-panel__meta">
                  <span className="side-panel__name">{agent.displayName}</span>
                  <span className="side-panel__bio">
                    {agent.bio || t("agentList.talk")}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
