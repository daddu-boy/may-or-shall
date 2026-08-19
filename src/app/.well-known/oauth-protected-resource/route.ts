import { NextResponse } from "next/server";
import { SCOPE, origin, resourceUrl } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/** RFC 9728. Points the client at the authorization server for this resource. */
export async function GET() {
  return NextResponse.json(
    {
      resource: resourceUrl(),
      authorization_servers: [origin()],
      scopes_supported: [SCOPE],
      bearer_methods_supported: ["header"],
      resource_documentation: "https://github.com/daddu-boy/may-or-shall",
    },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}
