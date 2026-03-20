import { failure, ok } from "../../../../lib/http";
import { resolveRequestUserContext } from "../../../../lib/request-user";
import { getCurrentUserProfile, getSecondMeWorkspaceStatus } from "../../../../lib/workflow";

export async function GET(request: Request) {
  const currentUser = await resolveRequestUserContext(request);
  if (!currentUser) {
    return failure("current user not found", 401);
  }

  const payload = currentUser.hasProfile
    ? await getCurrentUserProfile(currentUser.userId)
    : null;
  const secondMeStatus = await getSecondMeWorkspaceStatus(currentUser.userId);

  return ok({
    currentUser,
    profile: payload?.profile ?? null,
    card: payload?.card ?? null,
    secondMeReview: payload?.profile.secondMeReview ?? null,
    needsAssessment: currentUser.needsAssessment,
    secondMeProfileSyncedAt: secondMeStatus.profileSyncedAt,
    pendingWritebacks: secondMeStatus.pendingWritebacks,
  });
}
