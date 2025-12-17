import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Clueso.io - AI-Powered Tutorial Generation from Screen Recordings',
  description: 'Transform your screen recordings into professional video tutorials with AI voice narration, automatic event detection, and step-by-step instructions. Perfect for creators, educators, and businesses.',
  keywords: 'screen recording, tutorial creation, AI voice, video tutorials, screen capture, educational content',
  authors: [{ name: 'Clueso.io Team' }],
  openGraph: {
    title: 'Clueso.io - AI-Powered Tutorial Generation',
    description: 'Turn screen recordings into professional tutorials with AI voice narration and smart instructions.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
