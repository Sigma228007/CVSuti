import './globals.css';
import Guard from '@/components/Guard';

export const metadata = {
  title: 'Nvuti-style',
  description: 'Provably fair mini-app',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Guard>{children}</Guard>
      </body>
    </html>
  );
}