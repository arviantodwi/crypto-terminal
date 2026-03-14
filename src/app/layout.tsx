import type { Metadata } from 'next';
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { Sidebar } from '@/features/Sidebar';
import { Providers } from '@/lib/Providers';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  description: '',
  title: 'Phantom Terminal',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}>
        <Providers>
          <div className="flex min-h-dvh">
            <Sidebar />
            <main className="z-0 flex-1 bg-neutral-900 pl-52.5 font-sans text-text">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
