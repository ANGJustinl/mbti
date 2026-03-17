import { proxySecondMeSse } from "../../../../../lib/secondme/proxy";

export async function POST(request: Request) {
  return proxySecondMeSse("/api/secondme/act/stream", request);
}

