import { fetchAllocation, normalizeEthAddress } from '../merkle';

// Mock fetch globally
global.fetch = jest.fn();

describe('merkle utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeEthAddress', () => {
    it('should normalize ETH address to lowercase without 0x', () => {
      const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21';
      const normalized = normalizeEthAddress(address);
      
      expect(normalized).toBe('742d35cc6634c0532925a3b844bc9e7595f5be21');
      expect(normalized.length).toBe(40);
    });

    it('should handle addresses without 0x prefix', () => {
      const address = '742d35cc6634c0532925a3b844bc9e7595f5be21';
      const normalized = normalizeEthAddress(address);
      
      expect(normalized).toBe('742d35cc6634c0532925a3b844bc9e7595f5be21');
    });

    it('should handle uppercase addresses', () => {
      const address = '0x742D35CC6634C0532925A3B844BC9E7595F5BE21';
      const normalized = normalizeEthAddress(address);
      
      expect(normalized).toBe('742d35cc6634c0532925a3b844bc9e7595f5be21');
    });

    it('should handle empty string', () => {
      const normalized = normalizeEthAddress('');
      expect(normalized).toBe('');
    });
  });

  describe('fetchAllocation', () => {
    const mockMerkleData = {
      root: '0x63cf9212cb1ef5748af2fd0d4f1517446068f6e0cc45fb489556e6b6acdc497',
      claims: [
        {
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21',  // ETH address
          amount: '1000000000000000000',
          proof: [],
        },
        {
          address: '0x03c4a74467bee82b6f0374cf9bf540bfc9cd18f2',  // Another ETH address
          amount: '2000000000000000000',
          proof: ['0xabc', '0xdef'],
        },
      ],
    };

    it('should fetch and return allocation for matching ETH address', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMerkleData,
      });

      const ethAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21';
      const starknetAddress = '0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152';
      
      const result = await fetchAllocation(ethAddress, starknetAddress);

      expect(result).toEqual({
        amount: '1000000000000000000',
        proof: [],
      });
      expect(global.fetch).toHaveBeenCalledWith('/merkle-tree.json');
    });

    it('should return null when ETH address not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMerkleData,
      });

      const ethAddress = '0x9999999999999999999999999999999999999999';
      const starknetAddress = '0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152';
      
      const result = await fetchAllocation(ethAddress, starknetAddress);

      expect(result).toBeNull();
    });

    it('should handle fetch errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const ethAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21';
      const starknetAddress = '0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152';
      
      await expect(fetchAllocation(ethAddress, starknetAddress)).rejects.toThrow('Network error');
    });

    it('should throw error when response is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const ethAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21';
      const starknetAddress = '0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152';
      
      await expect(fetchAllocation(ethAddress, starknetAddress)).rejects.toThrow();
    });

    it('should match ETH addresses case-insensitively', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMerkleData,
      });

      const ethAddress = '0x742D35CC6634C0532925A3B844BC9E7595F5BE21';  // Uppercase
      const starknetAddress = '0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152';
      
      const result = await fetchAllocation(ethAddress, starknetAddress);

      expect(result).not.toBeNull();
      expect(result?.amount).toBe('1000000000000000000');
    });

    it('should handle ETH addresses without 0x prefix', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMerkleData,
      });

      const ethAddress = '742d35cc6634c0532925a3b844bc9e7595f5be21';  // No 0x
      const starknetAddress = '0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152';
      
      const result = await fetchAllocation(ethAddress, starknetAddress);

      expect(result).not.toBeNull();
      expect(result?.amount).toBe('1000000000000000000');
    });
  });
});

