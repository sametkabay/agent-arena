import { useEffect } from "react";
import {
  createChatterRuntime,
  disposeChatterRuntime,
  pauseChatterRuntime,
  resumeChatterRuntime,
  tickAgentChatter,
} from "@/lib/ai/chatter";

/** Background loop that asks each chatty agent for idle LLM mutters. */
export function AgentChatterLoop() {
  useEffect(() => {
    const rt = createChatterRuntime();
    const id = window.setInterval(() => tickAgentChatter(rt), 1000);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        pauseChatterRuntime(rt);
      } else {
        resumeChatterRuntime(rt);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(id);
      disposeChatterRuntime(rt);
    };
  }, []);

  return null;
}
