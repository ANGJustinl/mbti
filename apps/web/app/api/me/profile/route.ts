import { failure, ok } from "../../../../lib/http";
import { resolveRequestUserContext } from "../../../../lib/request-user";
import { getCurrentUserProfile } from "../../../../lib/workflow";

export async function GET(request: Request) {
  const currentUser = await resolveRequestUserContext(request);
  if (!currentUser) {
    return failure("current user not found", 401);
  }

  const payload = currentUser.hasProfile
    ? await getCurrentUserProfile(currentUser.userId)
    : null;

  return ok({
    currentUser,
    profile: payload?.profile ?? null,
    card: payload?.card ?? null,
    needsAssessment: currentUser.needsAssessment,
  });
}
