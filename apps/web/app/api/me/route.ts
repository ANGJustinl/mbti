import { failure, ok } from "../../../lib/http";
import { resolveRequestUserContext } from "../../../lib/request-user";

export async function GET(request: Request) {
  try {
    const currentUser = await resolveRequestUserContext(request);

    return ok({
      authenticated: Boolean(currentUser && currentUser.source === "secondme"),
      currentUser,
      hasProfile: currentUser?.hasProfile ?? false,
      needsAssessment: currentUser?.needsAssessment ?? true,
    });
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "current user resolution failed",
      500,
    );
  }
}
