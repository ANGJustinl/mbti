import { failure, ok } from "../../../../lib/http";
import { resolveRequestUserContext } from "../../../../lib/request-user";
import { getPlazaListing, listPlazaFeed } from "../../../../lib/workflow";

export async function GET(request: Request) {
  const currentUser = await resolveRequestUserContext(request, { allowDemoFallback: false });
  if (!currentUser) {
    return failure("current user not found", 401);
  }

  try {
    const [listing, feed] = await Promise.all([
      getPlazaListing(currentUser.userId),
      listPlazaFeed(currentUser.userId),
    ]);

    return ok({
      currentUser,
      listing,
      feed,
    });
  } catch (error) {
    return failure(error instanceof Error ? error.message : "match feed failed");
  }
}
