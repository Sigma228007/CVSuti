import './globals.css';

export const metadata = {
  title: 'Nvuti-style',
  description: 'Provably fair mini-app',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}