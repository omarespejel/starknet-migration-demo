use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use migration_portal::token::{IMigrationTokenDispatcher, IMigrationTokenDispatcherTrait};
use migration_portal::test_utils::{OWNER, USER1, USER2, ZERO_ADDRESS};
use openzeppelin_token::erc20::interface::{
    IERC20Dispatcher, IERC20DispatcherTrait,
    IERC20MetadataDispatcher, IERC20MetadataDispatcherTrait
};
use openzeppelin_access::accesscontrol::interface::{
    IAccessControlDispatcher, IAccessControlDispatcherTrait
};
use starknet::ContractAddress;
use core::serde::Serde;

// ============================================================
// DEPLOYMENT TESTS
// ============================================================

fn deploy_token(admin: ContractAddress, minter: ContractAddress) -> ContractAddress {
    let contract = declare("MigrationToken").unwrap().contract_class();
    let mut args = array![];
    let name: ByteArray = "TestToken";
    let symbol: ByteArray = "TST";
    name.serialize(ref args);
    symbol.serialize(ref args);
    admin.serialize(ref args);
    minter.serialize(ref args);
    let (address, _) = contract.deploy(@args).unwrap();
    address
}

#[test]
fn test_deploy_initializes_name_and_symbol() {
    let token_address = deploy_token(OWNER(), USER1());
    let erc20_meta = IERC20MetadataDispatcher { contract_address: token_address };
    
    assert(erc20_meta.name() == "TestToken", 'Wrong name');
    assert(erc20_meta.symbol() == "TST", 'Wrong symbol');
}

#[test]
fn test_deploy_grants_admin_role() {
    let token_address = deploy_token(OWNER(), USER1());
    let access = IAccessControlDispatcher { contract_address: token_address };
    
    let admin_role: felt252 = 0; // DEFAULT_ADMIN_ROLE
    assert(access.has_role(admin_role, OWNER()), 'Admin role not granted');
}

#[test]
fn test_deploy_grants_minter_role_when_not_zero() {
    let token_address = deploy_token(OWNER(), USER1());
    let access = IAccessControlDispatcher { contract_address: token_address };
    
    let minter_role: felt252 = selector!("MINTER_ROLE");
    assert(access.has_role(minter_role, USER1()), 'Minter role not granted');
}

#[test]
fn test_deploy_with_zero_minter_does_not_grant_role() {
    let token_address = deploy_token(OWNER(), ZERO_ADDRESS());
    let access = IAccessControlDispatcher { contract_address: token_address };
    
    let minter_role: felt252 = selector!("MINTER_ROLE");
    let has_role = access.has_role(minter_role, ZERO_ADDRESS());
    assert(!has_role, 'Role should not be granted');
}

#[test]
fn test_initial_supply_is_zero() {
    let token_address = deploy_token(OWNER(), USER1());
    let erc20 = IERC20Dispatcher { contract_address: token_address };
    
    assert(erc20.total_supply() == 0, 'Initial supply should be 0');
}

// ============================================================
// MINT TESTS
// ============================================================

#[test]
fn test_mint_by_minter_succeeds() {
    let minter = USER1();
    let recipient = USER2();
    let token_address = deploy_token(OWNER(), minter);
    let erc20 = IERC20Dispatcher { contract_address: token_address };
    
    start_cheat_caller_address(token_address, minter);
    let token = IMigrationTokenDispatcher { contract_address: token_address };
    token.mint(recipient, 1000_u256);
    stop_cheat_caller_address(token_address);
    
    assert(erc20.balance_of(recipient) == 1000_u256, 'Wrong balance after mint');
    assert(erc20.total_supply() == 1000_u256, 'Wrong total supply');
}

#[test]
#[should_panic(expected: ('Caller is missing role',))]
fn test_mint_by_non_minter_fails() {
    let token_address = deploy_token(OWNER(), USER1());
    let token = IMigrationTokenDispatcher { contract_address: token_address };
    
    // USER2 is not a minter
    start_cheat_caller_address(token_address, USER2());
    token.mint(USER2(), 1000_u256);
    stop_cheat_caller_address(token_address);
}

#[test]
#[should_panic(expected: ('Amount must be positive',))]
fn test_mint_zero_amount_fails() {
    let minter = USER1();
    let token_address = deploy_token(OWNER(), minter);
    let token = IMigrationTokenDispatcher { contract_address: token_address };
    
    start_cheat_caller_address(token_address, minter);
    token.mint(USER2(), 0_u256);
    stop_cheat_caller_address(token_address);
}

#[test]
#[should_panic(expected: ('Exceeds max supply',))]
fn test_mint_exceeds_max_supply_fails() {
    let minter = USER1();
    let token_address = deploy_token(OWNER(), minter);
    let token = IMigrationTokenDispatcher { contract_address: token_address };
    
    let max_supply: u256 = 1_000_000_000_000_000_000_000_000_000_u256;
    
    start_cheat_caller_address(token_address, minter);
    token.mint(USER2(), max_supply + 1);
    stop_cheat_caller_address(token_address);
}

// ============================================================
// ACCESS CONTROL TESTS
// ============================================================

#[test]
fn test_admin_can_grant_minter_role() {
    let token_address = deploy_token(OWNER(), USER1());
    let access = IAccessControlDispatcher { contract_address: token_address };
    let minter_role: felt252 = selector!("MINTER_ROLE");
    
    start_cheat_caller_address(token_address, OWNER());
    access.grant_role(minter_role, USER2());
    stop_cheat_caller_address(token_address);
    
    assert(access.has_role(minter_role, USER2()), 'Role not granted');
}

#[test]
fn test_admin_can_revoke_minter_role() {
    let token_address = deploy_token(OWNER(), USER1());
    let access = IAccessControlDispatcher { contract_address: token_address };
    let minter_role: felt252 = selector!("MINTER_ROLE");
    
    start_cheat_caller_address(token_address, OWNER());
    access.revoke_role(minter_role, USER1());
    stop_cheat_caller_address(token_address);
    
    assert(!access.has_role(minter_role, USER1()), 'Role not revoked');
}

#[test]
fn test_grant_minter_role_function() {
    let token_address = deploy_token(OWNER(), ZERO_ADDRESS());
    let token = IMigrationTokenDispatcher { contract_address: token_address };
    let access = IAccessControlDispatcher { contract_address: token_address };
    let minter_role: felt252 = selector!("MINTER_ROLE");
    
    // Initially USER1 doesn't have role
    assert(!access.has_role(minter_role, USER1()), 'Should not have role initially');
    
    // Grant via grant_minter_role function
    start_cheat_caller_address(token_address, OWNER());
    token.grant_minter_role(USER1());
    stop_cheat_caller_address(token_address);
    
    assert(access.has_role(minter_role, USER1()), 'Role should be granted');
}

