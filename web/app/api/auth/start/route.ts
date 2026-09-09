import { accountBody, accountError, accountReply, authRate } from "@/lib/account-server";
import { providerName, startOAuth } from "@/lib/oauth-server";
export async function POST(r: Request) {
  try {
    const b = await accountBody(r);
    await authRate(r, "oauth", 40);
    const result = await startOAuth(r, providerName(b.provider), b.link === true, b.returnTo);
    return accountReply({ url: result.url }, 200, [result.cookie]);
  } catch (e) {
    return accountError(e);
  }
}
