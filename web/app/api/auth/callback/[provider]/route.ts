import { authCookie } from "@/lib/account-server";
import { finishOAuth, providerName } from "@/lib/oauth-server";
export async function GET(r: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  try {
    const result = await finishOAuth(r, providerName(provider));
    const headers = new Headers({
      Location: new URL(result.returnTo, r.url).href,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    });
    for (const c of result.cookies) headers.append("Set-Cookie", c);
    return new Response(null, { status: 303, headers });
  } catch {
    return new Response(null, {
      status: 303,
      headers: {
        Location: new URL("/login?authError=1", r.url).href,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Set-Cookie": authCookie(
          r,
          "gunbeon_oauth_" + (provider === "naver" ? "naver" : "google"),
          "",
          0,
        ),
      },
    });
  }
}
