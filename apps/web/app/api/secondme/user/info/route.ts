import { proxySecondMeJson } from "../../../../../lib/secondme/proxy";

export async function GET() {
  return proxySecondMeJson("/api/secondme/user/info", {
    method: "GET",
  });
}

