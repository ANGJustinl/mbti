import { failure, ok } from "../../../../lib/http";
import { resolveRequestUserContext } from "../../../../lib/request-user";
import { advanceSandboxRound, assertSessionActor } from "../../../../lib/workflow";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        sessionId?: string;
        roundIndex?: number;
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

    await assertSessionActor(body.sessionId, currentUser.userId);
    const result = await advanceSandboxRound({
      sessionId: body.sessionId,
      roundIndex: body.roundIndex,
    });

    return ok({
      sessionId: result.session.sessionId,
      topic: result.session.topic,
      state: result.session.state,
      round: result.round,
      conflictFlags: result.session.conflictFlags,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "sandbox round failed";
    const status = message === "session not found" ? 404 : message === "forbidden" ? 403 : 400;
    return failure(message, status);
  }
}
