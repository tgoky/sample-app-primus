'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { clusterApiUrl } from '@solana/web3.js';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PrivyProvider
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
          config={{
            supportedChains: [
              {
                id: 103, // Solana Devnet chain ID
                name: 'Solana Devnet',
                rpcUrls: clusterApiUrl('devnet'),
              },
            ],
            appearance: {
              theme: 'light',
              accentColor: '#676FFF',
            },
            privyWalletOverride: {
              // Add any wallet override config if needed
            }
          }}
        >
          {children}
        </PrivyProvider>
      </body>
    </html>
  );
}