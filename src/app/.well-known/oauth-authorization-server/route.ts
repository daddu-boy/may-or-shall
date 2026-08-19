import { NextResponse } from "next/server";
import { SCOPE, origin } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/** RFC 8414. How a client learns where to send the user and redeem a code. */
export async function GET() {
  const iss = origin();
  return NextResponse.json(
    {
      issuer: iss,
      authorization_endpoint: `${iss}/oauth/authorize`,
      token_endpoint: `${iss}/api/oauth/token`,
      registration_endpoint: `${iss}/api/oauth/register`,
      scopes_supported: [SCOPE],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      // public clients only: MCP clients cannot keep a secret
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      service_documentation: "https://github.com/daddu-boy/may-or-shall",
    },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}
