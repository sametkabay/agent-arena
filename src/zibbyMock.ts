import { createMockStream } from "@zibby-run/app-kit/mock";

export const mockStreamZibbyAi = createMockStream({
  cannedAnswer: (req) => {
    if (req.action === "idle_mutter") return "Hmm.";
    return "Mock reply from Zibby. Nothing left the browser.";
  },
  quoteFor: () => 2,
});
