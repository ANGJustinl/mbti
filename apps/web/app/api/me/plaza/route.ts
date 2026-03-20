import { failure, ok } from "../../../../lib/http";
import { resolveRequestUserContext } from "../../../../lib/request-user";
import { getPlazaWorkspace } from "../../../../lib/workflow";

export async function GET(request: Request) {
  const currentUser = await resolveRequestUserContext(request, { allowDemoFallback: false });
  if (!currentUser) {
    return failure("current user not found", 401);
  }

  try {
    const workspace = await getPlazaWorkspace(currentUser.userId);
    return ok({
      currentUser,
      workspace,
    });
  } catch (error) {
    return failure(error instanceof Error ? error.message : "plaza workspace failed");
  }
}
