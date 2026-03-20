import { failure, ok } from "../../../../lib/http";
import { resolveRequestUserContext } from "../../../../lib/request-user";
import { publishPlazaListing } from "../../../../lib/workflow";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        enabled?: boolean;
        headline?: string;
        lookingFor?: string;
        focusTags?: string[];
        availabilityNote?: string;
      }
    | null;

  const currentUser = await resolveRequestUserContext(request, { allowDemoFallback: false });
  if (!currentUser) {
    return failure("current user not found", 401);
  }

  try {
    const listing = await publishPlazaListing({
      userId: currentUser.userId,
      enabled: Boolean(body?.enabled),
      headline: body?.headline,
      lookingFor: body?.lookingFor,
      focusTags: body?.focusTags,
      availabilityNote: body?.availabilityNote,
    });

    return ok({
      listing,
    });
  } catch (error) {
    return failure(error instanceof Error ? error.message : "plaza publish failed");
  }
}
