import crypto from "crypto";

// ---- тип результата валидации ----
export type VerifiedInit = {
  user: { id: number; [k: string]: any } | null;
  // можно прокинуть, если хотите что-то ещё использовать
  raw: string;
  data: Record<string, string>;
};

// Разбор строки initData от Telegram WebApp.
// На вход — СЫРОЙ initData (tg.WebApp.initData ИЛИ значение tgWebAppData из hash/URL).
export function parseInitData(initData: string): Record<string, string> {
  const params = new URLSearchParams(initData);
  const out: Record<string, string> = {};
  params.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

// Проверка подписи initData по докам Telegram:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
export function verifyInitData(initData: string, botToken: string): VerifiedInit | null {
  if (!initData || !botToken) return null;

  const data = parseInitData(initData);

  // hash обязателен
  const hash = data["hash"];
  if (!hash) return null;

  // формируем data_check_string (все пары, кроме hash, отсортированы и соединены \n)
  const check: string[] = [];
  Object.keys(data)
    .filter((k) => k !== "hash")
    .sort()
    .forEach((k) => {
      // ВНИМАНИЕ: значения должны быть строки
      check.push(`${k}=${data[k] ?? ""}`);
    });
  const dataCheckString = check.join("\n");

  // секрет = HMAC_SHA256("WebAppData", bot_token)
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  // подпись = HMAC_SHA256(секрет, data_check_string) в hex
  const signature = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");

  if (signature !== hash) return null;

  // user — это JSON в поле 'user'
  let user: any = null;
  const userStr = data["user"];
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch {
      user = null;
    }
  }

  return { user: user && typeof user.id === "number" ? user : null, raw: initData, data };
}

// ---- Подпись payload’а для админ-кнопок (approve/decline) ----
type AdminPayload = { id: string; user: number; amount: number };

export function signAdminPayload(payload: AdminPayload, key: string): string {
  const id = payload.id;
  const msg = `${id}`; // подписываем только id, чтобы не возиться с типами в ссылке
  return crypto.createHmac("sha256", key).update(msg).digest("hex");
}

export function verifyAdminLink(q: URLSearchParams, key: string): AdminPayload | null {
  const id = q.get("id") ?? "";
  const sig = q.get("sig") ?? "";
  const user = Number(q.get("user") ?? "0");
  const amount = Number(q.get("amount") ?? "0");
  if (!id || !sig || !user || !amount) return null;

  const good = signAdminPayload({ id, user, amount }, key);
  if (good !== sig) return null;

  return { id, user, amount };
}