import "@/app/globals.css";
import type { Metadata } from "next";
import InitAuth from "@/components/InitAuth";
import Guard from "@/components/Guard";

export const metadata: Metadata = {
  title: "GVSuti",
  description: "Онлайн-игра",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body>
        <InitAuth />
        <Guard>{children}</Guard>
      </body>
    </html>
  );
}