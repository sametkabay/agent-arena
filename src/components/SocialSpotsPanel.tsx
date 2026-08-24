import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { sendSocialSpotChatMessage } from "@/lib/ai/socialChat";
import {
  agentsAssignedToSpot,
  seatedAgentsAtSpot,
} from "@/lib/maps/interactions";
import { useArenaStore } from "@/store/arenaStore";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
};

const KIND_ICON = {
  table_chat: "☕",
  bar_chat: "◒",
  open_mic: "♫",
} as const;

export function SocialSpotsPanel({ collapsed, onToggle }: Props) {
  const { t } = useTranslation();
  const activeMap = useArenaStore((s) => s.activeMap);
  const runtimeAgents = useArenaStore((s) => s.runtimeAgents);
  const agents = useArenaStore((s) => s.agents);
  const models = useArenaStore((s) => s.models);
  const selectedAgentId = useArenaStore((s) => s.selectedAgentId);
  const chatBusyById = useArenaStore((s) => s.chatBusyById);
  const commandAgentToInteraction = useArenaStore(
    (s) => s.commandAgentToInteraction,
  );
  const leaveInteraction = useArenaStore((s) => s.leaveInteraction);
  const spots = useMemo(
    () => activeMap?.interactionSpots ?? [],
    [activeMap?.interactionSpots],
  );
  const [activeSpotId, setActiveSpotId] = useState(spots[0]?.id ?? "");
  const [topic, setTopic] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!spots.some((spot) => spot.id === activeSpotId)) {
      setActiveSpotId(spots[0]?.id ?? "");
    }
  }, [activeSpotId, spots]);

  const activeSpot =
    spots.find((spot) => spot.id === activeSpotId) ?? spots[0];
  const selectedRuntime = runtimeAgents.find(
    (agent) => agent.id === selectedAgentId,
  );
  useEffect(() => {
    if (selectedRuntime?.interactionSpotId) {
      setActiveSpotId(selectedRuntime.interactionSpotId);
    }
  }, [selectedRuntime?.interactionSpotId]);
  const seated = activeSpot
    ? seatedAgentsAtSpot(runtimeAgents, activeSpot.id)
    : [];
  const modelIds = useMemo(() => new Set(models.map((model) => model.id)), [models]);
  const configsById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent])),
    [agents],
  );
  const conversationAgents = seated.filter((runtime) => {
    const config = configsById.get(runtime.id);
    return Boolean(
      config &&
        modelIds.has(config.modelConfigId) &&
        !chatBusyById[config.id],
    );
  });
  const selectedIsHere =
    Boolean(activeSpot) && selectedRuntime?.interactionSpotId === activeSpot?.id;
  const selectedIsSeated = selectedIsHere && selectedRuntime?.seated;
  const activeOccupancy = activeSpot
    ? agentsAssignedToSpot(runtimeAgents, activeSpot.id).length
    : 0;
  const isFull =
    Boolean(activeSpot) &&
    !selectedIsHere &&
    activeOccupancy >= activeSpot!.seats.length;

  if (spots.length === 0) return null;

  async function startConversation() {
    if (!activeSpot || !topic.trim() || sending || conversationAgents.length < 2) {
      return;
    }
    const message = topic.trim();
    setTopic("");
    setSending(true);
    try {
      await sendSocialSpotChatMessage(activeSpot.id, message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className={
        "side-panel social-spots" + (collapsed ? " side-panel--collapsed" : "")
      }
    >
      <button
        type="button"
        className="side-panel__header"
        aria-expanded={!collapsed}
        onClick={onToggle}
      >
        <span>{t("social.title")}</span>
        <span className="side-panel__chevron" aria-hidden>
          {collapsed ? "▸" : "▾"}
        </span>
      </button>
      {!collapsed && (
        <div className="social-spots__body">
          <div className="social-spots__tabs" role="tablist">
            {spots.map((spot) => {
              const occupancy = agentsAssignedToSpot(runtimeAgents, spot.id).length;
              const active = spot.id === activeSpot?.id;
              return (
                <button
                  key={spot.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={"social-spots__tab" + (active ? " is-active" : "")}
                  title={t(`social.spots.${spot.id}`, { defaultValue: spot.name })}
                  onClick={() => setActiveSpotId(spot.id)}
                >
                  <span aria-hidden>{KIND_ICON[spot.kind]}</span>
                  <span>{occupancy}/{spot.seats.length}</span>
                </button>
              );
            })}
          </div>

          {activeSpot && (
            <div className="social-spots__detail">
              <div className="social-spots__name">
                {t(`social.spots.${activeSpot.id}`, {
                  defaultValue: activeSpot.name,
                })}
              </div>
              <div className="social-spots__people">
                {seated.length === 0
                  ? t("social.empty")
                  : seated.map((runtime) => runtime.displayName).join(", ")}
              </div>

              {selectedIsSeated ? (
                <button
                  type="button"
                  className="social-spots__action social-spots__action--quiet"
                  onClick={() => selectedAgentId && leaveInteraction(selectedAgentId)}
                >
                  {t("social.standUp", { name: selectedRuntime?.displayName })}
                </button>
              ) : (
                <button
                  type="button"
                  className="social-spots__action"
                  disabled={!selectedAgentId || isFull || sending}
                  onClick={() =>
                    selectedAgentId &&
                    commandAgentToInteraction(selectedAgentId, activeSpot.id)
                  }
                >
                  {!selectedAgentId
                    ? t("social.selectAgent")
                    : isFull
                      ? t("social.full")
                      : selectedIsHere
                        ? t("social.onTheWay")
                        : t("social.sendHere", { name: selectedRuntime?.displayName })}
                </button>
              )}

              <form
                className="social-spots__form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void startConversation();
                }}
              >
                <input
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder={t("social.topicPlaceholder")}
                  disabled={sending || conversationAgents.length < 2}
                  maxLength={220}
                />
                <button
                  type="submit"
                  disabled={sending || conversationAgents.length < 2 || !topic.trim()}
                  title={
                    conversationAgents.length < 2 ? t("social.needTwo") : undefined
                  }
                >
                  {sending ? "…" : t("social.startChat")}
                </button>
              </form>
              {conversationAgents.length < 2 && (
                <div className="social-spots__hint">{t("social.needTwo")}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
