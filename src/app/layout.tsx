import type { Metadata } from 'next';
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';
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
          <main className="min-h-dvh min-w-dvw max-w-dvw border border-border bg-neutral-900 font-sans text-text">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
