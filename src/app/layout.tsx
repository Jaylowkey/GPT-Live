import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'GPT Live', description: 'Apresentador IA privado para TikTok LIVE' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b0b12' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt"><body>{children}</body></html>;
}
