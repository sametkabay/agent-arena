import { useTranslation } from "react-i18next";
import { useArenaStore } from "@/store/arenaStore";

export function AgentList() {
  const { t } = useTranslation();
  const agents = useArenaStore((s) => s.agents);
  const selectedAgentId = useArenaStore((s) => s.selectedAgentId);
  const selectAgent = useArenaStore((s) => s.selectAgent);

  return (
    <aside className="agent-list">
      <div className="agent-list__header">{t("agentList.title")}</div>
      <div className="agent-list__items">
        {agents.length === 0 ? (
          <div className="agent-list__empty">{t("agentList.empty")}</div>
        ) : (
          agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className={
                "agent-list__item" +
                (selectedAgentId === agent.id ? " agent-list__item--active" : "")
              }
              onClick={() => selectAgent(agent.id)}
            >
              <span
                className="agent-list__swatch"
                style={{ background: agent.color }}
                aria-hidden
              />
              <span className="agent-list__meta">
                <span className="agent-list__name">{agent.displayName}</span>
                <span className="agent-list__bio">{agent.bio || t("agentList.talk")}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
