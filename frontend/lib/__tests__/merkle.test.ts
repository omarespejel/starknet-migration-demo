import { fetchAllocation, normalizeAddress, ClaimData } from '../merkle';

// Mock fetch globally
global.fetch = jest.fn();

describe('merkle utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeAddress', () => {
    it('should normalize address to lowercase and pad to 64 chars', () => {
      const address = '0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152';
      const normalized = normalizeAddress(address);
      
      expect(normalized).toBe('042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152');
      expect(normalized.length).toBe(64);
    });

    it('should handle addresses without 0x prefix', () => {
      const address = '042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152';
      const normalized = normalizeAddress(address);
      
      expect(normalized).toBe('042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152');
    });

    it('should handle uppercase addresses', () => {
      const address = '0x042465F34CF0E79B2A5CEFBCE4CF11B0D1F56B2E0BB63FB469B3A7EB3FE2A152';
      const normalized = normalizeAddress(address);
      
      expect(normalized).toBe('042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152');
    });

    it('should handle empty string', () => {
      const normalized = normalizeAddress('');
      expect(normalized).toBe('');
    });

    it('should pad short addresses', () => {
      const address = '0x123';
      const normalized = normalizeAddress(address);
      
      expect(normalized.length).toBe(64);
      expect(normalized).toMatch(/^0+123$/);
    });
  });

  describe('fetchAllocation', () => {
    const mockMerkleData = {
      root: '0x63cf9212cb1ef5748af2fd0d4f1517446068f6e0cc45fb489556e6b6acdc497',
      claims: [
        {
          address: '0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152',
          amount: '1000000000000000000',
          proof: [],
        },
        {
          address: '0x53371c2a24c3a9b7fcd60c70405e24e72d17a835e43c53bb465eee6e271044b',
          amount: '2000000000000000000',
          proof: ['0xabc', '0xdef'],
        },
      ],
    };

    it('should fetch and return allocation for matching address', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMerkleData,
      });

      const ethAddress = '0x123';
      const starknetAddress = '0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152';
      
      const result = await fetchAllocation(ethAddress, starknetAddress);

      expect(result).toEqual({
        address: '0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152',
        amount: '1000000000000000000',
        proof: [],
      });
      expect(global.fetch).toHaveBeenCalledWith('/merkle-tree.json');
    });

    it('should return null when address not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMerkleData,
      });

      const ethAddress = '0x123';
      const starknetAddress = '0x9999999999999999999999999999999999999999999999999999999999999999';
      
      const result = await fetchAllocation(ethAddress, starknetAddress);

      expect(result).toBeNull();
    });

    it('should handle fetch errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const ethAddress = '0x123';
      const starknetAddress = '0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152';
      
      const result = await fetchAllocation(ethAddress, starknetAddress);

      expect(result).toBeNull();
    });

    it('should return null when response is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const ethAddress = '0x123';
      const starknetAddress = '0x042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152';
      
      const result = await fetchAllocation(ethAddress, starknetAddress);

      expect(result).toBeNull();
    });

    it('should match addresses case-insensitively', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMerkleData,
      });

      const ethAddress = '0x123';
      const starknetAddress = '0x042465F34CF0E79B2A5CEFBCE4CF11B0D1F56B2E0BB63FB469B3A7EB3FE2A152';
      
      const result = await fetchAllocation(ethAddress, starknetAddress);

      expect(result).not.toBeNull();
      expect(result?.amount).toBe('1000000000000000000');
    });

    it('should handle addresses without 0x prefix', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMerkleData,
      });

      const ethAddress = '0x123';
      const starknetAddress = '042465f34cf0e79b2a5cefbce4cf11b0d1f56b2e0bb63fb469b3a7eb3fe2a152';
      
      const result = await fetchAllocation(ethAddress, starknetAddress);

      expect(result).not.toBeNull();
    });
  });
});

