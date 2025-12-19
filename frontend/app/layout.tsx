import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { EthProviders } from './eth-providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Token Migration Portal',
  description: 'Migrate tokens from any chain to Starknet',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <EthProviders>
          <Providers>{children}</Providers>
        </EthProviders>
      </body>
    </html>
  );
}

