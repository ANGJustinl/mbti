import { proxySecondMeJson } from "../../../../../lib/secondme/proxy";

export async function GET() {
  return proxySecondMeJson("/api/secondme/user/softmemory", {
    method: "GET",
  });
}

