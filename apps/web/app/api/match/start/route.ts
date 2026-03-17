import { failure, ok } from "../../../../lib/http";
import { resolveRequestUserContext } from "../../../../lib/request-user";
import { startMatch } from "../../../../lib/workflow";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        targetProfileId?: string;
        topicId?: string;
      }
    | null;

  if (!body?.targetProfileId) {
    return failure("targetProfileId is required");
  }

  try {
    const currentUser = await resolveRequestUserContext(request);
    if (!currentUser) {
      return failure("current user not found", 401);
    }

    const result = await startMatch({
      userId: currentUser.userId,
      targetProfileId: body.targetProfileId,
      topicId: body.topicId,
    });

    return ok(result);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "match start failed");
  }
}
