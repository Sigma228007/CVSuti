import "./globals.css";
import type { Metadata } from "next";
import InitAuth from "@/components/InitAuth";
import Guard from "@/components/Guard";

export const metadata: Metadata = {
  title: "GVSuti",
  description: "Онлайн-игра",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        {/* Инициализация авторизации и «мягкая» проверка WebApp */}
        <InitAuth />
        {/* Guard ожидает children — оборачиваем контент в него */}
        <Guard>{children}</Guard>
      </body>
    </html>
  );
}