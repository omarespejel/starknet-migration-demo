#[starknet::contract]
pub mod MigrationPortal {
    use starknet::{ContractAddress, get_caller_address, get_block_number};
    use starknet::storage::*;
    use core::poseidon::PoseidonTrait;
    use core::hash::HashStateTrait;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_security::pausable::PausableComponent;
    use openzeppelin_merkle_tree::merkle_proof::verify_poseidon;
    use migration_portal::token::{IMigrationTokenDispatcher, IMigrationTokenDispatcherTrait};

    // Constants
    pub const MAX_PROOF_LENGTH: u32 = 32; // Merkle tree depth limit

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableTwoStepImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl PausableImpl = PausableComponent::PausableImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
        // Core state
        token: ContractAddress,
        merkle_root: felt252,
        claimed: Map<ContractAddress, bool>,
        claim_deadline_block: u64,
        // Timelock for root updates
        pending_root: felt252,
        pending_root_block: u64,
        // Stats
        total_claimed: u256,
        // Security: max claim amount limit
        max_claim_amount: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        PausableEvent: PausableComponent::Event,
        Claimed: Claimed,
        MerkleRootProposed: MerkleRootProposed,
        MerkleRootUpdated: MerkleRootUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Claimed {
        #[key]
        pub user: ContractAddress,
        pub amount: u256,
        pub block: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MerkleRootProposed {
        pub new_root: felt252,
        pub execution_block: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MerkleRootUpdated {
        pub old_root: felt252,
        pub new_root: felt252,
    }

    pub mod Errors {
        pub const ALREADY_CLAIMED: felt252 = 'Portal: already claimed';
        pub const CLAIM_PERIOD_ENDED: felt252 = 'Portal: claim period ended';
        pub const INVALID_PROOF: felt252 = 'Portal: invalid merkle proof';
        pub const PROOF_TOO_LONG: felt252 = 'Portal: proof exceeds max depth';
        pub const AMOUNT_ZERO: felt252 = 'Portal: amount must be positive';
        pub const TIMELOCK_NOT_READY: felt252 = 'Portal: timelock not expired';
        pub const NO_PENDING_ROOT: felt252 = 'Portal: no pending root';
        pub const MAX_AMOUNT_EXCEEDED: felt252 = 'Portal: amount exceeds max';
        pub const INVALID_MAX_AMOUNT: felt252 = 'Portal: invalid max amount';
    }

    // Timelock: ~48 hours at 12s blocks = 14400 blocks
    pub const ROOT_UPDATE_TIMELOCK_BLOCKS: u64 = 14400;

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        token: ContractAddress,
        merkle_root: felt252,
        claim_deadline_block: u64,
        max_claim_amount: u256,
    ) {
        // === VALIDATION ===
        let zero_address: ContractAddress = 0.try_into().unwrap();
        assert(owner != zero_address, 'Portal: owner is zero');
        assert(token != zero_address, 'Portal: token is zero');
        assert(merkle_root != 0, 'Portal: invalid merkle root');
        assert(claim_deadline_block > get_block_number(), 'Portal: deadline in past');
        assert(max_claim_amount > 0, Errors::INVALID_MAX_AMOUNT);
        
        // === INITIALIZATION ===
        self.ownable.initializer(owner);
        self.token.write(token);
        self.merkle_root.write(merkle_root);
        self.claim_deadline_block.write(claim_deadline_block);
        self.max_claim_amount.write(max_claim_amount);
    }

    #[abi(embed_v0)]
    impl MigrationPortalImpl of super::IMigrationPortal<ContractState> {
        fn claim(ref self: ContractState, amount: u256, proof: Span<felt252>) {
            // Pausable check
            self.pausable.assert_not_paused();
            let caller = get_caller_address();
            let current_block = get_block_number();

            // === CHECKS ===
            assert(proof.len() <= MAX_PROOF_LENGTH, Errors::PROOF_TOO_LONG);
            assert(!self.claimed.entry(caller).read(), Errors::ALREADY_CLAIMED);
            assert(current_block <= self.claim_deadline_block.read(), Errors::CLAIM_PERIOD_ENDED);
            assert(amount > 0, Errors::AMOUNT_ZERO);
            assert(amount <= self.max_claim_amount.read(), Errors::MAX_AMOUNT_EXCEEDED);

            // Compute leaf and verify merkle proof
            let leaf = InternalImpl::compute_leaf(caller, amount);
            let root = self.merkle_root.read();
            assert(verify_poseidon(proof, root, leaf), Errors::INVALID_PROOF);

            // === EFFECTS (before external calls) ===
            self.claimed.entry(caller).write(true);
            self.total_claimed.write(self.total_claimed.read() + amount);

            // Emit event
            self.emit(Claimed { user: caller, amount, block: current_block });

            // === INTERACTIONS ===
            let token_dispatcher = IMigrationTokenDispatcher { contract_address: self.token.read() };
            token_dispatcher.mint(caller, amount);
        }

        fn is_claimed(self: @ContractState, user: ContractAddress) -> bool {
            self.claimed.entry(user).read()
        }

        fn get_claimable(
            self: @ContractState, 
            user: ContractAddress, 
            amount: u256, 
            proof: Span<felt252>
        ) -> bool {
            if self.claimed.entry(user).read() {
                return false;
            }
            let leaf = InternalImpl::compute_leaf(user, amount);
            verify_poseidon(proof, self.merkle_root.read(), leaf)
        }

        fn merkle_root(self: @ContractState) -> felt252 {
            self.merkle_root.read()
        }

        fn total_claimed(self: @ContractState) -> u256 {
            self.total_claimed.read()
        }
    }

    // Admin functions with timelock
    #[abi(embed_v0)]
    impl AdminImpl of super::IPortalAdmin<ContractState> {
        fn propose_merkle_root(ref self: ContractState, new_root: felt252) {
            self.ownable.assert_only_owner();
            // Prevent setting invalid zero root
            assert(new_root != 0, 'Portal: invalid root');
            let execution_block = get_block_number() + ROOT_UPDATE_TIMELOCK_BLOCKS;
            self.pending_root.write(new_root);
            self.pending_root_block.write(execution_block);
            self.emit(MerkleRootProposed { new_root, execution_block });
        }

        fn execute_merkle_root_update(ref self: ContractState) {
            self.ownable.assert_only_owner();
            let pending = self.pending_root.read();
            assert(pending != 0, Errors::NO_PENDING_ROOT);
            assert(get_block_number() >= self.pending_root_block.read(), Errors::TIMELOCK_NOT_READY);

            let old_root = self.merkle_root.read();
            self.merkle_root.write(pending);
            self.pending_root.write(0);
            self.emit(MerkleRootUpdated { old_root, new_root: pending });
        }

        fn pause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.pausable.pause();
        }

        fn unpause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.pausable.unpause();
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn compute_leaf(user: ContractAddress, amount: u256) -> felt252 {
            let mut state = PoseidonTrait::new();
            state = state.update(user.into());
            state = state.update(amount.low.into());
            state = state.update(amount.high.into());
            state.finalize()
        }
    }
}

// Interfaces
#[starknet::interface]
pub trait IMigrationPortal<TContractState> {
    fn claim(ref self: TContractState, amount: u256, proof: Span<felt252>);
    fn is_claimed(self: @TContractState, user: starknet::ContractAddress) -> bool;
    fn get_claimable(self: @TContractState, user: starknet::ContractAddress, amount: u256, proof: Span<felt252>) -> bool;
    fn merkle_root(self: @TContractState) -> felt252;
    fn total_claimed(self: @TContractState) -> u256;
}

#[starknet::interface]
pub trait IPortalAdmin<TContractState> {
    fn propose_merkle_root(ref self: TContractState, new_root: felt252);
    fn execute_merkle_root_update(ref self: TContractState);
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
}


