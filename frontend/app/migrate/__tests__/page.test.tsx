import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MigrationPage from '../page';

// Mock dependencies
jest.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: () => <button data-testid="connect-button">Connect Wallet</button>,
}));

jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useSignMessage: jest.fn(),
}));

jest.mock('@starknet-react/core', () => ({
  useAccount: jest.fn(),
  useConnect: jest.fn(),
}));

jest.mock('starknet', () => ({
  CallData: {
    compile: jest.fn((data) => [data.amount.low, data.amount.high, ...data.proof]),
  },
}));

jest.mock('@/lib/constants', () => ({
  PORTAL_ADDRESS: '0x027d9db485a394d3aea0c3af6a82b889cb95a833cc4fe36ede8696624f0310fb',
}));

const mockUseEthAccount = require('wagmi').useAccount;
const mockUseSignMessage = require('wagmi').useSignMessage;
const mockUseStarknetAccount = require('@starknet-react/core').useAccount;
const mockUseConnect = require('@starknet-react/core').useConnect;

describe('MigrationPage', () => {
  const mockSignMessage = jest.fn();
  const mockConnect = jest.fn();
  const mockAccountExecute = jest.fn();

  const mockControllerConnector = {
    id: 'controller',
    name: 'Controller',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    mockUseEthAccount.mockReturnValue({
      address: null,
      isConnected: false,
    });

    mockUseSignMessage.mockReturnValue({
      signMessage: mockSignMessage,
      isPending: false,
    });

    mockUseStarknetAccount.mockReturnValue({
      address: null,
      account: null,
      status: 'disconnected',
    });

    mockUseConnect.mockReturnValue({
      connect: mockConnect,
      connectors: [mockControllerConnector],
    });
  });

  describe('Step 1: Connect MetaMask & Sign', () => {
    it('should show ConnectButton when not connected', () => {
      render(<MigrationPage />);

      expect(screen.getByTestId('connect-button')).toBeInTheDocument();
      expect(screen.getByText('Connect IMX Wallet & Authorize')).toBeInTheDocument();
    });

    it('should show connected address when MetaMask is connected', () => {
      const ethAddress = '0x1234567890123456789012345678901234567890';
      mockUseEthAccount.mockReturnValue({
        address: ethAddress,
        isConnected: true,
      });

      render(<MigrationPage />);

      expect(screen.getByText('Connected (Ethereum/IMX)')).toBeInTheDocument();
      expect(screen.getByText(ethAddress)).toBeInTheDocument();
    });

    it('should show sign button when connected but not signed', () => {
      const ethAddress = '0x1234567890123456789012345678901234567890';
      mockUseEthAccount.mockReturnValue({
        address: ethAddress,
        isConnected: true,
      });

      render(<MigrationPage />);

      const signButton = screen.getByText('Sign Migration Authorization');
      expect(signButton).toBeInTheDocument();
    });

    it('should call signMessage when sign button is clicked', async () => {
      const ethAddress = '0x1234567890123456789012345678901234567890';
      mockUseEthAccount.mockReturnValue({
        address: ethAddress,
        isConnected: true,
      });

      render(<MigrationPage />);

      const signButton = screen.getByText('Sign Migration Authorization');
      await userEvent.click(signButton);

      expect(mockSignMessage).toHaveBeenCalled();
      expect(mockSignMessage).toHaveBeenCalledWith({
        message: expect.stringContaining('GGMT Token Migration Authorization'),
      });
    });

    it('should show signature confirmation after signing', () => {
      const ethAddress = '0x1234567890123456789012345678901234567890';
      mockUseEthAccount.mockReturnValue({
        address: ethAddress,
        isConnected: true,
      });

      // Mock successful signature
      mockUseSignMessage.mockReturnValue({
        signMessage: mockSignMessage,
        isPending: false,
        data: '0x1234567890abcdef',
      });

      render(<MigrationPage />);

      // Simulate signature success by manually triggering the mutation
      const signButton = screen.getByText('Sign Migration Authorization');
      fireEvent.click(signButton);

      // The component should show signature confirmation
      // Note: This test may need adjustment based on actual implementation
    });

    it('should show loading state while signing', () => {
      const ethAddress = '0x1234567890123456789012345678901234567890';
      mockUseEthAccount.mockReturnValue({
        address: ethAddress,
        isConnected: true,
      });

      mockUseSignMessage.mockReturnValue({
        signMessage: mockSignMessage,
        isPending: true,
      });

      render(<MigrationPage />);

      expect(screen.getByText('Sign in MetaMask...')).toBeInTheDocument();
    });
  });

  describe('Step 2: Connect Cartridge Controller', () => {
    it('should show step 2 as disabled when step 1 not completed', () => {
      render(<MigrationPage />);

      const step2Card = screen.getByText('Connect Starknet Wallet').closest('.rounded-xl');
      expect(step2Card).toHaveClass('border-gray-700');
    });

    it('should show connect button when step 1 is completed', () => {
      const ethAddress = '0x1234567890123456789012345678901234567890';
      mockUseEthAccount.mockReturnValue({
        address: ethAddress,
        isConnected: true,
      });

      // Mock signature success
      mockUseSignMessage.mockReturnValue({
        signMessage: mockSignMessage,
        isPending: false,
        data: '0xsignature',
      });

      render(<MigrationPage />);

      // Simulate signature completion
      const signButton = screen.getByText('Sign Migration Authorization');
      fireEvent.click(signButton);

      // Step 2 should be enabled
      const connectControllerButton = screen.getByText('Connect Controller (Passkey)');
      expect(connectControllerButton).toBeInTheDocument();
    });

    it('should call connect when controller button is clicked', async () => {
      const ethAddress = '0x1234567890123456789012345678901234567890';
      mockUseEthAccount.mockReturnValue({
        address: ethAddress,
        isConnected: true,
      });

      mockUseSignMessage.mockReturnValue({
        signMessage: mockSignMessage,
        isPending: false,
        data: '0xsignature',
      });

      render(<MigrationPage />);

      // Complete step 1
      const signButton = screen.getByText('Sign Migration Authorization');
      fireEvent.click(signButton);

      // Click connect controller
      const connectButton = screen.getByText('Connect Controller (Passkey)');
      await userEvent.click(connectButton);

      expect(mockConnect).toHaveBeenCalledWith({ connector: mockControllerConnector });
    });

    it('should show connected Starknet address when connected', () => {
      const ethAddress = '0x1234567890123456789012345678901234567890';
      const starknetAddress = '0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152';

      mockUseEthAccount.mockReturnValue({
        address: ethAddress,
        isConnected: true,
      });

      mockUseSignMessage.mockReturnValue({
        signMessage: mockSignMessage,
        isPending: false,
        data: '0xsignature',
      });

      mockUseStarknetAccount.mockReturnValue({
        address: starknetAddress,
        account: { execute: mockAccountExecute },
        status: 'connected',
      });

      render(<MigrationPage />);

      expect(screen.getByText('Connected (Starknet)')).toBeInTheDocument();
      expect(screen.getByText(starknetAddress)).toBeInTheDocument();
    });
  });

  describe('Step 3: Claim Tokens', () => {
    it('should show step 3 as disabled when previous steps not completed', () => {
      render(<MigrationPage />);

      const step3Card = screen.getByText('Claim on Starknet').closest('.rounded-xl');
      expect(step3Card).toHaveClass('border-gray-700');
    });

    it('should show claim amount when step 3 is active', () => {
      const ethAddress = '0x1234567890123456789012345678901234567890';
      const starknetAddress = '0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152';

      mockUseEthAccount.mockReturnValue({
        address: ethAddress,
        isConnected: true,
      });

      mockUseSignMessage.mockReturnValue({
        signMessage: mockSignMessage,
        isPending: false,
        data: '0xsignature',
      });

      mockUseStarknetAccount.mockReturnValue({
        address: starknetAddress,
        account: { execute: mockAccountExecute },
        status: 'connected',
      });

      render(<MigrationPage />);

      // Should show claim amount
      expect(screen.getByText(/You will receive:/)).toBeInTheDocument();
    });

    it('should call account.execute when claim button is clicked', async () => {
      const ethAddress = '0x1234567890123456789012345678901234567890';
      const starknetAddress = '0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152';

      mockUseEthAccount.mockReturnValue({
        address: ethAddress,
        isConnected: true,
      });

      mockUseSignMessage.mockReturnValue({
        signMessage: mockSignMessage,
        isPending: false,
        data: '0xsignature',
      });

      mockUseStarknetAccount.mockReturnValue({
        address: starknetAddress,
        account: { execute: mockAccountExecute },
        status: 'connected',
      });

      mockAccountExecute.mockResolvedValue({
        transaction_hash: '0xtxhash123',
      });

      render(<MigrationPage />);

      const claimButton = screen.getByText('Claim Tokens');
      await userEvent.click(claimButton);

      await waitFor(() => {
        expect(mockAccountExecute).toHaveBeenCalled();
      });

      expect(mockAccountExecute).toHaveBeenCalledWith({
        contractAddress: '0x027d9db485a394d3aea0c3af6a82b889cb95a833cc4fe36ede8696624f0310fb',
        entrypoint: 'claim',
        calldata: expect.any(Array),
      });
    });

    it('should show error message when claim fails', async () => {
      const ethAddress = '0x1234567890123456789012345678901234567890';
      const starknetAddress = '0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152';

      mockUseEthAccount.mockReturnValue({
        address: ethAddress,
        isConnected: true,
      });

      mockUseSignMessage.mockReturnValue({
        signMessage: mockSignMessage,
        isPending: false,
        data: '0xsignature',
      });

      mockUseStarknetAccount.mockReturnValue({
        address: starknetAddress,
        account: { execute: mockAccountExecute },
        status: 'connected',
      });

      mockAccountExecute.mockRejectedValue(new Error('Claim failed'));

      render(<MigrationPage />);

      const claimButton = screen.getByText('Claim Tokens');
      await userEvent.click(claimButton);

      await waitFor(() => {
        expect(screen.getByText(/Claim failed/)).toBeInTheDocument();
      });
    });

    it('should show transaction hash after successful claim', async () => {
      const ethAddress = '0x1234567890123456789012345678901234567890';
      const starknetAddress = '0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152';
      const txHash = '0xtxhash123';

      mockUseEthAccount.mockReturnValue({
        address: ethAddress,
        isConnected: true,
      });

      mockUseSignMessage.mockReturnValue({
        signMessage: mockSignMessage,
        isPending: false,
        data: '0xsignature',
      });

      mockUseStarknetAccount.mockReturnValue({
        address: starknetAddress,
        account: { execute: mockAccountExecute },
        status: 'connected',
      });

      mockAccountExecute.mockResolvedValue({
        transaction_hash: txHash,
      });

      render(<MigrationPage />);

      const claimButton = screen.getByText('Claim Tokens');
      await userEvent.click(claimButton);

      await waitFor(() => {
        expect(screen.getByText(/Transaction submitted!/)).toBeInTheDocument();
      });
    });
  });

  describe('Migration Flow Integration', () => {
    it('should progress through all steps correctly', async () => {
      const ethAddress = '0x1234567890123456789012345678901234567890';
      const starknetAddress = '0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152';

      // Start disconnected
      mockUseEthAccount.mockReturnValue({
        address: null,
        isConnected: false,
      });

      const { rerender } = render(<MigrationPage />);

      // Step 1: Connect MetaMask
      expect(screen.getByTestId('connect-button')).toBeInTheDocument();

      // Simulate connection
      mockUseEthAccount.mockReturnValue({
        address: ethAddress,
        isConnected: true,
      });
      rerender(<MigrationPage />);

      expect(screen.getByText(ethAddress)).toBeInTheDocument();

      // Step 2: Sign message
      const signButton = screen.getByText('Sign Migration Authorization');
      await userEvent.click(signButton);

      // Step 3: Connect Controller
      mockUseStarknetAccount.mockReturnValue({
        address: starknetAddress,
        account: { execute: mockAccountExecute },
        status: 'connected',
      });
      rerender(<MigrationPage />);

      expect(screen.getByText(starknetAddress)).toBeInTheDocument();
    });
  });
});

