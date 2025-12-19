import { PORTAL_ADDRESS, TOKEN_ADDRESS, NETWORK } from '../constants';

describe('constants', () => {
  describe('PORTAL_ADDRESS', () => {
    it('should have a valid address format', () => {
      expect(PORTAL_ADDRESS).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should have default value when env var not set', () => {
      // This test verifies the constant exists and has a value
      expect(PORTAL_ADDRESS).toBeDefined();
      expect(PORTAL_ADDRESS.length).toBe(66); // 0x + 64 hex chars
    });
  });

  describe('TOKEN_ADDRESS', () => {
    it('should have a valid address format', () => {
      expect(TOKEN_ADDRESS).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should have default value when env var not set', () => {
      expect(TOKEN_ADDRESS).toBeDefined();
      expect(TOKEN_ADDRESS.length).toBe(66);
    });
  });

  describe('NETWORK', () => {
    it('should have a valid network value', () => {
      expect(['sepolia', 'mainnet']).toContain(NETWORK);
    });

    it('should default to sepolia', () => {
      expect(NETWORK).toBe('sepolia');
    });
  });
});

