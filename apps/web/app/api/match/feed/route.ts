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

    const groups = {
      mutual: feed.filter((item) => item.relationship === "mutual"),
      incoming: feed.filter((item) => item.relationship === "incoming"),
      outgoing: feed.filter((item) => item.relationship === "outgoing"),
      browse: feed.filter((item) => item.relationship === "none"),
    };

    return ok({
      currentUser,
      listing,
      feed,
      groups,
    });
  } catch (error) {
    return failure(error instanceof Error ? error.message : "match feed failed");
  }
}
