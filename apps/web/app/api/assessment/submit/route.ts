import { failure, ok } from "../../../../lib/http";
import { resolveRequestUserContext } from "../../../../lib/request-user";
import { submitAssessment } from "../../../../lib/workflow";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        answers?: Array<{ questionId: string; optionKey: "A" | "B" }>;
        meta?: { userId?: string; name?: string; roleTag?: string };
      }
    | null;

  if (!body?.answers?.length) {
    return failure("answers is required");
  }

  try {
    const currentUser = await resolveRequestUserContext(request);
    if (!currentUser) {
      return failure("current user not found", 401);
    }

    const result = await submitAssessment({
      userId: currentUser.userId,
      name: body.meta?.name ?? currentUser.displayName,
      roleTag: body.meta?.roleTag ?? currentUser.roleTag,
      answers: body.answers,
    });

    return ok(result);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "assessment failed");
  }
}
