import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Если у тебя другой домен FK — поменяй на https://pay.fk.money/
  const base = "https://pay.freekassa.com/";
  const qs = req.nextUrl.searchParams.toString();
  const target = base + (qs ? `?${qs}` : "");
  return NextResponse.redirect(target, {
    status: 302,
    headers: { "Referrer-Policy": "no-referrer" },
  });
}