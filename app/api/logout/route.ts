import { NextResponse } from "next/server";

export async function POST() {
  // В новой системе просто возвращаем успех
  // Клиент сам очистит localStorage
  return NextResponse.json({ 
    ok: true, 
    message: "Logged out successfully" 
  });
}