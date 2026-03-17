import { isDemoRequested, isDevelopmentMode, resolveCurrentUserContext } from "./current-user";

export async function resolveRequestUserContext(request: Request, options?: { allowDemoFallback?: boolean }) {
  const url = new URL(request.url);
  return resolveCurrentUserContext({
    allowDemoFallback: options?.allowDemoFallback ?? true,
    demoRequested: isDemoRequested(url.searchParams.get("demo")),
  });
}

export function getDevelopmentActorOverride(request: Request) {
  const url = new URL(request.url);
  const actor = url.searchParams.get("actor");
  if (!isDevelopmentMode() || !actor) {
    return null;
  }

  return actor;
}
