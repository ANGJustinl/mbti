import { failure, ok } from "../../../../lib/http";
import { resolveRequestUserContext } from "../../../../lib/request-user";
import { sendMatchSignal } from "../../../../lib/workflow";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        toUserId?: string;
      }
    | null;

  if (!body?.toUserId) {
    return failure("toUserId is required");
  }

  const currentUser = await resolveRequestUserContext(request, { allowDemoFallback: false });
  if (!currentUser) {
    return failure("current user not found", 401);
  }

  try {
    const result = await sendMatchSignal({
      fromUserId: currentUser.userId,
      toUserId: body.toUserId,
    });

    return ok(result);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "match signal failed");
  }
}
