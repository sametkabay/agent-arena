import { useEffect } from "react";
import {
  createChatterRuntime,
  disposeChatterRuntime,
  tickAgentChatter,
} from "@/lib/ai/chatter";

/** Background loop that asks each chatty agent for idle LLM mutters. */
export function AgentChatterLoop() {
  useEffect(() => {
    const rt = createChatterRuntime();
    const id = window.setInterval(() => tickAgentChatter(rt), 1000);
    return () => {
      window.clearInterval(id);
      disposeChatterRuntime(rt);
    };
  }, []);

  return null;
}
