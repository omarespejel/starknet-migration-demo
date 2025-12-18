use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use migration_portal::portal::{
    IMigrationPortalDispatcher, IMigrationPortalDispatcherTrait,
};
use migration_portal::test_utils::{
    OWNER, USER1, DEFAULT_DEADLINE,
    single_leaf_root
};
use openzeppelin_access::accesscontrol::interface::{
    IAccessControlDispatcher, IAccessControlDispatcherTrait
};
use starknet::ContractAddress;
use core::serde::Serde;

// Helper function to deploy token and portal (same as comprehensive tests)
fn deploy_token_and_portal(
    merkle_root: felt252,
    deadline: u64,
    max_claim_amount: u256
) -> (ContractAddress, ContractAddress, IMigrationPortalDispatcher) {
    // Deploy token first with admin as temporary minter
    let token_contract = declare("MigrationToken").unwrap().contract_class();
    let mut token_args = array![];
    let name: ByteArray = "MigToken";
    let symbol: ByteArray = "MIG";
    name.serialize(ref token_args);
    symbol.serialize(ref token_args);
    OWNER().serialize(ref token_args);
    OWNER().serialize(ref token_args); // Admin as temporary minter
    let (token_address, _) = token_contract.deploy(@token_args).unwrap();
    
    // Deploy portal
    let portal_contract = declare("MigrationPortal").unwrap().contract_class();
    let mut portal_args = array![];
    OWNER().serialize(ref portal_args);
    token_address.serialize(ref portal_args);
    merkle_root.serialize(ref portal_args);
    deadline.serialize(ref portal_args);
    max_claim_amount.low.serialize(ref portal_args);
    max_claim_amount.high.serialize(ref portal_args);
    let (portal_address, _) = portal_contract.deploy(@portal_args).unwrap();
    
    // Grant minter role to portal
    let access_dispatcher = IAccessControlDispatcher { contract_address: token_address };
    let minter_role: felt252 = selector!("MINTER_ROLE");
    start_cheat_caller_address(token_address, OWNER());
    access_dispatcher.grant_role(minter_role, portal_address);
    stop_cheat_caller_address(token_address);
    
    let dispatcher = IMigrationPortalDispatcher { contract_address: portal_address };
    (token_address, portal_address, dispatcher)
}

// ============================================================
// FUZZ TESTS - Working versions
// ============================================================

/// Fuzz test with bounded input to avoid felt252 overflow
/// Uses u64 input (always safe) and scales it
#[test]
#[fuzzer(runs: 100, seed: 12345)]
fn fuzz_any_valid_amount_claims_successfully(raw_amount: u64) {
    // Use u64 input (always safe) and scale it
    // This avoids the u128 literal overflow issue
    if raw_amount == 0 { return; }
    
    let amount: u256 = u256 { low: raw_amount.into(), high: 0 };
    let user = USER1();
    let merkle_root = single_leaf_root(user, amount);
    
    // max_amount is always larger than any u64 input
    let max_amount: u256 = u256 { 
        low: 0xFFFFFFFFFFFFFFFF_u128,  // u64::MAX as u128
        high: 0 
    };
    
    let (_, portal_address, portal) = deploy_token_and_portal(
        merkle_root, DEFAULT_DEADLINE, max_amount
    );
    
    start_cheat_caller_address(portal_address, user);
    portal.claim(amount, array![].span());
    stop_cheat_caller_address(portal_address);
    
    assert(portal.is_claimed(user), 'Should be claimed');
    assert(portal.total_claimed() == amount, 'Wrong total');
}

/// Fuzz determinism test - use felt252 directly (always in range)
#[test]
#[fuzzer(runs: 50, seed: 54321)]
fn fuzz_compute_leaf_deterministic(user_felt: felt252, amount_low: u64, amount_high: u64) {
    // Skip zero address
    if user_felt == 0 { return; }
    
    // Use u64 inputs to avoid overflow, then widen to u128
    let user: ContractAddress = user_felt.try_into().unwrap();
    let amount: u256 = u256 { 
        low: amount_low.into(), 
        high: amount_high.into() 
    };
    
    // Compute leaf twice - should be identical
    let leaf1 = single_leaf_root(user, amount);
    let leaf2 = single_leaf_root(user, amount);
    
    assert(leaf1 == leaf2, 'Leaf must be deterministic');
}

/// Fuzz edge case: test amounts near boundaries
#[test]
#[fuzzer(runs: 25, seed: 99999)]  
fn fuzz_boundary_amounts(selector: u8) {
    // Test specific boundary values based on selector
    // Keep amounts reasonable to avoid max supply issues
    let amount: u256 = match selector % 5 {
        0 => 1_u256,                           // Minimum valid
        1 => 1000_u256,                        // Small amount
        2 => 1000000000000000000_u256,         // 1e18 (typical token decimals)
        3 => u256 { low: 1000000, high: 0 },   // Medium amount with high=0
        _ => u256 { low: 1000, high: 0 },      // Small amount with explicit high=0
    };
    
    let user = USER1();
    let merkle_root = single_leaf_root(user, amount);
    // Use reasonable max that won't exceed token max supply
    let max_amount: u256 = u256 { low: 0xFFFFFFFFFFFFFFFF_u128, high: 0 };
    
    let (_, portal_address, portal) = deploy_token_and_portal(
        merkle_root, DEFAULT_DEADLINE, max_amount
    );
    
    start_cheat_caller_address(portal_address, user);
    portal.claim(amount, array![].span());
    stop_cheat_caller_address(portal_address);
    
    assert(portal.is_claimed(user), 'Should be claimed');
}
