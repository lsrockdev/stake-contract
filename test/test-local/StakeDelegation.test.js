/// Using local network
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8545'));

/// Openzeppelin test-helper
const { time } = require('@openzeppelin/test-helpers');

/// Artifact of smart contracts 
const StakeDelegation = artifacts.require("StakeDelegation");
const StakeDelegationFactory = artifacts.require("StakeDelegationFactory");
const OneInchDelegationManager = artifacts.require("OneInchDelegationManager");
const OneInch = artifacts.require("OneInch");
const GovernanceMothership = artifacts.require("GovernanceMothership");
const MooniswapFactoryGovernance = artifacts.require("MooniswapFactoryGovernance");


/***
 * @dev - Execution COMMAND: $ truffle test ./test/test-local/StakeDelegation.test.js
 **/
contract("StakeDelegation", function(accounts) {
    /// Acccounts
    let deployer = accounts[0];
    let user1 = accounts[1];
    let user2 = accounts[2];
    let user3 = accounts[3];

    /// Global Tokenization contract instance
    let stakeDelegation1;
    let stakeDelegation2;
    let StakeDelegation3;
    let stakeDelegationFactory;
    let oneInchDelegationManager;
    let oneInch;
    let stOneInch;
    let mooniswapFactoryGovernance;

    /// Global variable for each contract addresses
    let STAKE_DELEGATION_1;
    let STAKE_DELEGATION_2;
    let STAKE_DELEGATION_3;
    let STAKE_DELEGATION_FACTORY;
    let ONEINCH_DELEGATION_MANAGER;
    let ONEINCH;
    let ST_ONEINCH;
    let MOONISWAP_FACTORY_GOVERNANCE;

    /// Global variable for saving block number
    let firstActionBlockNumber = 0;
    let secondActionBlockNumber = 0;


    describe("Check state in advance", () => {
        it("Check all accounts", async () => {
            console.log('\n=== accounts ===\n', accounts, '\n========================\n');
        }); 
    }); 

    describe("Setup smart-contracts", () => {
        it("Deploy the OneInch contract instance", async () => {
            const owner = deployer;
            oneInch = await OneInch.new(owner, { from: deployer });
            ONEINCH = oneInch.address;
        });

        it("Deploy the GovernanceMothership contract instance (stOneInch)", async () => {
            stOneInch = await GovernanceMothership.new(ONEINCH, { from: deployer });
            ST_ONEINCH = stOneInch.address;
        });

        it("Deploy the MooniswapFactoryGovernance contract instance", async () => {
            const mothership = deployer;
            mooniswapFactoryGovernance = await MooniswapFactoryGovernance.new(mothership, { from: deployer });
            MOONISWAP_FACTORY_GOVERNANCE = mooniswapFactoryGovernance.address;
        });

        it("Deploy the StakeDelegationFactory contract instance", async () => {
            stakeDelegationFactory = await StakeDelegationFactory.new(ONEINCH, ST_ONEINCH,  MOONISWAP_FACTORY_GOVERNANCE, { from: deployer });
            STAKE_DELEGATION_FACTORY = stakeDelegationFactory.address;
        });

        it("Deploy the OneInchDelegationManager contract instance", async () => {
            oneInchDelegationManager = await OneInchDelegationManager.new(ONEINCH,{ from: deployer });
            ONEINCH_DELEGATION_MANAGER = oneInchDelegationManager.address;
        });
    });

    describe("Check initial status", () => {
        it("TotalSupply of 1inch token should be 1,500,000,000", async () => {
            _totalSupply = await oneInch.totalSupply({ from: deployer });
            console.log("\n=== totalSupply of 1inch token ===", String(web3.utils.fromWei(_totalSupply, 'ether')));
            assert.equal(
                String(web3.utils.fromWei(_totalSupply, 'ether')),
                "1500000000",
                "TotalSupply of 1inch token should be 1,500,000,000",
            );
        });

        it("1,000 1inch token should be minted to 3 users (wallet addresses)", async () => {
            const owner = deployer;
            const mintAmount = web3.utils.toWei('1000', 'ether');  /// 1000 1inch tokens
            txReceipt1 = await oneInch.mint(user1, mintAmount, { from: owner });
            txReceipt2 = await oneInch.mint(user2, mintAmount, { from: owner });
            txReceipt3 = await oneInch.mint(user3, mintAmount, { from: owner });
        });
    });

    describe("StakeDelegationFactory", () => {
        it("a new StakeDelegation contract should be created", async () => {
            txReceipt = await stakeDelegationFactory.createNewStakeDelegation({ from: user1 });

            /// [Note]: Retrieve an event log via web3.js v1.0.0
            let events = await stakeDelegationFactory.getPastEvents('StakeDelegationCreated', {
                filter: {},  /// [Note]: If "index" is used for some event property, index number is specified
                fromBlock: 0,
                toBlock: 'latest'
            });
            console.log("\n=== Event log of StakeDelegationCreated ===", events[0].returnValues);  /// [Result]: Successful to retrieve event log

            STAKE_DELEGATION_1 = events[0].returnValues.stakeDelegation;
            console.log("\n=== STAKE_DELEGATION_1 ===", STAKE_DELEGATION_1);
        });
    });

    describe("OneInchDelegationManager", () => {
        it("should be delegated by the StakeDelegation contract address", async () => {
            /// [Note]: One of the StakeDelegation contract address (created by the StakeDelegationFactory contract) is assigned as a parameter of delegate() method
            const delegatee = STAKE_DELEGATION_1;
            const delegatedAmount = web3.utils.toWei('500', 'ether');
            await oneInch.approve(ONEINCH_DELEGATION_MANAGER, delegatedAmount, { from: user1 });
            txReceipt = await oneInchDelegationManager.delegate(delegatee, delegatedAmount, { from: user1 });

            let events = await oneInchDelegationManager.getPastEvents('DelegateChanged', {
                filter: {},  /// [Note]: If "index" is used for some event property, index number is specified
                fromBlock: 0,
                toBlock: 'latest'
            });
            console.log("\n=== Event log of DelegateChanged ===", events[0].returnValues);  /// [Result]: Successful to retrieve event log

            /// Save block number
            firstActionBlockNumber = await time.latestBlock();  /// Get the latest block number
            console.log("\n=== firstActionBlockNumber ===", String(firstActionBlockNumber));
        });

        it("getPowerAtBlock of user1 should be 0", async () => {
            const user = user1;
            const blockNumber = Number(String(firstActionBlockNumber));
            const delegationType = 0;  /// [Note]: "0" indicates "STAKE" that is defined in the DelegationType enum
            const _powerAtBlock = await oneInchDelegationManager.getPowerAtBlock(user, blockNumber, delegationType, { from: user1 });
            const powerAtBlock = web3.utils.fromWei(String(_powerAtBlock), 'ether');
            console.log("\n=== powerAtBlock of user1 ===", powerAtBlock);

            assert.equal(
                powerAtBlock,
                "0",
                "PowerAtBlock of user1 should be 0"
            );
        });

        it("getPowerAtBlock of STAKE_DELEGATION_1 should be 1000", async () => {
            const user = STAKE_DELEGATION_1;
            const blockNumber = Number(String(firstActionBlockNumber));
            const delegationType = 0;  /// [Note]: "0" indicates "STAKE" that is defined in the DelegationType enum
            const _powerAtBlock = await oneInchDelegationManager.getPowerAtBlock(user, blockNumber, delegationType, { from: user1 });
            const powerAtBlock = web3.utils.fromWei(String(_powerAtBlock), 'ether');
            console.log("\n=== powerAtBlock of STAKE_DELEGATION_1 ===", powerAtBlock);            

            assert.equal(
                powerAtBlock,
                "1000",
                "PowerAtBlock of user1 should be 1000"
            );
        });
    });

    describe("StakeDelegation", () => {
        let stakeDelegation1;

        it("Setup the STAKE_DELEGATION_1 contract", async () => {
            stakeDelegation1 = await StakeDelegation.at(STAKE_DELEGATION_1, { from: user1 });
        });

        it("delegateStaking by the STAKE_DELEGATION_1 contract", async () => {
            const stakeAmount = web3.utils.toWei('500', 'ether');  /// 500 1inch tokens 
            const txReceipt = await stakeDelegation1.delegateStaking(stakeAmount, { from: user1 });
        });

        it("delegate FeeVote by the STAKE_DELEGATION_1 contract", async () => {
            /// [Todo]: Next
            const vote = 10;
            const txReceipt = await stakeDelegation1.delegateFeeVote(vote, { from: user1 });
        });
    });

});
