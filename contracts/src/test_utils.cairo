use core::poseidon::PoseidonTrait;
use core::hash::HashStateTrait;
use starknet::ContractAddress;

/// Compute leaf hash matching portal.cairo's compute_leaf
pub fn compute_leaf(user: ContractAddress, amount: u256) -> felt252 {
    let mut state = PoseidonTrait::new();
    state = state.update(user.into());
    state = state.update(amount.low.into());
    state = state.update(amount.high.into());
    state.finalize()
}

/// Hash two nodes for merkle tree (sorted order)
/// Matches OpenZeppelin's PoseidonCHasher which sorts before hashing
/// For u256, high part is more significant, so compare high first, then low
pub fn hash_pair(a: felt252, b: felt252) -> felt252 {
    let mut state = PoseidonTrait::new();
    
    // Convert to u256 for comparison
    let a_u256: u256 = a.into();
    let b_u256: u256 = b.into();
    
    // Compare high part first (more significant), then low part
    let a_less_than_b = if a_u256.high != b_u256.high {
        a_u256.high < b_u256.high
    } else {
        a_u256.low < b_u256.low
    };
    
    if a_less_than_b {
        state = state.update(a);
        state = state.update(b);
    } else {
        state = state.update(b);
        state = state.update(a);
    }
    state.finalize()
}

/// Build merkle root for a single claim (root == leaf)
pub fn single_leaf_root(user: ContractAddress, amount: u256) -> felt252 {
    compute_leaf(user, amount)
}

/// Build merkle root and proofs for two claims
pub fn two_leaf_tree(
    user1: ContractAddress, amount1: u256,
    user2: ContractAddress, amount2: u256
) -> (felt252, Span<felt252>, Span<felt252>) {
    let leaf1 = compute_leaf(user1, amount1);
    let leaf2 = compute_leaf(user2, amount2);
    let root = hash_pair(leaf1, leaf2);
    
    // Proof for leaf1 is [leaf2], proof for leaf2 is [leaf1]
    let proof1 = array![leaf2].span();
    let proof2 = array![leaf1].span();
    
    (root, proof1, proof2)
}

/// Build merkle root and proofs for four claims (balanced tree)
pub fn four_leaf_tree(
    users: Span<ContractAddress>,
    amounts: Span<u256>
) -> (felt252, Array<Span<felt252>>) {
    assert(users.len() == 4, 'Need exactly 4 users');
    assert(amounts.len() == 4, 'Need exactly 4 amounts');
    
    let leaf0 = compute_leaf(*users.at(0), *amounts.at(0));
    let leaf1 = compute_leaf(*users.at(1), *amounts.at(1));
    let leaf2 = compute_leaf(*users.at(2), *amounts.at(2));
    let leaf3 = compute_leaf(*users.at(3), *amounts.at(3));
    
    let node01 = hash_pair(leaf0, leaf1);
    let node23 = hash_pair(leaf2, leaf3);
    let root = hash_pair(node01, node23);
    
    // Build proofs
    let proof0 = array![leaf1, node23].span();
    let proof1 = array![leaf0, node23].span();
    let proof2 = array![leaf3, node01].span();
    let proof3 = array![leaf2, node01].span();
    
    (root, array![proof0, proof1, proof2, proof3])
}

// Test addresses - using simple felt252 values for testing
pub fn OWNER() -> ContractAddress {
    0x1_felt252.try_into().unwrap()
}

pub fn USER1() -> ContractAddress {
    0x10_felt252.try_into().unwrap()
}

pub fn USER2() -> ContractAddress {
    0x20_felt252.try_into().unwrap()
}

pub fn USER3() -> ContractAddress {
    0x30_felt252.try_into().unwrap()
}

pub fn USER4() -> ContractAddress {
    0x40_felt252.try_into().unwrap()
}

pub fn ZERO_ADDRESS() -> ContractAddress {
    0.try_into().unwrap()
}

pub const DEFAULT_DEADLINE: u64 = 1_000_000;
pub const DEFAULT_AMOUNT: u256 = 1000_u256;
