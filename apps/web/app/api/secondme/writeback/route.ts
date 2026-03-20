import type { SecondMeWritebackMilestone } from "@dual-core/domain";

import { failure, ok } from "../../../../lib/http";
import { resolveRequestUserContext } from "../../../../lib/request-user";
import { processSecondMeWriteback } from "../../../../lib/secondme/writeback";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        milestone?: SecondMeWritebackMilestone;
        sessionId?: string;
        assessmentId?: string;
        consented?: boolean;
      }
    | null;

  if (!body?.milestone) {
    return failure("milestone is required");
  }

  try {
    const currentUser = await resolveRequestUserContext(request);
    if (!currentUser) {
      return failure("current user not found", 401);
    }

    const result = await processSecondMeWriteback({
      userId: currentUser.userId,
      milestone: body.milestone,
      sessionId: body.sessionId,
      assessmentId: body.assessmentId,
      consented: Boolean(body.consented),
    });

    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Second Me writeback failed";
    const status =
      message === "current user not found"
        ? 401
        : message === "assessment not found" || message === "session not found"
          ? 404
          : 400;

    return failure(message, status);
  }
}
