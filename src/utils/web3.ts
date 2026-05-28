// Web3 Utility for Monad integration using Ethers.js
import { BrowserProvider, Contract, parseEther, formatEther } from "ethers";
import contractAddresses from "./contractAddresses.json";

export interface PetStats {
  name: string;
  hunger: number;
  hygiene: number;
  energy: number;
  level: number;
  xp: bigint;
  createdAt: bigint;
  lastUpdated: bigint;
  skinId: number;
}

export interface LeaderboardEntry {
  owner: string;
  petName: string;
  level: number;
  xp: bigint;
  skinId: number;
}

export interface PetEventLog {
  type: 'feed' | 'clean' | 'sleep' | 'play' | 'create' | 'levelup' | 'claim';
  description: string;
  timestamp: number;
  txHash: string;
}

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

export const MONAD_MAINNET_CONFIG = {
  chainId: '0x8f', // 143 in hex
  chainName: 'Monad Mainnet',
  nativeCurrency: {
    name: 'Monad MON',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.monad.xyz'],
  blockExplorerUrls: ['https://monadvision.com'],
};

export const ETERNAL_PETZ_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "", "type": "address"}],
    "name": "pets",
    "outputs": [
      {"internalType": "string", "name": "name", "type": "string"},
      {"internalType": "uint8", "name": "hunger", "type": "uint8"},
      {"internalType": "uint8", "name": "hygiene", "type": "uint8"},
      {"internalType": "uint8", "name": "energy", "type": "uint8"},
      {"internalType": "uint16", "name": "level", "type": "uint16"},
      {"internalType": "uint256", "name": "xp", "type": "uint256"},
      {"internalType": "uint256", "name": "createdAt", "type": "uint256"},
      {"internalType": "uint256", "name": "lastUpdated", "type": "uint256"},
      {"internalType": "uint8", "name": "skinId", "type": "uint8"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "", "type": "address"}],
    "name": "hasPet",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "_owner", "type": "address"}],
    "name": "getPetStats",
    "outputs": [
      {
        "components": [
          {"internalType": "string", "name": "name", "type": "string"},
          {"internalType": "uint8", "name": "hunger", "type": "uint8"},
          {"internalType": "uint8", "name": "hygiene", "type": "uint8"},
          {"internalType": "uint8", "name": "energy", "type": "uint8"},
          {"internalType": "uint16", "name": "level", "type": "uint16"},
          {"internalType": "uint256", "name": "xp", "type": "uint256"},
          {"internalType": "uint256", "name": "createdAt", "type": "uint256"},
          {"internalType": "uint256", "name": "lastUpdated", "type": "uint256"},
          {"internalType": "uint8", "name": "skinId", "type": "uint8"}
        ],
        "internalType": "struct EternalPetz.Pet",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getLeaderboard",
    "outputs": [
      {
        "components": [
          {"internalType": "address", "name": "owner", "type": "address"},
          {"internalType": "string", "name": "petName", "type": "string"},
          {"internalType": "uint16", "name": "level", "type": "uint16"},
          {"internalType": "uint256", "name": "xp", "type": "uint256"},
          {"internalType": "uint8", "name": "skinId", "type": "uint8"}
        ],
        "internalType": "struct EternalPetz.LeaderboardEntry[10]",
        "name": "",
        "type": "tuple[10]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "string", "name": "_name", "type": "string"},
      {"internalType": "uint8", "name": "_skinId", "type": "uint8"}
    ],
    "name": "createPet",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "feedPet",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "cleanPet",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "sleepPet",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "playWithPet",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "owner", "type": "address"},
      {"indexed": false, "internalType": "string", "name": "name", "type": "string"},
      {"indexed": false, "internalType": "uint8", "name": "skinId", "type": "uint8"},
      {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
    ],
    "name": "PetCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "owner", "type": "address"},
      {"indexed": false, "internalType": "uint8", "name": "hunger", "type": "uint8"},
      {"indexed": false, "internalType": "uint256", "name": "xp", "type": "uint256"},
      {"indexed": false, "internalType": "uint16", "name": "level", "type": "uint16"},
      {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
    ],
    "name": "Fed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "owner", "type": "address"},
      {"indexed": false, "internalType": "uint8", "name": "hygiene", "type": "uint8"},
      {"indexed": false, "internalType": "uint256", "name": "xp", "type": "uint256"},
      {"indexed": false, "internalType": "uint16", "name": "level", "type": "uint16"},
      {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
    ],
    "name": "Cleaned",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "owner", "type": "address"},
      {"indexed": false, "internalType": "uint8", "name": "energy", "type": "uint8"},
      {"indexed": false, "internalType": "uint256", "name": "xp", "type": "uint256"},
      {"indexed": false, "internalType": "uint16", "name": "level", "type": "uint16"},
      {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
    ],
    "name": "Slept",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "owner", "type": "address"},
      {"indexed": false, "internalType": "uint8", "name": "energy", "type": "uint8"},
      {"indexed": false, "internalType": "uint8", "name": "hunger", "type": "uint8"},
      {"indexed": false, "internalType": "uint8", "name": "hygiene", "type": "uint8"},
      {"indexed": false, "internalType": "uint256", "name": "xp", "type": "uint256"},
      {"indexed": false, "internalType": "uint16", "name": "level", "type": "uint16"},
      {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
    ],
    "name": "Played",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "owner", "type": "address"},
      {"indexed": false, "internalType": "uint16", "name": "newLevel", "type": "uint16"},
      {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
    ],
    "name": "LeveledUp",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "claimLevelReward",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "", "type": "address"}],
    "name": "lastClaimedLevel",
    "outputs": [{"internalType": "uint16", "name": "", "type": "uint16"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "REWARD_PER_LEVEL",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "player", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"},
      {"indexed": false, "internalType": "uint16", "name": "upToLevel", "type": "uint16"},
      {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
    ],
    "name": "RewardClaimed",
    "type": "event"
  }
];

export function isMetaMaskInstalled(): boolean {
  return typeof window !== 'undefined' && (window as any).ethereum !== undefined;
}

export async function connectWallet(): Promise<string | null> {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed. Please install a compatible Web3 wallet.');
  }

  try {
    const ethereum = (window as any).ethereum;
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    if (accounts && accounts.length > 0) {
      return accounts[0].toLowerCase();
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

export async function switchNetwork(isMainnet: boolean): Promise<boolean> {
  if (!isMetaMaskInstalled()) return false;

  const ethereum = (window as any).ethereum;
  const config = isMainnet ? MONAD_MAINNET_CONFIG : MONAD_TESTNET_CONFIG;
  
  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: config.chainId }],
    });
    return true;
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [config],
        });
        return true;
      } catch (addError) {
        console.error('Error adding network:', addError);
        return false;
      }
    }
    console.error('Error switching network:', switchError);
    return false;
  }
}

export function getContractAddress(chainId: string | null): string {
  if (!chainId) return contractAddresses.monadTestnet;
  
  // Testnet chainId is 0x279f (10143)
  // Mainnet chainId is 0x8f (143)
  if (chainId === MONAD_MAINNET_CONFIG.chainId || chainId === '143') {
    return (contractAddresses as any).monadMainnet || contractAddresses.monadTestnet;
  }
  return contractAddresses.monadTestnet;
}

export function getContractInstance(address: string, signerOrProvider: any): Contract {
  return new Contract(address, ETERNAL_PETZ_ABI, signerOrProvider);
}

export async function checkHasPet(contractAddress: string, userAddress: string): Promise<boolean> {
  if (!isMetaMaskInstalled()) return false;
  const provider = new BrowserProvider((window as any).ethereum);
  const contract = getContractInstance(contractAddress, provider);
  return await contract.hasPet(userAddress);
}

export async function getPetStats(contractAddress: string, userAddress: string): Promise<PetStats | null> {
  if (!isMetaMaskInstalled()) return null;
  try {
    const provider = new BrowserProvider((window as any).ethereum);
    const contract = getContractInstance(contractAddress, provider);
    const petResult = await contract.getPetStats(userAddress);
    
    return {
      name: petResult[0],
      hunger: Number(petResult[1]),
      hygiene: Number(petResult[2]),
      energy: Number(petResult[3]),
      level: Number(petResult[4]),
      xp: BigInt(petResult[5]),
      createdAt: BigInt(petResult[6]),
      lastUpdated: BigInt(petResult[7]),
      skinId: Number(petResult[8])
    };
  } catch (error) {
    console.error("Error calling getPetStats:", error);
    return null;
  }
}

export async function getLeaderboard(contractAddress: string): Promise<LeaderboardEntry[]> {
  if (!isMetaMaskInstalled()) return [];
  try {
    const provider = new BrowserProvider((window as any).ethereum);
    const contract = getContractInstance(contractAddress, provider);
    const lbResult = await contract.getLeaderboard();
    
    const leaderboard: LeaderboardEntry[] = [];
    for (let i = 0; i < lbResult.length; i++) {
      const entry = lbResult[i];
      if (entry.owner !== "0x0000000000000000000000000000000000000000") {
        leaderboard.push({
          owner: entry.owner.toLowerCase(),
          petName: entry.petName,
          level: Number(entry.level),
          xp: BigInt(entry.xp),
          skinId: Number(entry.skinId)
        });
      }
    }
    return leaderboard;
  } catch (error) {
    console.error("Error calling getLeaderboard:", error);
    return [];
  }
}

export async function createPet(contractAddress: string, name: string, skinId: number): Promise<string> {
  const provider = new BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();
  const contract = getContractInstance(contractAddress, signer);
  
  const tx = await contract.createPet(name, skinId);
  await tx.wait();
  return tx.hash;
}

export async function feedPet(contractAddress: string): Promise<string> {
  const provider = new BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();
  const contract = getContractInstance(contractAddress, signer);
  
  const tx = await contract.feedPet({ value: parseEther("0.01") });
  await tx.wait();
  return tx.hash;
}

export async function cleanPet(contractAddress: string): Promise<string> {
  const provider = new BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();
  const contract = getContractInstance(contractAddress, signer);
  
  const tx = await contract.cleanPet({ value: parseEther("0.01") });
  await tx.wait();
  return tx.hash;
}

export async function sleepPet(contractAddress: string): Promise<string> {
  const provider = new BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();
  const contract = getContractInstance(contractAddress, signer);
  
  const tx = await contract.sleepPet({ value: parseEther("0.01") });
  await tx.wait();
  return tx.hash;
}

export async function playWithPet(contractAddress: string): Promise<string> {
  const provider = new BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();
  const contract = getContractInstance(contractAddress, signer);
  
  const tx = await contract.playWithPet({ value: parseEther("0.01") });
  await tx.wait();
  return tx.hash;
}

export async function claimLevelReward(contractAddress: string): Promise<string> {
  const provider = new BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();
  const contract = getContractInstance(contractAddress, signer);
  
  const tx = await contract.claimLevelReward();
  await tx.wait();
  return tx.hash;
}

export async function getLastClaimedLevel(contractAddress: string, userAddress: string): Promise<number> {
  if (!isMetaMaskInstalled()) return 1;
  try {
    const provider = new BrowserProvider((window as any).ethereum);
    const contract = getContractInstance(contractAddress, provider);
    const lastClaimed = await contract.lastClaimedLevel(userAddress);
    return Number(lastClaimed);
  } catch (error) {
    console.error("Error calling lastClaimedLevel:", error);
    return 1;
  }
}

export async function getContractBalance(contractAddress: string): Promise<string> {
  if (!isMetaMaskInstalled()) return "0.0";
  try {
    const provider = new BrowserProvider((window as any).ethereum);
    const balance = await provider.getBalance(contractAddress);
    return parseFloat(formatEther(balance)).toFixed(4);
  } catch (error) {
    console.error("Error getting contract balance:", error);
    return "0.0";
  }
}

export async function fetchPetEvents(contractAddress: string, userAddress: string): Promise<PetEventLog[]> {
  if (!isMetaMaskInstalled()) return [];
  try {
    const provider = new BrowserProvider((window as any).ethereum);
    const contract = getContractInstance(contractAddress, provider);
    
    // Filter events for the indexed owner address
    const ownerFilter = contract.filters.PetCreated(userAddress);
    const fedFilter = contract.filters.Fed(userAddress);
    const cleanedFilter = contract.filters.Cleaned(userAddress);
    const sleptFilter = contract.filters.Slept(userAddress);
    const playedFilter = contract.filters.Played(userAddress);
    const leveledFilter = contract.filters.LeveledUp(userAddress);
    const claimFilter = contract.filters.RewardClaimed(userAddress);

    // Limit log scan range to prevent 413 Payload Too Large on Mainnet RPC
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock > 100000 ? currentBlock - 100000 : 0;

    // Fetch in parallel
    const [created, feds, cleans, sleeps, plays, levels, claims] = await Promise.all([
      contract.queryFilter(ownerFilter, fromBlock, 'latest'),
      contract.queryFilter(fedFilter, fromBlock, 'latest'),
      contract.queryFilter(cleanedFilter, fromBlock, 'latest'),
      contract.queryFilter(sleptFilter, fromBlock, 'latest'),
      contract.queryFilter(playedFilter, fromBlock, 'latest'),
      contract.queryFilter(leveledFilter, fromBlock, 'latest'),
      contract.queryFilter(claimFilter, fromBlock, 'latest')
    ]);

    const events: PetEventLog[] = [];

    created.forEach((evt: any) => {
      events.push({
        type: 'create',
        description: `Day 1: Created Pet "${evt.args[1]}"`,
        timestamp: Number(evt.args[3]),
        txHash: evt.transactionHash
      });
    });

    feds.forEach((evt: any) => {
      events.push({
        type: 'feed',
        description: `You fed your pet (+20 hunger, +5 XP).`,
        timestamp: Number(evt.args[4]),
        txHash: evt.transactionHash
      });
    });

    cleans.forEach((evt: any) => {
      events.push({
        type: 'clean',
        description: `You cleaned your pet (+20 hygiene, +5 XP).`,
        timestamp: Number(evt.args[4]),
        txHash: evt.transactionHash
      });
    });

    sleeps.forEach((evt: any) => {
      events.push({
        type: 'sleep',
        description: `Your pet went to sleep (+30 energy, +3 XP).`,
        timestamp: Number(evt.args[4]),
        txHash: evt.transactionHash
      });
    });

    plays.forEach((evt: any) => {
      events.push({
        type: 'play',
        description: `You played with your pet (-10 energy, +10 XP, -10 hunger/hygiene).`,
        timestamp: Number(evt.args[6]),
        txHash: evt.transactionHash
      });
    });

    levels.forEach((evt: any) => {
      events.push({
        type: 'levelup',
        description: `Leveled Up! Your pet is now Level ${Number(evt.args[1])}! 🎉`,
        timestamp: Number(evt.args[2]),
        txHash: evt.transactionHash
      });
    });

    claims.forEach((evt: any) => {
      const amountEth = parseFloat(formatEther(evt.args[1])).toFixed(3);
      events.push({
        type: 'claim',
        description: `Claimed Reward: +${amountEth} MON (Up to Level ${Number(evt.args[2])}) 🎁`,
        timestamp: Number(evt.args[3]),
        txHash: evt.transactionHash
      });
    });

    // Sort by timestamp descending
    return events.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("Error querying event filters:", error);
    return [];
  }
}
