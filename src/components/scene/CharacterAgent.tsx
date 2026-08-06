import { JellyAgent } from "@/components/scene/JellyAgent";
import type { ArenaAgent } from "@/lib/types";

interface CharacterAgentProps {
  agent: ArenaAgent;
  selected: boolean;
  onClick: () => void;
}

/** Characters are procedural low-poly figures (same visual family as arena props). */
export function CharacterAgent(props: CharacterAgentProps) {
  return <JellyAgent {...props} />;
}

export { JellyAgent };
