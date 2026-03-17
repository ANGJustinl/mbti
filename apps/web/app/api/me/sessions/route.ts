import { failure, ok } from "../../../../lib/http";
import { resolveRequestUserContext } from "../../../../lib/request-user";
import { listUserSessions } from "../../../../lib/workflow";

export async function GET(request: Request) {
  const currentUser = await resolveRequestUserContext(request);
  if (!currentUser) {
    return failure("current user not found", 401);
  }

  const groups = await listUserSessions(currentUser.userId);

  return ok({
    currentUser,
    groups,
    totalCount:
      groups.sandboxing.length +
      groups.reconnect_ready.length +
      groups.exchanged.length +
      groups.filtered_out.length,
  });
}
