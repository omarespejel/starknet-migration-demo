use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait,
    start_cheat_caller_address, stop_cheat_caller_address,
    start_cheat_block_number_global, stop_cheat_block_number_global,
};
use migration_portal::portal::{
    IMigrationPortalDispatcher, IMigrationPortalDispatcherTrait,
    IPortalAdminDispatcher, IPortalAdminDispatcherTrait
};
use migration_portal::token::{
    IMigrationTokenDispatcher, IMigrationTokenDispatcherTrait
};
use migration_portal::test_utils::{OWNER, USER1, ZERO_ADDRESS, single_leaf_root};
use starknet::ContractAddress;
use core::serde::Serde;

fn USER() -> ContractAddress {
    USER1()
}

fn deploy_token(admin: ContractAddress, minter: ContractAddress) -> IMigrationTokenDispatcher {
    let contract = declare("MigrationToken").unwrap().contract_class();
    let mut constructor_args = array![];
    let name: ByteArray = "MigrationToken";
    let symbol: ByteArray = "MIG";
    name.serialize(ref constructor_args);
    symbol.serialize(ref constructor_args);
    admin.serialize(ref constructor_args);
    // minter can be zero address - will be set later via grant_minter_role
    minter.serialize(ref constructor_args);
    
    let (contract_address, _) = contract.deploy(@constructor_args).unwrap();
    IMigrationTokenDispatcher { contract_address }
}

fn deploy_portal(
    owner: ContractAddress,
    token: ContractAddress,
    merkle_root: felt252,
    claim_deadline_block: u64,
    max_claim_amount: u256
) -> IMigrationPortalDispatcher {
    let contract = declare("MigrationPortal").unwrap().contract_class();
    let mut constructor_args = array![];
    owner.serialize(ref constructor_args);
    token.serialize(ref constructor_args);
    merkle_root.serialize(ref constructor_args);
    claim_deadline_block.serialize(ref constructor_args);
    max_claim_amount.low.serialize(ref constructor_args);
    max_claim_amount.high.serialize(ref constructor_args);
    
    let (contract_address, _) = contract.deploy(@constructor_args).unwrap();
    IMigrationPortalDispatcher { contract_address }
}

#[test]
fn test_claim_success() {
    // Setup: deploy token and portal
    let zero_address = ZERO_ADDRESS();
    let token = deploy_token(OWNER(), zero_address); // Deploy without minter
    
    // Generate real merkle root for single user
    let amount: u256 = 1000_u256;
    let merkle_root = single_leaf_root(USER(), amount);
    let deadline = 1000000_u64;
    let max_amount: u256 = 10000_u256;
    let portal = deploy_portal(OWNER(), token.contract_address, merkle_root, deadline, max_amount);
    
    // Grant minter role to portal (simulating post-deployment setup)
    start_cheat_caller_address(token.contract_address, OWNER());
    token.grant_minter_role(portal.contract_address);
    stop_cheat_caller_address(token.contract_address);
    
    // Empty proof for single-leaf tree
    let proof: Span<felt252> = array![].span();
    
    start_cheat_caller_address(portal.contract_address, USER());
    portal.claim(amount, proof);
    stop_cheat_caller_address(portal.contract_address);
    
    assert(portal.is_claimed(USER()), 'Should be claimed');
}

#[test]
#[should_panic(expected: ('Portal: already claimed',))]
fn test_double_claim_fails() {
    let zero_address = ZERO_ADDRESS();
    let token = deploy_token(OWNER(), zero_address);
    
    let amount: u256 = 1000_u256;
    let merkle_root = single_leaf_root(USER(), amount);
    let deadline = 1000000_u64;
    let max_amount: u256 = 10000_u256;
    let portal = deploy_portal(OWNER(), token.contract_address, merkle_root, deadline, max_amount);
    
    start_cheat_caller_address(token.contract_address, OWNER());
    token.grant_minter_role(portal.contract_address);
    stop_cheat_caller_address(token.contract_address);
    
    let proof: Span<felt252> = array![].span();
    
    start_cheat_caller_address(portal.contract_address, USER());
    
    // First claim succeeds
    portal.claim(amount, proof);
    
    // Second claim should fail
    portal.claim(amount, proof);
    
    stop_cheat_caller_address(portal.contract_address);
}

#[test]
#[should_panic(expected: ('Portal: claim period ended',))]
fn test_claim_after_deadline_fails() {
    let zero_address = ZERO_ADDRESS();
    let token = deploy_token(OWNER(), zero_address);
    
    let amount: u256 = 1000_u256;
    let merkle_root = single_leaf_root(USER(), amount);
    // Set deadline to a future block, then cheat block number before deployment
    let deadline = 1000_u64;
    let max_amount: u256 = 10000_u256;
    
    // Set block number to 0 before deployment so deadline is valid
    start_cheat_block_number_global(0_u64);
    let portal = deploy_portal(OWNER(), token.contract_address, merkle_root, deadline, max_amount);
    stop_cheat_block_number_global();
    
    start_cheat_caller_address(token.contract_address, OWNER());
    token.grant_minter_role(portal.contract_address);
    stop_cheat_caller_address(token.contract_address);
    
    // Fast forward past deadline
    start_cheat_block_number_global(deadline + 1);
    
    start_cheat_caller_address(portal.contract_address, USER());
    let proof: Span<felt252> = array![].span();
    
    // Should fail due to deadline
    portal.claim(amount, proof);
    
    stop_cheat_caller_address(portal.contract_address);
    stop_cheat_block_number_global();
}

#[test]
fn test_is_claimed() {
    let zero_address = ZERO_ADDRESS();
    let token = deploy_token(OWNER(), zero_address);
    
    let amount: u256 = 1000_u256;
    let merkle_root = single_leaf_root(USER(), amount);
    let deadline = 1000000_u64;
    let max_amount: u256 = 10000_u256;
    let portal = deploy_portal(OWNER(), token.contract_address, merkle_root, deadline, max_amount);
    
    // Initially not claimed
    assert(!portal.is_claimed(USER()), 'Should not be claimed initially');
}

#[test]
fn test_admin_functions() {
    let zero_address = ZERO_ADDRESS();
    let token = deploy_token(OWNER(), zero_address);
    
    let amount: u256 = 1000_u256;
    let merkle_root = single_leaf_root(USER(), amount);
    let deadline = 1000000_u64;
    let max_amount: u256 = 10000_u256;
    let portal = deploy_portal(OWNER(), token.contract_address, merkle_root, deadline, max_amount);
    
    start_cheat_caller_address(token.contract_address, OWNER());
    token.grant_minter_role(portal.contract_address);
    stop_cheat_caller_address(token.contract_address);
    
    let admin_dispatcher = IPortalAdminDispatcher { contract_address: portal.contract_address };
    
    start_cheat_caller_address(portal.contract_address, OWNER());
    
    // Test pause
    admin_dispatcher.pause();
    
    // Test propose merkle root (with valid non-zero root)
    let new_amount: u256 = 2000_u256;
    let new_root = single_leaf_root(USER(), new_amount);
    admin_dispatcher.propose_merkle_root(new_root);
    
    stop_cheat_caller_address(portal.contract_address);
}

