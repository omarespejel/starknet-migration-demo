#[starknet::contract]
pub mod MigrationToken {
    use openzeppelin_token::erc20::{ERC20Component, ERC20HooksEmptyImpl};
    use openzeppelin_access::accesscontrol::AccessControlComponent;
    use openzeppelin_access::accesscontrol::DEFAULT_ADMIN_ROLE;
    use openzeppelin_introspection::src5::SRC5Component;
    use starknet::ContractAddress;

    // Role constants - use selector! for type safety
    pub const MINTER_ROLE: felt252 = selector!("MINTER_ROLE");
    pub const MAX_SUPPLY: u256 = 1_000_000_000_000_000_000_000_000_000; // 1B tokens

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: AccessControlComponent, storage: access_control, event: AccessControlEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);

    // ERC20 Mixin - exposes all standard functions
    #[abi(embed_v0)]
    impl ERC20MixinImpl = ERC20Component::ERC20MixinImpl<ContractState>;
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    // AccessControl
    #[abi(embed_v0)]
    impl AccessControlImpl = AccessControlComponent::AccessControlImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;

    // SRC5
    #[abi(embed_v0)]
    impl SRC5Impl = SRC5Component::SRC5Impl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        #[substorage(v0)]
        access_control: AccessControlComponent::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
        #[flat]
        AccessControlEvent: AccessControlComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        symbol: ByteArray,
        admin: ContractAddress,
        minter: ContractAddress, // Migration portal address (can be zero, set later)
    ) {
        // Validate admin is not zero address
        let zero_address: ContractAddress = 0.try_into().unwrap();
        assert(admin != zero_address, 'Token: admin is zero');
        
        // Initialize ERC20
        self.erc20.initializer(name, symbol);
        
        // Setup access control roles
        self.access_control.initializer();
        self.access_control._grant_role(DEFAULT_ADMIN_ROLE, admin);
        
        // Only grant minter role if minter is not zero (allows deployment without portal)
        if minter != zero_address {
            self.access_control._grant_role(MINTER_ROLE, minter);
        }
    }

    #[external(v0)]
    fn grant_minter_role(ref self: ContractState, account: ContractAddress) {
        // CHECKS
        self.access_control.assert_only_role(DEFAULT_ADMIN_ROLE);
        let zero_address: ContractAddress = 0.try_into().unwrap();
        assert(account != zero_address, 'Token: account is zero');
        
        // EFFECTS
        self.access_control._grant_role(MINTER_ROLE, account);
    }

    #[external(v0)]
    fn mint(ref self: ContractState, to: ContractAddress, amount: u256) {
        // CHECKS
        self.access_control.assert_only_role(MINTER_ROLE);
        assert(amount > 0, 'Amount must be positive');
        
        let current_supply = self.erc20.total_supply();
        assert(current_supply + amount <= MAX_SUPPLY, 'Exceeds max supply');
        
        // EFFECTS + INTERACTIONS (mint is atomic)
        self.erc20.mint(to, amount);
    }
}

// Interface for token mint
#[starknet::interface]
pub trait IMigrationToken<TContractState> {
    fn mint(ref self: TContractState, to: starknet::ContractAddress, amount: u256);
    fn grant_minter_role(ref self: TContractState, account: starknet::ContractAddress);
}

