import { failure, ok } from "../../../../lib/http";
import { getDevelopmentActorOverride, resolveRequestUserContext } from "../../../../lib/request-user";
import { assertSessionActor, confirmReconnect } from "../../../../lib/workflow";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        sessionId?: string;
        actorUserId?: string;
        confirmed?: boolean;
      }
    | null;

  if (!body?.sessionId) {
    return failure("sessionId is required");
  }

  try {
    const currentUser = await resolveRequestUserContext(request);
    if (!currentUser) {
      return failure("current user not found", 401);
    }

    const overrideActor = currentUser.demoMode
      ? getDevelopmentActorOverride(request) ?? body?.actorUserId ?? null
      : null;
    const actorUserId = overrideActor ?? currentUser.userId;

    await assertSessionActor(body.sessionId, actorUserId);
    const result = await confirmReconnect({
      sessionId: body.sessionId,
      userId: actorUserId,
      confirmed: Boolean(body.confirmed),
    });

    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "reconnect confirm failed";
    const status = message === "session not found" ? 404 : message === "forbidden" ? 403 : 400;
    return failure(message, status);
  }
}
