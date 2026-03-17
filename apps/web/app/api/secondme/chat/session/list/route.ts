import { proxySecondMeGet } from "../../../../../../lib/secondme/proxy";

export async function GET(request: Request) {
  return proxySecondMeGet("/api/secondme/chat/session/list", request.url);
}
