import { useEffect } from "react";
import {
  createChatterRuntime,
  disposeChatterRuntime,
  pauseChatterRuntime,
  resumeChatterRuntime,
  tickAgentChatter,
} from "@/lib/ai/chatter";
import {
  createConversationRuntime,
  disposeConversationRuntime,
  tickConversation,
} from "@/lib/ai/conversationLoop";
import { drainPendingArenaReplies } from "@/lib/ai/arenaChat";

/** Background loop: idle mutters, conversation turns, and queued arena replies. */
export function AgentChatterLoop() {
  useEffect(() => {
    const chatterRt = createChatterRuntime();
    const conversationRt = createConversationRuntime();
    const id = window.setInterval(() => {
      tickAgentChatter(chatterRt);
      tickConversation(conversationRt);
      drainPendingArenaReplies();
    }, 1000);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        pauseChatterRuntime(chatterRt);
        tickConversation(conversationRt);
      } else {
        resumeChatterRuntime(chatterRt);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(id);
      disposeChatterRuntime(chatterRt);
      disposeConversationRuntime(conversationRt);
    };
  }, []);

  return null;
}
