import { createHmac } from "crypto";

type TgUser = { id: number; first_name?: string; username?: string };

export function verifyInitData(initData: string, botToken: string): { ok: true; user: TgUser } | { ok: false } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash") || "";
    params.delete("hash");

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
    const myHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (myHash !== hash) return { ok: false };

    const userStr = params.get("user");
    if (!userStr) return { ok: false };

    const user = JSON.parse(userStr) as TgUser;
    if (!user?.id) return { ok: false };

    return { ok: true, user };
  } catch {
    return { ok: false };
  }
}