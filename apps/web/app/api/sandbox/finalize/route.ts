import { failure, ok } from "../../../../lib/http";
import { resolveRequestUserContext } from "../../../../lib/request-user";
import { assertSessionActor, finalizeSandboxSession } from "../../../../lib/workflow";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        sessionId?: string;
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
    const result = await finalizeSandboxSession({
      sessionId: body.sessionId,
      userId: currentUser.userId,
    });

    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "sandbox finalize failed";
    const status = message === "session not found" ? 404 : message === "forbidden" ? 403 : 400;
    return failure(message, status);
  }
}
