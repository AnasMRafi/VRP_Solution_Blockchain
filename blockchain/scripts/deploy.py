"""
Deploy RouteRegistry Smart Contract to Ganache

This script:
1. Connects to local Ganache blockchain
2. Compiles the Solidity contract
3. Deploys it to the blockchain
4. Saves the contract address and ABI

Run this once after starting Ganache.
"""

import json
from web3 import Web3
from solcx import compile_source, install_solc
import os
from pathlib import Path

# Install Solidity compiler (if not already installed)
install_solc('0.8.0')

# Configuration
GANACHE_URL = "http://127.0.0.1:7545"
CONTRACT_FILE = Path(__file__).parent.parent / "contracts" / "RouteRegistry.sol"
OUTPUT_DIR = Path(__file__).parent.parent / "deployed"

def main():
    """
    Main deployment function
    """
    print("=" * 60)
    print("RouteChain - Smart Contract Deployment")
    print("=" * 60)
    
    # Step 1: Connect to Ganache
    print("\n1. Connecting to Ganache...")
    w3 = Web3(Web3.HTTPProvider(GANACHE_URL))
    
    if not w3.is_connected():
        print("✗ Failed to connect to Ganache")
        print(f"  Make sure Ganache is running on {GANACHE_URL}")
        return
    
    print(f"✓ Connected to Ganache")
    print(f"  Chain ID: {w3.eth.chain_id}")
    print(f"  Block Number: {w3.eth.block_number}")
    
    # Step 2: Get deployer account
    print("\n2. Setting up deployer account...")
    accounts = w3.eth.accounts
    if not accounts:
        print("✗ No accounts found in Ganache")
        return
    
    deployer = accounts[0]
    print(f"✓ Deployer account: {deployer}")
    print(f"  Balance: {w3.from_wei(w3.eth.get_balance(deployer), 'ether')} ETH")
    
    # Step 3: Read and compile contract
    print("\n3. Compiling smart contract...")
    
    with open(CONTRACT_FILE, 'r') as f:
        contract_source = f.read()
    
    # Compile the contract
    compiled_sol = compile_source(
        contract_source,
        output_values=['abi', 'bin']
    )
    
    # Get contract interface
    contract_id = 'RouteRegistry'
    contract_interface = None
    
    for key in compiled_sol.keys():
        if contract_id in key:
            contract_interface = compiled_sol[key]
            break
    
    if not contract_interface:
        print(f"✗ Contract '{contract_id}' not found in compiled output")
        return
    
    print(f"✓ Contract compiled successfully")
    
    # Step 4: Deploy contract
    print("\n4. Deploying contract...")
    
    RouteRegistry = w3.eth.contract(
        abi=contract_interface['abi'],
        bytecode=contract_interface['bin']
    )
    
    # Build transaction
    tx_hash = RouteRegistry.constructor().transact({
        'from': deployer
    })
    
    print(f"  Transaction hash: {tx_hash.hex()}")
    
    # Wait for transaction receipt
    print("  Waiting for confirmation...")
    tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    
    contract_address = tx_receipt.contractAddress
    print(f"✓ Contract deployed!")
    print(f"  Contract address: {contract_address}")
    print(f"  Gas used: {tx_receipt.gasUsed}")
    print(f"  Block number: {tx_receipt.blockNumber}")
    
    # Step 5: Save deployment information
    print("\n5. Saving deployment information...")
    
    # Create output directory if it doesn't exist
    OUTPUT_DIR.mkdir(exist_ok=True)
    
    # Save contract ABI
    abi_file = OUTPUT_DIR / "RouteRegistry_abi.json"
    with open(abi_file, 'w') as f:
        json.dump(contract_interface['abi'], f, indent=2)
    print(f"✓ ABI saved to: {abi_file}")
    
    # Save deployment info
    deployment_info = {
        "contract_address": contract_address,
        "deployer_address": deployer,
        "chain_id": w3.eth.chain_id,
        "block_number": tx_receipt.blockNumber,
        "transaction_hash": tx_hash.hex(),
        "ganache_url": GANACHE_URL
    }
    
    info_file = OUTPUT_DIR / "deployment_info.json"
    with open(info_file, 'w') as f:
        json.dump(deployment_info, f, indent=2)
    print(f"✓ Deployment info saved to: {info_file}")
    
    # Step 6: Verify deployment
    print("\n6. Verifying deployment...")
    
    contract = w3.eth.contract(
        address=contract_address,
        abi=contract_interface['abi']
    )
    
    # Test: Get initial route count (should be 0)
    route_count = contract.functions.getRouteCount().call()
    print(f"✓ Contract is functional")
    print(f"  Initial route count: {route_count}")
    
    # Print summary
    print("\n" + "=" * 60)
    print("DEPLOYMENT SUCCESSFUL!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Update backend .env with:")
    print(f"   CONTRACT_ADDRESS={contract_address}")
    print("\n2. Restart your backend server")
    print("\n3. Routes will now be recorded on blockchain!")
    print("=" * 60)

if __name__ == "__main__":
    main()