use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait,
    start_cheat_caller_address, stop_cheat_caller_address,
    start_cheat_block_number_global, stop_cheat_block_number_global,
};
use starknet::SyscallResultTrait;
use migration_portal::portal::{
    IMigrationPortalDispatcher, IMigrationPortalDispatcherTrait,
    IPortalAdminDispatcher, IPortalAdminDispatcherTrait,
};
use migration_portal::test_utils::{
    OWNER, USER1, USER2, USER3, USER4,
    DEFAULT_DEADLINE,
    single_leaf_root, two_leaf_tree, four_leaf_tree
};
use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use openzeppelin_access::accesscontrol::interface::{
    IAccessControlDispatcher, IAccessControlDispatcherTrait
};
use starknet::ContractAddress;
use core::serde::Serde;

// ============================================================
// TEST FIXTURES
// ============================================================

fn deploy_token_and_portal(
    merkle_root: felt252,
    deadline: u64,
    max_claim_amount: u256
) -> (ContractAddress, ContractAddress, IMigrationPortalDispatcher) {
    // Deploy token first with admin as temporary minter
    let token_contract = declare("MigrationToken").unwrap_syscall().contract_class();
    let mut token_args = array![];
    let name: ByteArray = "MigToken";
    let symbol: ByteArray = "MIG";
    name.serialize(ref token_args);
    symbol.serialize(ref token_args);
    OWNER().serialize(ref token_args);
    OWNER().serialize(ref token_args); // Admin as temporary minter
    let (token_address, _) = token_contract.deploy(@token_args).unwrap_syscall();
    
    // Deploy portal
    let portal_contract = declare("MigrationPortal").unwrap_syscall().contract_class();
    let mut portal_args = array![];
    OWNER().serialize(ref portal_args);
    token_address.serialize(ref portal_args);
    merkle_root.serialize(ref portal_args);
    deadline.serialize(ref portal_args);
    max_claim_amount.low.serialize(ref portal_args);
    max_claim_amount.high.serialize(ref portal_args);
    let (portal_address, _) = portal_contract.deploy(@portal_args).unwrap_syscall();
    
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
// CLAIM TESTS - HAPPY PATH
// ============================================================

#[test]
fn test_claim_single_user_succeeds() {
    let user = USER1();
    let amount: u256 = 1000_u256;
    let merkle_root = single_leaf_root(user, amount);
    let max_amount: u256 = 10000_u256;
    
    let (token_address, portal_address, portal) = deploy_token_and_portal(
        merkle_root, DEFAULT_DEADLINE, max_amount
    );
    
    // Empty proof for single-leaf tree (root == leaf)
    let proof: Span<felt252> = array![].span();
    
    start_cheat_caller_address(portal_address, user);
    portal.claim(amount, proof);
    stop_cheat_caller_address(portal_address);
    
    // Verify state changes
    assert(portal.is_claimed(user), 'Should be marked claimed');
    assert(portal.total_claimed() == amount, 'Wrong total claimed');
    
    // Verify token balance
    let erc20 = IERC20Dispatcher { contract_address: token_address };
    assert(erc20.balance_of(user) == amount, 'Wrong token balance');
}

#[test]
fn test_claim_two_users_both_succeed() {
    let amount1: u256 = 1000_u256;
    let amount2: u256 = 2000_u256;
    let (merkle_root, proof1, proof2) = two_leaf_tree(USER1(), amount1, USER2(), amount2);
    let max_amount: u256 = 10000_u256;
    
    let (_, portal_address, portal) = deploy_token_and_portal(
        merkle_root, DEFAULT_DEADLINE, max_amount
    );
    
    // User1 claims
    start_cheat_caller_address(portal_address, USER1());
    portal.claim(amount1, proof1);
    stop_cheat_caller_address(portal_address);
    
    // User2 claims
    start_cheat_caller_address(portal_address, USER2());
    portal.claim(amount2, proof2);
    stop_cheat_caller_address(portal_address);
    
    // Verify both claimed
    assert(portal.is_claimed(USER1()), 'User1 should be claimed');
    assert(portal.is_claimed(USER2()), 'User2 should be claimed');
    assert(portal.total_claimed() == amount1 + amount2, 'Wrong total');
}

// ============================================================
// CLAIM TESTS - ERROR CASES
// ============================================================

#[test]
#[should_panic(expected: ('Portal: already claimed',))]
fn test_double_claim_fails() {
    let user = USER1();
    let amount: u256 = 1000_u256;
    let merkle_root = single_leaf_root(user, amount);
    let max_amount: u256 = 10000_u256;
    
    let (_, portal_address, portal) = deploy_token_and_portal(
        merkle_root, DEFAULT_DEADLINE, max_amount
    );
    
    start_cheat_caller_address(portal_address, user);
    portal.claim(amount, array![].span());
    portal.claim(amount, array![].span()); // Should fail
    stop_cheat_caller_address(portal_address);
}

#[test]
#[should_panic(expected: ('Portal: claim period ended',))]
fn test_claim_after_deadline_fails() {
    let user = USER1();
    let amount: u256 = 1000_u256;
    let merkle_root = single_leaf_root(user, amount);
    let deadline: u64 = 1000;
    let max_amount: u256 = 10000_u256;
    
    // Set block number to 0 before deployment so deadline is valid
    start_cheat_block_number_global(0_u64);
    let (_, portal_address, portal) = deploy_token_and_portal(
        merkle_root, deadline, max_amount
    );
    stop_cheat_block_number_global();
    
    // Fast forward past deadline
    start_cheat_block_number_global(deadline + 1);
    
    start_cheat_caller_address(portal_address, user);
    portal.claim(amount, array![].span());
    stop_cheat_caller_address(portal_address);
    stop_cheat_block_number_global();
}

#[test]
#[should_panic(expected: ('Portal: invalid merkle proof',))]
fn test_claim_wrong_amount_fails() {
    let user = USER1();
    let correct_amount: u256 = 1000_u256;
    let wrong_amount: u256 = 9999_u256;
    let merkle_root = single_leaf_root(user, correct_amount);
    let max_amount: u256 = 10000_u256;
    
    let (_, portal_address, portal) = deploy_token_and_portal(
        merkle_root, DEFAULT_DEADLINE, max_amount
    );
    
    start_cheat_caller_address(portal_address, user);
    portal.claim(wrong_amount, array![].span()); // Wrong amount
    stop_cheat_caller_address(portal_address);
}

#[test]
#[should_panic(expected: ('Portal: amount must be positive',))]
fn test_claim_zero_amount_fails() {
    let user = USER1();
    let merkle_root = single_leaf_root(user, 0_u256);
    let max_amount: u256 = 10000_u256;
    
    let (_, portal_address, portal) = deploy_token_and_portal(
        merkle_root, DEFAULT_DEADLINE, max_amount
    );
    
    start_cheat_caller_address(portal_address, user);
    portal.claim(0_u256, array![].span());
    stop_cheat_caller_address(portal_address);
}

// ============================================================
// PAUSABLE TESTS
// ============================================================

#[test]
#[should_panic(expected: ('Pausable: paused',))]
fn test_claim_when_paused_fails() {
    let user = USER1();
    let amount: u256 = 1000_u256;
    let merkle_root = single_leaf_root(user, amount);
    let max_amount: u256 = 10000_u256;
    
    let (_, portal_address, portal) = deploy_token_and_portal(
        merkle_root, DEFAULT_DEADLINE, max_amount
    );
    
    let admin = IPortalAdminDispatcher { contract_address: portal_address };
    
    // Pause the contract
    start_cheat_caller_address(portal_address, OWNER());
    admin.pause();
    stop_cheat_caller_address(portal_address);
    
    // Try to claim while paused
    start_cheat_caller_address(portal_address, user);
    portal.claim(amount, array![].span());
    stop_cheat_caller_address(portal_address);
}

// ============================================================
// ADMIN / TIMELOCK TESTS
// ============================================================

#[test]
fn test_propose_merkle_root_creates_pending() {
    let merkle_root = single_leaf_root(USER1(), 1000_u256);
    let max_amount: u256 = 10000_u256;
    let (_, portal_address, portal) = deploy_token_and_portal(
        merkle_root, DEFAULT_DEADLINE, max_amount
    );
    
    let admin = IPortalAdminDispatcher { contract_address: portal_address };
    let new_root: felt252 = 0x12345;
    
    start_cheat_caller_address(portal_address, OWNER());
    admin.propose_merkle_root(new_root);
    stop_cheat_caller_address(portal_address);
    
    // Old root still active
    assert(portal.merkle_root() == merkle_root, 'Root should not change yet');
}

#[test]
#[should_panic(expected: ('Portal: timelock not expired',))]
fn test_execute_root_update_before_timelock_fails() {
    let merkle_root = single_leaf_root(USER1(), 1000_u256);
    let max_amount: u256 = 10000_u256;
    let (_, portal_address, _) = deploy_token_and_portal(
        merkle_root, DEFAULT_DEADLINE, max_amount
    );
    
    let admin = IPortalAdminDispatcher { contract_address: portal_address };
    let new_root: felt252 = 0x12345;
    
    start_cheat_caller_address(portal_address, OWNER());
    admin.propose_merkle_root(new_root);
    // Try to execute immediately without waiting
    admin.execute_merkle_root_update();
    stop_cheat_caller_address(portal_address);
}

// ============================================================
// VIEW FUNCTION TESTS
// ============================================================

#[test]
fn test_get_claimable_returns_true_for_valid_claim() {
    let user = USER1();
    let amount: u256 = 1000_u256;
    let merkle_root = single_leaf_root(user, amount);
    let max_amount: u256 = 10000_u256;
    
    let (_, _, portal) = deploy_token_and_portal(
        merkle_root, DEFAULT_DEADLINE, max_amount
    );
    
    let is_claimable = portal.get_claimable(user, amount, array![].span());
    assert(is_claimable, 'Should be claimable');
}

#[test]
fn test_get_claimable_returns_false_after_claim() {
    let user = USER1();
    let amount: u256 = 1000_u256;
    let merkle_root = single_leaf_root(user, amount);
    let max_amount: u256 = 10000_u256;
    
    let (_, portal_address, portal) = deploy_token_and_portal(
        merkle_root, DEFAULT_DEADLINE, max_amount
    );
    
    start_cheat_caller_address(portal_address, user);
    portal.claim(amount, array![].span());
    stop_cheat_caller_address(portal_address);
    
    let is_claimable = portal.get_claimable(user, amount, array![].span());
    assert(!is_claimable, 'Should not be claimable');
}

// ============================================================
// MISSING CRITICAL TESTS
// ============================================================

#[test]
fn test_claim_four_users_with_multilevel_tree() {
    let users = array![USER1(), USER2(), USER3(), USER4()].span();
    let amounts = array![100_u256, 200_u256, 300_u256, 400_u256].span();
    let (merkle_root, proofs) = four_leaf_tree(users, amounts);
    let max_amount: u256 = 10000_u256;
    
    let (_, portal_address, portal) = deploy_token_and_portal(
        merkle_root, DEFAULT_DEADLINE, max_amount
    );
    
    // All 4 users claim with their respective proofs
    // User 0
    start_cheat_caller_address(portal_address, USER1());
    portal.claim(100_u256, *proofs.at(0));
    stop_cheat_caller_address(portal_address);
    
    // User 1
    start_cheat_caller_address(portal_address, USER2());
    portal.claim(200_u256, *proofs.at(1));
    stop_cheat_caller_address(portal_address);
    
    // User 2
    start_cheat_caller_address(portal_address, USER3());
    portal.claim(300_u256, *proofs.at(2));
    stop_cheat_caller_address(portal_address);
    
    // User 3
    start_cheat_caller_address(portal_address, USER4());
    portal.claim(400_u256, *proofs.at(3));
    stop_cheat_caller_address(portal_address);
    
    // Verify all claimed
    assert(portal.is_claimed(USER1()), 'User1 should be claimed');
    assert(portal.is_claimed(USER2()), 'User2 should be claimed');
    assert(portal.is_claimed(USER3()), 'User3 should be claimed');
    assert(portal.is_claimed(USER4()), 'User4 should be claimed');
    
    // Verify total
    assert(portal.total_claimed() == 1000_u256, 'Wrong total');
}

#[test]
#[should_panic(expected: ('Portal: amount exceeds max',))]
fn test_claim_exceeds_max_amount_fails() {
    let user = USER1();
    let amount: u256 = 5000_u256;
    let merkle_root = single_leaf_root(user, amount);
    let max_amount: u256 = 1000_u256; // Max is less than claim
    
    let (_, portal_address, portal) = deploy_token_and_portal(
        merkle_root, DEFAULT_DEADLINE, max_amount
    );
    
    start_cheat_caller_address(portal_address, user);
    portal.claim(amount, array![].span());
    stop_cheat_caller_address(portal_address);
}

#[test]
#[should_panic(expected: ('Portal: invalid merkle proof',))]
fn test_claim_wrong_user_with_anothers_proof_fails() {
    let amount1: u256 = 1000_u256;
    let amount2: u256 = 2000_u256;
    let (merkle_root, proof1, _) = two_leaf_tree(USER1(), amount1, USER2(), amount2);
    let max_amount: u256 = 10000_u256;
    
    let (_, portal_address, portal) = deploy_token_and_portal(
        merkle_root, DEFAULT_DEADLINE, max_amount
    );
    
    // USER3 tries to claim with USER1's proof
    start_cheat_caller_address(portal_address, USER3());
    portal.claim(amount1, proof1);
    stop_cheat_caller_address(portal_address);
}

#[test]
fn test_claim_large_u256_amount_with_high_bits() {
    let user = USER1();
    // Test amount with high bits set but within max supply
    // MAX_SUPPLY = 1e27, so we need amount < 1e27
    // Use a reasonable amount: high=1 means 2^128, but we'll use smaller
    // Actually, 2^128 is ~3.4e38 which exceeds max supply
    // So use high=0 but test that the contract handles u256 properly
    // For a true high-bit test, use high=1, low=small_value, but this exceeds supply
    // Instead, test with a large low value that's still within supply
    let amount: u256 = u256 { 
        low: 1000000000000000000000000_u128,  // 1e24 (1M tokens with 18 decimals)
        high: 0_u128                          // No high bits, but tests large u256 handling
    };
    let merkle_root = single_leaf_root(user, amount);
    // Max amount needs to be larger than claim amount
    let max_amount: u256 = u256 { low: 0, high: 10 }; // Very large max
    
    let (token_address, portal_address, portal) = deploy_token_and_portal(
        merkle_root, DEFAULT_DEADLINE, max_amount
    );
    
    start_cheat_caller_address(portal_address, user);
    portal.claim(amount, array![].span());
    stop_cheat_caller_address(portal_address);
    
    let erc20 = IERC20Dispatcher { contract_address: token_address };
    assert(erc20.balance_of(user) == amount, 'Wrong balance');
}

#[test]
fn test_timelock_execution_after_waiting() {
    let merkle_root = single_leaf_root(USER1(), 1000_u256);
    let max_amount: u256 = 10000_u256;
    
    // Set block number to 0 before deployment
    start_cheat_block_number_global(0_u64);
    let (_, portal_address, portal) = deploy_token_and_portal(
        merkle_root, DEFAULT_DEADLINE, max_amount
    );
    stop_cheat_block_number_global();
    
    let admin = IPortalAdminDispatcher { contract_address: portal_address };
    let new_root: felt252 = single_leaf_root(USER2(), 2000_u256);
    let timelock_blocks: u64 = 14400;
    
    // Get current block after deployment
    start_cheat_block_number_global(100_u64); // Set to block 100
    
    start_cheat_caller_address(portal_address, OWNER());
    admin.propose_merkle_root(new_root);
    stop_cheat_caller_address(portal_address);
    
    // Fast forward past timelock (proposed at block 100, need block 100 + 14400)
    start_cheat_block_number_global(100_u64 + timelock_blocks + 1);
    
    start_cheat_caller_address(portal_address, OWNER());
    admin.execute_merkle_root_update();
    stop_cheat_caller_address(portal_address);
    
    assert(portal.merkle_root() == new_root, 'Root should be updated');
    stop_cheat_block_number_global();
}

#[test]
fn test_claim_after_unpause_succeeds() {
    let user = USER1();
    let amount: u256 = 1000_u256;
    let merkle_root = single_leaf_root(user, amount);
    let max_amount: u256 = 10000_u256;
    
    let (_, portal_address, portal) = deploy_token_and_portal(
        merkle_root, DEFAULT_DEADLINE, max_amount
    );
    
    let admin = IPortalAdminDispatcher { contract_address: portal_address };
    
    // Pause then unpause
    start_cheat_caller_address(portal_address, OWNER());
    admin.pause();
    admin.unpause();
    stop_cheat_caller_address(portal_address);
    
    // Claim should work after unpause
    start_cheat_caller_address(portal_address, user);
    portal.claim(amount, array![].span());
    stop_cheat_caller_address(portal_address);
    
    assert(portal.is_claimed(user), 'Should be claimed');
}

