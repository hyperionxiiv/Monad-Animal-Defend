// Web3 utility for Monad Testnet integration
// Compatible with React 19 and requires zero external weight

export const MONAD_TESTNET_CONFIG = {
  chainId: '0x279f', // 10143 in hex
  chainName: 'Monad Testnet',
  nativeCurrency: {
    name: 'Monad MON',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: ['https://testnet-rpc.monad.xyz'],
  blockExplorerUrls: ['https://testnet.monadscan.com'],
};

// Default contract address (pointing to user's wallet to receive starting $MON fees)
export const DEFAULT_CONTRACT_ADDRESS = '0xdFf2AC111AD7f752DA9EC54a6d56D02A8a5D4896';

export function isMetaMaskInstalled(): boolean {
  return typeof window !== 'undefined' && (window as any).ethereum !== undefined;
}

export async function connectWallet(): Promise<string | null> {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed');
  }

  try {
    const ethereum = (window as any).ethereum;
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    if (accounts && accounts.length > 0) {
      return accounts[0];
    }
    return null;
  } catch (error: any) {
    console.error('Error connecting wallet:', error);
    throw error;
  }
}

export async function getCurrentChainId(): Promise<string | null> {
  if (!isMetaMaskInstalled()) return null;
  try {
    const ethereum = (window as any).ethereum;
    return await ethereum.request({ method: 'eth_chainId' });
  } catch (error) {
    console.error('Error getting chain ID:', error);
    return null;
  }
}

export async function switchToMonadTestnet(): Promise<boolean> {
  if (!isMetaMaskInstalled()) return false;

  const ethereum = (window as any).ethereum;
  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: MONAD_TESTNET_CONFIG.chainId }],
    });
    return true;
  } catch (switchError: any) {
    // This error code indicates that the chain has not been added to MetaMask.
    if (switchError.code === 4902) {
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [MONAD_TESTNET_CONFIG],
        });
        return true;
      } catch (addError) {
        console.error('Error adding Monad Testnet:', addError);
        return false;
      }
    }
    console.error('Error switching to Monad Testnet:', switchError);
    return false;
  }
}

/**
 * Sends a transaction to the Monad smart contract to start a game.
 * Requires 0.01 MON to start.
 */
export async function sendStartGameTx(
  contractAddress: string = DEFAULT_CONTRACT_ADDRESS,
  gameId: number
): Promise<string> {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed');
  }

  // Ensure we are on Monad Testnet
  const currentChain = await getCurrentChainId();
  if (currentChain !== MONAD_TESTNET_CONFIG.chainId) {
    const switched = await switchToMonadTestnet();
    if (!switched) {
      throw new Error('Failed to switch to Monad Testnet. Please switch network manually.');
    }
  }

  const ethereum = (window as any).ethereum;
  const accounts = await ethereum.request({ method: 'eth_accounts' });
  if (!accounts || accounts.length === 0) {
    throw new Error('Wallet not connected. Please connect your wallet first.');
  }
  const fromAddress = accounts[0];

  // gameStartFee: 0.01 MON in wei = 10^16 Wei = 0x2386f26fc10000 in hex
  const valueInWeiHex = '0x2386f26fc10000'; // 0.01 MON

  // Prepare transaction parameters
  // Method selector for startGame(uint256) is keccak256("startGame(uint256)") = 0xe3280c40
  const methodId = '0xe3280c40';
  
  // Pad game ID to 32 bytes hex
  const gameIdHex = gameId.toString(16).padStart(64, '0');
  
  const txData = methodId + gameIdHex;

  const txParams = {
    from: fromAddress,
    to: contractAddress,
    value: valueInWeiHex,
    data: txData,
  };

  try {
    const txHash = await ethereum.request({
      method: 'eth_sendTransaction',
      params: [txParams],
    });
    return txHash;
  } catch (error: any) {
    console.error('Error starting game on-chain:', error);
    throw error;
  }
}

/**
 * Listen for transaction receipt
 */
export async function waitForTxReceipt(txHash: string): Promise<boolean> {
  if (!isMetaMaskInstalled()) return false;
  const ethereum = (window as any).ethereum;

  const maxAttempts = 30; // 30 seconds timeout
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const receipt = await ethereum.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      });

      if (receipt) {
        // status: 1 = success, 0 = failure
        return receipt.status === '0x1' || receipt.status === 1;
      }
    } catch (e) {
      console.warn('Error polling for transaction receipt:', e);
    }
    // Wait 1 second
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  
  throw new Error('Transaction confirmation timed out. Please check your wallet history.');
}
