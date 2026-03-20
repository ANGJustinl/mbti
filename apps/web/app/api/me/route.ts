import { failure, ok } from "../../../lib/http";
import { resolveRequestUserContext } from "../../../lib/request-user";
import { getSecondMeWorkspaceStatus } from "../../../lib/workflow";

export async function GET(request: Request) {
  try {
    const currentUser = await resolveRequestUserContext(request);
    const secondMeStatus = currentUser
      ? await getSecondMeWorkspaceStatus(currentUser.userId)
      : {
          profileSyncedAt: null,
          pendingWritebacks: [],
          recentWritebacks: [],
        };

    return ok({
      authenticated: Boolean(currentUser && currentUser.source === "secondme"),
      currentUser,
      hasProfile: currentUser?.hasProfile ?? false,
      needsAssessment: currentUser?.needsAssessment ?? true,
      secondMeProfileSyncedAt: secondMeStatus.profileSyncedAt,
      pendingWritebacks: secondMeStatus.pendingWritebacks,
      recentWritebacks: secondMeStatus.recentWritebacks,
    });
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "current user resolution failed",
      500,
    );
  }
}
