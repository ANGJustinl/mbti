import { proxySecondMeJson } from "../../../../../lib/secondme/proxy";

export async function POST(request: Request) {
  return proxySecondMeJson("/api/secondme/agent_memory/ingest", {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.text(),
  });
}
