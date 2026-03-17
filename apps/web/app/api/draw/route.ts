import { failure, ok } from "../../../lib/http";

function buildLuckyNumber(seed: string) {
  return (
    seed.split("").reduce((total, char) => total + char.charCodeAt(0), 17) % 97
  ) + 3;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        mood?: string;
        ask?: string;
      }
    | null;

  if (!body?.mood && !body?.ask) {
    return failure("mood or ask is required");
  }

  const seed = `${body?.mood ?? "steady"}-${body?.ask ?? "focus"}`;
  const luckyNumber = buildLuckyNumber(seed);

  return ok({
    requestId: `draw-${luckyNumber}`,
    matchedAgentType: luckyNumber % 2 === 0 ? "高压拆解型路人 Agent" : "情绪缓冲型路人 Agent",
    message:
      luckyNumber % 2 === 0
        ? "先别急着追求完美，把卡住你的那一步拆成三个最小动作。"
        : "你不是没能力，只是现在太靠近问题了。后退一步，你会重新看见路。",
    luckyNumber,
  });
}
