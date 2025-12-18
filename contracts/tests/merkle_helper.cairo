use core::poseidon::PoseidonTrait;
use core::hash::HashStateTrait;
use starknet::ContractAddress;

/// Compute leaf hash matching the portal contract's compute_leaf function
/// Leaf = Poseidon(user_address, amount_low, amount_high)
pub fn compute_test_leaf(user: ContractAddress, amount: u256) -> felt252 {
    let mut state = PoseidonTrait::new();
    state = state.update(user.into());
    state = state.update(amount.low.into());
    state = state.update(amount.high.into());
    state.finalize()
}

/// For single-leaf tree (testing), root == leaf
/// This is useful for simple test cases where a user has a single claim
pub fn get_single_user_root(user: ContractAddress, amount: u256) -> felt252 {
    compute_test_leaf(user, amount)
}

