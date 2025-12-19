import React from 'react';
import { render, screen } from '@testing-library/react';
import { EthProviders } from '../eth-providers';

// Mock wagmi and RainbowKit providers
jest.mock('wagmi', () => ({
  WagmiProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="wagmi-provider">{children}</div>
  ),
}));

jest.mock('@tanstack/react-query', () => ({
  QueryClient: jest.fn(() => ({})),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="query-client-provider">{children}</div>
  ),
}));

jest.mock('@rainbow-me/rainbowkit', () => ({
  RainbowKitProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="rainbowkit-provider">{children}</div>
  ),
  getDefaultConfig: jest.fn(() => ({})),
}));

jest.mock('wagmi/chains', () => ({
  mainnet: { id: 1 },
  sepolia: { id: 11155111 },
}));

describe('EthProviders', () => {
  it('should render children', () => {
    render(
      <EthProviders>
        <div>Test Content</div>
      </EthProviders>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should wrap children with all provider layers', () => {
    render(
      <EthProviders>
        <div>Test Content</div>
      </EthProviders>
    );

    expect(screen.getByTestId('wagmi-provider')).toBeInTheDocument();
    expect(screen.getByTestId('query-client-provider')).toBeInTheDocument();
    expect(screen.getByTestId('rainbowkit-provider')).toBeInTheDocument();
  });

  it('should create QueryClient instance', () => {
    const { QueryClient } = require('@tanstack/react-query');
    render(
      <EthProviders>
        <div>Test</div>
      </EthProviders>
    );

    expect(QueryClient).toHaveBeenCalled();
  });
});

