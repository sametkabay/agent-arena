import raw from "../../../prompts.yaml";
import { interpolate, interpolateLines } from "@/lib/config/interpolate";

export const PROMPT_MODES = [
  "private_chat",
  "arena_broadcast",
  "arena_mention",
  "idle_mutter",
] as const;

export type ArenaPromptMode = (typeof PROMPT_MODES)[number];

export interface PromptModeSpec {
  channelId: string;
  how: string;
  lines: string[];
}

export interface PromptsFile {
  identity: string;
  language: string;
  internals: string;
  modes: Record<ArenaPromptMode, PromptModeSpec>;
  session: {
    heading: string;
    intro: string;
    block: string;
    speechDiscipline: string;
  };
  situation: {
    block: string;
    footer: string;
  };
  user: {
    idleMutter: string;
    arenaMention: string;
    arenaBroadcast: string;
  };
  connectionTest: {
    system: string;
    user: string;
  };
  skills: {
    heading: string;
    untitled: string;
  };
  labels: {
    none: string;
    noneListed: string;
    day: string;
    night: string;
  };
  briefs: {
    bioMax: number;
    promptMax: number;
  };
}

export const prompts = raw as PromptsFile;

export function promptMode(mode: ArenaPromptMode): PromptModeSpec {
  return prompts.modes[mode];
}

export function fillPrompt(
  template: string,
  vars: Record<string, string | number | undefined>,
): string {
  return interpolate(template, vars);
}

export function fillPromptLines(
  lines: string[],
  vars: Record<string, string | number | undefined>,
): string[] {
  return interpolateLines(lines, vars);
}
