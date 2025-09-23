import type { Metadata } from "next";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}