import { useState, useEffect } from 'react';
import { Loader2, Tv } from 'lucide-react';
import { 
  isMetaMaskInstalled,
  connectWallet,
  getCurrentChainId,
  switchNetwork,
  getContractAddress,
  checkHasPet,
  getPetStats,
  getLeaderboard,
  createPet,
  feedPet,
  cleanPet,
  sleepPet,
  playWithPet,
  fetchPetEvents,
  claimLevelReward,
  getLastClaimedLevel,
  getContractBalance,
  MONAD_TESTNET_CONFIG,
  MONAD_MAINNET_CONFIG
} from './utils/web3';
import type { PetStats, LeaderboardEntry, PetEventLog } from './utils/web3';

const STARTER_SKINS = [
  { id: 0, name: "Chog", icon: "/chog.png", color: "#a855f7", desc: "Adorable, loyal purple guardian baby Chog." }
];



function getPetFace(pet: PetStats, isPlaying: boolean, isSleeping: boolean): { face: string, statusText: string } {
  const hunger = pet.hunger;
  const hygiene = pet.hygiene;
  const energy = pet.energy;
  const skinId = pet.skinId;

  // Face designs
  const faces = [
    // Chog
    {
      idle: "(⊙ _ ⊙)",
      happy: "(⊙ ▽ ⊙)",
      sad: "(⊙ △ ⊙)",
      sleeping: "(- _ -) zZZ",
      playing: "(＠ ▽ ＠)"
    },
    // Molandak
    {
      idle: "(• _ •)",
      happy: "(• ⌔ •)",
      sad: "(• ⌓ •)",
      sleeping: "(- ⌔ -) zZZ",
      playing: "(≧ ⌔ ≦)"
    },
    // Moyaki
    {
      idle: "(• 人 •)",
      happy: "(^ 人 ^)",
      sad: "(v 人 v)",
      sleeping: "(- 人 -) zZZ",
      playing: "(> 人 <)"
    }
  ];

  const petFaces = faces[skinId] || faces[0];

  if (isSleeping) {
    return { face: petFaces.sleeping, statusText: "SLEEPING PEACEFULLY..." };
  }
  if (isPlaying) {
    return { face: petFaces.playing, statusText: "PLAYING ENERGETICALLY! +10 XP" };
  }
  if (hunger < 30) {
    return { face: petFaces.sad, statusText: "STARVING! FEED ME PLEASE..." };
  }
  if (hygiene < 30) {
    return { face: petFaces.sad, statusText: "DIRTY! I NEED A SHOWER..." };
  }
  if (energy < 30) {
    return { face: petFaces.sad, statusText: "EXHAUSTED... NEED SOME SLEEP" };
  }
  if (hunger > 80 && hygiene > 80 && energy > 50) {
    return { face: petFaces.happy, statusText: "SUPER HAPPY AND FULL OF LIFE!" };
  }
  return { face: petFaces.idle, statusText: "DOING JUST FINE." };
}

function App() {
  // Web3 State
  const [walletConnected, setWalletConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [isMainnet, setIsMainnet] = useState(false); // default to Testnet
  const [contractAddress, setContractAddress] = useState("");
  
  // Active Game State
  const [pet, setPet] = useState<PetStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [eventLogs, setEventLogs] = useState<PetEventLog[]>([]);
  
  // UI Controls
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTxPending, setIsTxPending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'none' | 'rewards' | 'leaderboard' | 'logs'>('none');
  const [showInfo, setShowInfo] = useState(false);
  
  // Reward system states
  const [lastClaimedLevel, setLastClaimedLevel] = useState<number>(1);
  const [contractBalance, setContractBalance] = useState<string>("0.0000");
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  
  // Animation states
  const [isPlayingAnim, setIsPlayingAnim] = useState(false);
  const [isSleepingState, setIsSleepingState] = useState(false);
  
  // Creation Form State
  const [createName, setCreateName] = useState("");
  const selectedSkin = 0;

  // Time calculations
  const [petAgeString, setPetAgeString] = useState("0D 0H");

  const [decayString, setDecayString] = useState("HUNGER DECAY IN 1H");

  // Load contract address based on network setting
  useEffect(() => {
    const addr = getContractAddress(isMainnet ? MONAD_MAINNET_CONFIG.chainId : MONAD_TESTNET_CONFIG.chainId);
    setContractAddress(addr);
  }, [isMainnet]);

  // Check wallet connection on load
  useEffect(() => {
    async function checkConnection() {
      if (isMetaMaskInstalled()) {
        const ethereum = (window as any).ethereum;
        try {
          const accounts = await ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            setUserAddress(accounts[0].toLowerCase());
            setWalletConnected(true);
            
            const currentChain = await getCurrentChainId();
            if (currentChain && currentChain.toLowerCase() === MONAD_MAINNET_CONFIG.chainId.toLowerCase()) {
              setIsMainnet(true);
            } else {
              setIsMainnet(false);
            }
          }
        } catch (e) {
          console.error("Error checking wallet connection:", e);
        }

        // Listeners
        ethereum.on('accountsChanged', (accounts: string[]) => {
          if (accounts.length > 0) {
            setUserAddress(accounts[0].toLowerCase());
            setWalletConnected(true);
            setIsDemoMode(false);
          } else {
            setUserAddress(null);
            setWalletConnected(false);
            setPet(null);
          }
        });

        ethereum.on('chainChanged', (newChainId: string) => {
          if (newChainId && newChainId.toLowerCase() === MONAD_MAINNET_CONFIG.chainId.toLowerCase()) {
            setIsMainnet(true);
          } else {
            setIsMainnet(false);
          }
        });
      }
    }
    checkConnection();
  }, []);

  // Fetch pet data when wallet connects or contract changes
  useEffect(() => {
    if (walletConnected && userAddress && contractAddress && !isDemoMode) {
      fetchPetData();
    }
  }, [walletConnected, userAddress, contractAddress, isDemoMode]);

  // If Demo Mode is enabled, load mock data or local storage
  useEffect(() => {
    if (isDemoMode) {
      loadDemoPet();
    }
  }, [isDemoMode]);

  // Update pet age and countdown strings periodically
  useEffect(() => {
    if (!pet) return;
    
    const interval = setInterval(() => {
      // Calculate age
      const now = Math.floor(Date.now() / 1000);
      const ageSeconds = now - Number(pet.createdAt);
      const days = Math.floor(ageSeconds / (24 * 3600));
      const hours = Math.floor((ageSeconds % (24 * 3600)) / 3600);
      const minutes = Math.floor((ageSeconds % 3600) / 60);
      
      setPetAgeString(`${days}D ${hours}H ${minutes}M`);

      // Decay string (Hunger decreases by 1 point per hour, Hygiene per 1.5h, Energy per 2h)
      // Calculate time until next hunger decrease
      const timeSinceLastUpdated = now - Number(pet.lastUpdated);
      const secondsToHungerDecay = 3600 - (timeSinceLastUpdated % 3600);
      const decMin = Math.floor(secondsToHungerDecay / 60);
      const decSec = secondsToHungerDecay % 60;
      setDecayString(`HUNGER DECAY IN ${decMin}M ${decSec}S`);
    }, 1000);

    return () => clearInterval(interval);
  }, [pet]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPetData = async () => {
    if (!contractAddress || !userAddress) return;
    setIsLoading(true);
    try {
      const hasPetExist = await checkHasPet(contractAddress, userAddress);
      
      if (hasPetExist) {
        const stats = await getPetStats(contractAddress, userAddress);
        if (stats) {
          setPet(stats);
          // Apply sleep state if energy was low and it just slept, otherwise false
          if (stats.energy > 80 && isSleepingState) {
            setIsSleepingState(false);
          }
        }
        
        // Fetch events
        const events = await fetchPetEvents(contractAddress, userAddress);
        setEventLogs(events);

        // Fetch reward claiming progress
        const claimedLevel = await getLastClaimedLevel(contractAddress, userAddress);
        setLastClaimedLevel(claimedLevel);
      } else {
        setPet(null);
      }
      
      // Fetch contract reward pool balance
      const balance = await getContractBalance(contractAddress);
      setContractBalance(balance);

      // Fetch leaderboard
      const lb = await getLeaderboard(contractAddress);
      setLeaderboard(lb);
    } catch (e) {
      console.error("Error fetching pet data:", e);
      showToast("Error reading from Monad blockchain");
    } finally {
      setIsLoading(false);
    }
  };

  // Demo mode functions
  const loadDemoPet = () => {
    const saved = localStorage.getItem("eternal_petz_demo_pet");
    const savedLogs = localStorage.getItem("eternal_petz_demo_logs");
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Apply offline decay
        const now = Math.floor(Date.now() / 1000);
        const timePassed = now - parsed.lastUpdated;
        
        if (timePassed > 0) {
          const hungerDecay = Math.floor(timePassed / 3600);
          const hygieneDecay = Math.floor(timePassed / 5400);
          const energyDecay = Math.floor(timePassed / 7200);
          
          parsed.hunger = Math.max(0, parsed.hunger - hungerDecay);
          parsed.hygiene = Math.max(0, parsed.hygiene - hygieneDecay);
          parsed.energy = Math.max(0, parsed.energy - energyDecay);
          parsed.lastUpdated = now;
        }

        // Parse bigints back
        setPet({
          name: parsed.name,
          hunger: parsed.hunger,
          hygiene: parsed.hygiene,
          energy: parsed.energy,
          level: parsed.level,
          xp: BigInt(parsed.xp),
          createdAt: BigInt(parsed.createdAt),
          lastUpdated: BigInt(parsed.lastUpdated),
          skinId: parsed.skinId
        });
      } catch (e) {
        console.error(e);
      }
    } else {
      setPet(null);
    }

    if (savedLogs) {
      try {
        setEventLogs(JSON.parse(savedLogs));
      } catch (e) {
        console.error(e);
      }
    } else {
      setEventLogs([]);
    }

    // Set demo leaderboard
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setLeaderboard([{
          owner: "you (demo)",
          petName: parsed.name,
          level: parsed.level,
          xp: BigInt(parsed.xp),
          skinId: parsed.skinId
        }]);
      } catch (e) {
        setLeaderboard([]);
      }
    } else {
      setLeaderboard([]);
    }
  };

  const saveDemoPet = (newPet: PetStats, newLogs: PetEventLog[]) => {
    setPet(newPet);
    setEventLogs(newLogs);
    
    const serializePet = {
      name: newPet.name,
      hunger: newPet.hunger,
      hygiene: newPet.hygiene,
      energy: newPet.energy,
      level: newPet.level,
      xp: newPet.xp.toString(),
      createdAt: newPet.createdAt.toString(),
      lastUpdated: newPet.lastUpdated.toString(),
      skinId: newPet.skinId
    };
    
    localStorage.setItem("eternal_petz_demo_pet", JSON.stringify(serializePet));
    localStorage.setItem("eternal_petz_demo_logs", JSON.stringify(newLogs));

    // Update demo leaderboard
    updateDemoLeaderboard(newPet);
  };

  const updateDemoLeaderboard = (demoPet: PetStats) => {
    setLeaderboard([{
      owner: "you (demo)",
      petName: demoPet.name,
      level: demoPet.level,
      xp: demoPet.xp,
      skinId: demoPet.skinId
    }]);
  };

  // Web3 Wallet connection trigger
  const handleConnect = async () => {
    try {
      const address = await connectWallet();
      if (address) {
        setUserAddress(address);
        setWalletConnected(true);
        setIsDemoMode(false);
        
        const currentChain = await getCurrentChainId();
        
        const targetChain = isMainnet ? MONAD_MAINNET_CONFIG.chainId : MONAD_TESTNET_CONFIG.chainId;
        if (!currentChain || currentChain.toLowerCase() !== targetChain.toLowerCase()) {
          const switched = await switchNetwork(isMainnet);
          if (!switched) {
            showToast("Failed to switch Monad network. Please switch manually.");
          }
        }
      }
    } catch (e: any) {
      showToast(e.message || "Failed to connect wallet");
    }
  };

  // Toggle network setting (Testnet vs Mainnet)
  const toggleNetwork = async () => {
    const nextMainnet = !isMainnet;
    setIsMainnet(nextMainnet);
    showToast(`Switched target network to Monad ${nextMainnet ? "Mainnet" : "Testnet"}`);
    
    if (walletConnected) {
      const success = await switchNetwork(nextMainnet);
      if (!success) {
        showToast("Please switch network in your wallet manually");
      }
    }
  };

  // Reset or Disconnect
  const handleExit = () => {
    if (isDemoMode) {
      if (confirm("Reset Demo pet data? This will clear local storage.")) {
        localStorage.removeItem("eternal_petz_demo_pet");
        localStorage.removeItem("eternal_petz_demo_logs");
        setPet(null);
        setEventLogs([]);
        setLeaderboard([]);
      }
    } else {
      setUserAddress(null);
      setWalletConnected(false);
      setPet(null);
    }
  };

  // Create Pet
  const handleCreatePet = async () => {
    if (!createName.trim()) {
      showToast("Please enter a pet name");
      return;
    }
    if (createName.length > 20) {
      showToast("Name must be 20 characters or less");
      return;
    }

    if (isDemoMode) {
      const newPet: PetStats = {
        name: createName,
        hunger: 80,
        hygiene: 80,
        energy: 80,
        level: 1,
        xp: 0n,
        createdAt: BigInt(Math.floor(Date.now() / 1000)),
        lastUpdated: BigInt(Math.floor(Date.now() / 1000)),
        skinId: selectedSkin
      };
      
      const newLogs: PetEventLog[] = [{
        type: 'create',
        description: `Day 1: Created Pet "${createName}"`,
        timestamp: Math.floor(Date.now() / 1000),
        txHash: "0xsimulation"
      }];
      
      saveDemoPet(newPet, newLogs);
      showToast(`Created Demo pet: ${createName}!`);
      return;
    }

    // Web3 Mode
    if (!walletConnected) return;
    
    // Ensure correct network
    const currentChain = await getCurrentChainId();
    const targetChain = isMainnet ? MONAD_MAINNET_CONFIG.chainId : MONAD_TESTNET_CONFIG.chainId;
    if (!currentChain || currentChain.toLowerCase() !== targetChain.toLowerCase()) {
      const switched = await switchNetwork(isMainnet);
      if (!switched) {
        showToast(`Please switch wallet to Monad ${isMainnet ? "Mainnet" : "Testnet"}`);
        return;
      }
    }

    setIsTxPending(true);
    setTxHash(null);

    try {
      const hash = await createPet(contractAddress, createName, selectedSkin);
      setTxHash(hash);
      showToast("Transaction sent! Creating pet...");
      
      // wait a bit and refresh
      setTimeout(() => {
        fetchPetData();
        setIsTxPending(false);
        setTxHash(null);
        showToast("Pet created successfully!");
      }, 5000);
    } catch (e: any) {
      console.error(e);
      showToast(e.reason || e.message || "Failed to create pet on-chain");
      setIsTxPending(false);
    }
  };

  // Care actions
  const handleAction = async (actionType: 'feed' | 'clean' | 'sleep' | 'play') => {
    if (!pet) return;

    if (isDemoMode) {
      // Simulate action
      let hunger = pet.hunger;
      let hygiene = pet.hygiene;
      let energy = pet.energy;
      let level = pet.level;
      let xp = pet.xp;
      let logDesc = "";

      if (actionType === 'feed') {
        hunger = Math.min(100, hunger + 20);
        xp += 5n;
        logDesc = "You fed your pet (+20 hunger, +5 XP).";
      } else if (actionType === 'clean') {
        hygiene = Math.min(100, hygiene + 20);
        xp += 5n;
        logDesc = "You cleaned your pet (+20 hygiene, +5 XP).";
      } else if (actionType === 'sleep') {
        energy = Math.min(100, energy + 30);
        xp += 3n;
        logDesc = "Your pet went to sleep (+30 energy, +3 XP).";
        setIsSleepingState(true);
      } else if (actionType === 'play') {
        if (energy < 10) {
          showToast("Pet is too tired to play!");
          return;
        }
        energy -= 10;
        xp += 10n;
        setIsPlayingAnim(true);
        setTimeout(() => setIsPlayingAnim(false), 3000);

        // Random decrease hunger or hygiene
        if (Math.random() > 0.5) {
          hunger = Math.max(0, hunger - 10);
        } else {
          hygiene = Math.max(0, hygiene - 10);
        }
        logDesc = "You played with your pet (-10 energy, +10 XP, -10 hunger/hygiene).";
      }

      // Check level up
      let xpNeeded = BigInt(level * 100);
      let logsAdded: PetEventLog[] = [];
      
      while (xp >= xpNeeded) {
        xp -= xpNeeded;
        level += 1;
        xpNeeded = BigInt(level * 100);
        logsAdded.push({
          type: 'levelup',
          description: `Leveled Up! Your pet is now Level ${level}! 🎉`,
          timestamp: Math.floor(Date.now() / 1000),
          txHash: "0xsimulation"
        });
      }

      const updatedPet: PetStats = {
        ...pet,
        hunger,
        hygiene,
        energy,
        level,
        xp,
        lastUpdated: BigInt(Math.floor(Date.now() / 1000))
      };

      const updatedLogs: PetEventLog[] = [
        {
          type: actionType,
          description: logDesc,
          timestamp: Math.floor(Date.now() / 1000),
          txHash: "0xsimulation"
        },
        ...logsAdded,
        ...eventLogs
      ];

      saveDemoPet(updatedPet, updatedLogs);
      showToast(logDesc);
      return;
    }

    // Web3 Mode
    if (!walletConnected) return;

    // Ensure correct network
    const currentChain = await getCurrentChainId();
    const targetChain = isMainnet ? MONAD_MAINNET_CONFIG.chainId : MONAD_TESTNET_CONFIG.chainId;
    if (!currentChain || currentChain.toLowerCase() !== targetChain.toLowerCase()) {
      const switched = await switchNetwork(isMainnet);
      if (!switched) {
        showToast(`Please switch wallet to Monad ${isMainnet ? "Mainnet" : "Testnet"}`);
        return;
      }
    }

    if (actionType === 'play' && pet.energy < 10) {
      showToast("Pet is too tired to play!");
      return;
    }

    setIsTxPending(true);
    setTxHash(null);
    showToast(`Sending 0.01 MON tx to ${actionType} pet...`);

    try {
      let hash = "";
      if (actionType === 'feed') {
        hash = await feedPet(contractAddress);
      } else if (actionType === 'clean') {
        hash = await cleanPet(contractAddress);
      } else if (actionType === 'sleep') {
        hash = await sleepPet(contractAddress);
        setIsSleepingState(true);
      } else if (actionType === 'play') {
        setIsPlayingAnim(true);
        hash = await playWithPet(contractAddress);
        setTimeout(() => setIsPlayingAnim(false), 3000);
      }

      setTxHash(hash);
      
      // wait a bit for confirmations and refresh
      setTimeout(() => {
        fetchPetData();
        setIsTxPending(false);
        setTxHash(null);
        showToast("Tx Confirmed! Stats updated.");
      }, 5000);

    } catch (e: any) {
      console.error(e);
      showToast(e.reason || e.message || "Transaction failed or rejected");
      setIsTxPending(false);
      setIsPlayingAnim(false);
    }
  };

  const handleClaimReward = async () => {
    if (isDemoMode) {
      showToast("Rewards are disabled in Demo Mode!");
      return;
    }
    if (!walletConnected || !pet || !contractAddress) return;
    
    if (pet.level <= lastClaimedLevel) {
      showToast("No rewards to claim yet!");
      return;
    }

    // Ensure correct network
    const currentChain = await getCurrentChainId();
    const targetChain = isMainnet ? MONAD_MAINNET_CONFIG.chainId : MONAD_TESTNET_CONFIG.chainId;
    if (!currentChain || currentChain.toLowerCase() !== targetChain.toLowerCase()) {
      const switched = await switchNetwork(isMainnet);
      if (!switched) {
        showToast(`Please switch wallet to Monad ${isMainnet ? "Mainnet" : "Testnet"}`);
        return;
      }
    }

    setIsClaiming(true);
    showToast("Sending transaction to claim your MON rewards...");

    try {
      await claimLevelReward(contractAddress);
      showToast("Claim transaction submitted! Waiting for confirmation...");
      
      // wait a bit for confirmations and refresh
      setTimeout(() => {
        fetchPetData();
        setIsClaiming(false);
        showToast("Claim successful! Rewards transferred to your wallet.");
      }, 5000);
    } catch (e: any) {
      console.error(e);
      showToast(e.reason || e.message || "Claim transaction failed");
      setIsClaiming(false);
    }
  };

  // Get pet face representation
  const petRepresentation = pet ? getPetFace(pet, isPlayingAnim, isSleepingState) : { face: "( - _ - )", statusText: "NO PET" };

  // Level Up requirement calculation
  const xpNeeded = pet ? pet.level * 100 : 100;
  const xpPercent = pet ? (Number(pet.xp) / xpNeeded) * 100 : 0;
  
  // Happiness calculation (average of hunger, energy, hygiene)
  const happiness = pet ? Math.round((pet.hunger + pet.hygiene + pet.energy) / 3) : 0;

  return (
    <div className="game-layout-wrapper">
      {/* Sidecar Detail Panel */}
      {activePanel !== 'none' && (
        <div className="crt-side-panel pixel-font">
          <div className="crt-screen">
            {activePanel === 'rewards' && (
              <div className="details-panel" style={{ border: 'none', background: 'none', maxHeight: 'none', padding: 0, boxShadow: 'none' }}>
                <div className="panel-title">🎁 PET REWARDS PORTAL</div>
                <div style={{ padding: '8px 0', fontSize: '1.1rem', textAlign: 'center' }}>
                  <div style={{ marginBottom: '12px', background: 'rgba(0, 0, 0, 0.4)', padding: '10px', border: '1px solid var(--border)', borderRadius: '4px' }}>
                    <span style={{ color: 'var(--text-inactive)', display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', fontFamily: '"Press Start 2P"', marginBottom: '4px' }}>Reward Pool Balance:</span>
                    <span className="glow-gold" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{contractBalance} MON</span>
                  </div>

                  <div style={{ textAlign: 'left', background: 'rgba(20, 7, 7, 0.6)', border: '2px solid #3c1616', padding: '10px', borderRadius: '6px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
                    <div>
                      <span style={{ color: 'var(--text-inactive)', display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', fontFamily: '"Press Start 2P"', marginBottom: '2px' }}>Your Pet Level:</span>
                      <span style={{ color: 'var(--retro-cream)', fontWeight: 'bold' }}>Level {pet ? pet.level : 1}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-inactive)', display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', fontFamily: '"Press Start 2P"', marginBottom: '2px' }}>Last Claimed Level:</span>
                      <span style={{ color: 'var(--retro-cream)', fontWeight: 'bold' }}>Level {isDemoMode ? "1 (Demo)" : lastClaimedLevel}</span>
                    </div>
                    {pet && pet.level > lastClaimedLevel && !isDemoMode ? (
                      <div style={{ borderTop: '1px dashed #3c1616', paddingTop: '8px', color: 'var(--neon-gold)' }}>
                        <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', fontFamily: '"Press Start 2P"', marginBottom: '2px' }}>Claimable Amount:</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                          {((pet.level - lastClaimedLevel) * 0.005).toFixed(3)} MON
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-inactive)', display: 'block', marginTop: '2px' }}>
                          ({pet.level - lastClaimedLevel} level(s) x 0.005 MON)
                        </span>
                      </div>
                    ) : (
                      <div style={{ borderTop: '1px dashed #3c1616', paddingTop: '8px', color: 'var(--text-inactive)', fontSize: '0.7rem' }}>
                        No rewards claimable. Level up your pet to claim!
                      </div>
                    )}
                  </div>

                  {pet && pet.level > lastClaimedLevel && !isDemoMode ? (
                    <button 
                      onClick={handleClaimReward} 
                      disabled={isClaiming}
                      className="crt-btn active pixel-font" 
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        fontSize: '0.85rem', 
                        background: 'linear-gradient(to bottom, #d97706, #b45309)', 
                        border: '2px solid #f59e0b', 
                        color: 'white', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '8px', 
                        borderRadius: '4px',
                        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                        fontFamily: '"Press Start 2P"',
                        marginBottom: '15px'
                      }}
                    >
                      {isClaiming ? 'CLAIMING...' : '🎁 CLAIM REWARDS'}
                    </button>
                  ) : (
                    <button 
                      className="crt-btn pixel-font" 
                      disabled 
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        fontSize: '0.85rem', 
                        opacity: 0.5, 
                        cursor: 'not-allowed', 
                        borderRadius: '4px',
                        marginBottom: '15px'
                      }}
                    >
                      {isDemoMode ? 'DISABLED IN DEMO' : 'LEVEL UP TO CLAIM'}
                    </button>
                  )}

                  <div style={{ background: '#140707', border: '2px solid #3c1616', padding: '10px', borderRadius: '6px', textAlign: 'left', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)' }}>
                    <div>
                      <span style={{ color: 'var(--text-inactive)', display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', fontFamily: '"Press Start 2P"', marginBottom: '4px' }}>Project Fee Receiver:</span>
                      <span className="glow-gold" style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.85rem' }}>0x76011d0Dc2ca7AdAE7f0C408c872040Bc16437D1</span>
                    </div>
                    <div style={{ borderTop: '1px dashed #3c1616', paddingTop: '8px' }}>
                      <span style={{ color: 'var(--text-inactive)', display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', fontFamily: '"Press Start 2P"', marginBottom: '4px' }}>Reward Payout Address:</span>
                      <span className="glow-amber" style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.85rem' }}>0x76011d0Dc2ca7AdAE7f0C408c872040Bc16437D1</span>
                    </div>
                    <div style={{ borderTop: '1px dashed #3c1616', paddingTop: '8px', color: 'var(--text-inactive)', fontSize: '0.7rem', lineHeight: '1.3' }}>
                      * Để nạp tiền vào quỹ thưởng, Admin gửi MON trực tiếp từ MetaMask tới địa chỉ Hợp đồng:<br/>
                      <span style={{ color: 'var(--neon-gold)', fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.75rem', display: 'block', marginTop: '4px' }}>{contractAddress}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activePanel === 'leaderboard' && (
              <div className="details-panel" style={{ border: 'none', background: 'none', maxHeight: 'none', padding: 0, boxShadow: 'none' }}>
                <div className="panel-title">TOP 10 MONANIMAL LEADERBOARD</div>
                {leaderboard.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-inactive)' }}>LEADERBOARD EMPTY</div>
                ) : (
                  leaderboard.map((entry, index) => {
                    const isUser = userAddress && entry.owner.toLowerCase() === userAddress.toLowerCase();
                    const isDemoUser = isDemoMode && entry.owner === "you (demo)";
                    
                    return (
                      <div 
                        key={index} 
                        className="leaderboard-item"
                        style={{ background: (isUser || isDemoUser) ? 'rgba(245,158,11,0.1)' : 'transparent' }}
                      >
                        <span className="lb-rank">#{index + 1}</span>
                        <div className="lb-info">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img 
                              src="/chog.png" 
                              alt="Chog" 
                              style={{ width: '20px', height: '20px', objectFit: 'contain', imageRendering: 'pixelated' }} 
                            />
                            <span className="lb-name" style={{ color: (isUser || isDemoUser) ? 'var(--neon-gold)' : 'inherit' }}>
                              {entry.petName}
                            </span>
                          </div>
                          <span className="lb-owner">
                            {isDemoUser ? "you (demo)" : `${entry.owner.substring(0, 6)}...${entry.owner.substring(entry.owner.length - 4)}`}
                          </span>
                        </div>
                        <span className="lb-level">LVL {entry.level}</span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
            {activePanel === 'logs' && (
              <div className="details-panel" style={{ border: 'none', background: 'none', maxHeight: 'none', padding: 0, boxShadow: 'none' }}>
                <div className="panel-title">PET ACTIVITY EVENT LOG</div>
                {eventLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-inactive)' }}>NO ACTIONS RECORDED YET</div>
                ) : (
                  eventLogs.map((log, index) => {
                    const time = new Date(log.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={index} className="log-item">
                        <span className="log-time">[{time}]</span>
                        <span>{log.description}</span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="crt-container">
        {/* Left Side Tabs Menu */}
        {(walletConnected || isDemoMode) && pet && (
          <>
            <button 
              className={`side-tab tab-rewards pixel-font ${activePanel === 'rewards' ? 'active' : ''}`}
              onClick={() => setActivePanel(activePanel === 'rewards' ? 'none' : 'rewards')}
            >
              🎁 REWARD
            </button>
            <button 
              className={`side-tab tab-leaderboard pixel-font ${activePanel === 'leaderboard' ? 'active' : ''}`}
              onClick={() => setActivePanel(activePanel === 'leaderboard' ? 'none' : 'leaderboard')}
            >
              🏆 LEADER
            </button>
            <button 
              className={`side-tab tab-logs pixel-font ${activePanel === 'logs' ? 'active' : ''}`}
              onClick={() => setActivePanel(activePanel === 'logs' ? 'none' : 'logs')}
            >
              📜 LOGS
            </button>
          </>
        )}

        {/* Toast Alert */}
      {toast && (
        <div className="retro-toast pixel-font">
          {toast}
        </div>
      )}

      {/* Retro Title Bar */}
      <div className="retro-header">
        <div>
          <h1 className="title-font glow-gold" style={{ margin: 0, fontSize: '0.95rem' }}>
            MONANIMAL PET
          </h1>
          <span className="pixel-font glow-amber" style={{ fontSize: '0.9rem' }}>
            On Monad {isMainnet ? "Mainnet" : "Testnet"}
          </span>
        </div>

        <div className="retro-top-controls">
          <button className="retro-icon-btn" title="Info" onClick={() => setShowInfo(!showInfo)}>I</button>
          {(walletConnected || isDemoMode) && (
            <button className="retro-icon-btn" title="Disconnect/Reset" onClick={handleExit}>X</button>
          )}
        </div>
      </div>

      <div className="crt-screen pixel-font">
        {/* Info panel overlay */}
        {showInfo && (
          <div className="details-panel" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, maxHeight: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #4a1d1d', paddingBottom: '6px', marginBottom: '8px' }}>
              <span className="glow-gold" style={{ fontFamily: 'Press Start 2P', fontSize: '0.55rem' }}>GAME GUIDE</span>
              <span style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => setShowInfo(false)}>✕ Close</span>
            </div>
            <p style={{ margin: '4px 0', fontSize: '1rem' }}>- Every care action is a real EVM transaction costing 0.01 MON.</p>
            <p style={{ margin: '4px 0', fontSize: '1rem' }}>- <b>Feed</b>: hunger +20, +5 XP.</p>
            <p style={{ margin: '4px 0', fontSize: '1rem' }}>- <b>Clean</b>: hygiene +20, +5 XP.</p>
            <p style={{ margin: '4px 0', fontSize: '1rem' }}>- <b>Sleep</b>: energy +30, +3 XP.</p>
            <p style={{ margin: '4px 0', fontSize: '1rem' }}>- <b>Play</b>: energy -10, +10 XP, decreases either hunger or hygiene by -10.</p>
            <p style={{ margin: '4px 0', fontSize: '1rem' }}>- Stats decay slowly in real-time on-chain!</p>
            <p style={{ margin: '4px 0', fontSize: '1rem' }}>- Level up resets XP based on formula <code>level * 100</code>.</p>
            <p style={{ margin: '4px 0', fontSize: '1rem' }}>- Top 10 pets are saved in the on-chain leaderboard.</p>
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
            <Loader2 className="pixel-spinner" size={32} style={{ color: 'var(--neon-gold)' }} />
            <span style={{ marginTop: '12px' }}>FETCHING ON-CHAIN STATS...</span>
          </div>
        )}

        {/* Tx Pending overlay */}
        {isTxPending && !isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', textAlign: 'center' }}>
            <Tv size={36} className="pixel-spinner" style={{ color: 'var(--neon-gold)' }} />
            <span style={{ marginTop: '12px', color: 'var(--neon-gold)', fontFamily: 'Press Start 2P', fontSize: '0.65rem' }}>TRANSACTION PENDING</span>
            <span style={{ fontSize: '0.9rem', marginTop: '8px' }}>Waiting for block confirmation on Monad...</span>
            {txHash && (
              <a 
                href={`${isMainnet ? MONAD_MAINNET_CONFIG.blockExplorerUrls[0] : MONAD_TESTNET_CONFIG.blockExplorerUrls[0]}/tx/${txHash}`} 
                target="_blank" 
                rel="noreferrer"
                style={{ color: 'var(--neon-amber)', textDecoration: 'underline', marginTop: '10px', fontSize: '0.85rem' }}
              >
                View on Explorer
              </a>
            )}
          </div>
        )}

        {/* Landing State: Connect Wallet or Demo Mode */}
        {!walletConnected && !isDemoMode && !isLoading && !isTxPending && (
          <div className="wallet-screen">
            <p style={{ fontSize: '1.2rem', marginBottom: '16px' }}>
              Welcome to <b>Monanimal Pet</b>!<br />
              Take care of your virtual pet fully on-chain. Every care action costs exactly 0.01 MON.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', marginTop: '24px' }}>
              <button className="cyber-connect-btn" onClick={handleConnect}>
                CONNECT WALLET
              </button>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-inactive)', marginTop: '8px' }}>
                <span>Target: Monad {isMainnet ? "Mainnet" : "Testnet"}</span>
                <button 
                  onClick={toggleNetwork} 
                  style={{
                    background: 'var(--retro-panel)',
                    border: '1px solid #582424',
                    color: 'var(--retro-cream)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Switch
                </button>
              </div>

              <span style={{ margin: '8px 0', color: 'var(--text-inactive)' }}>- OR -</span>

              <button 
                onClick={() => setIsDemoMode(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--neon-gold)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: '1.1rem'
                }}
              >
                PLAY DEMO MODE (SIMULATED)
              </button>
            </div>
          </div>
        )}

        {/* Pet Creation State */}
        {(walletConnected || isDemoMode) && !pet && !isLoading && !isTxPending && (
          <div>
            <div style={{ borderBottom: '1px dashed #4a1d1d', paddingBottom: '8px', marginBottom: '12px', textAlign: 'center' }}>
              <span className="glow-gold" style={{ fontFamily: 'Press Start 2P', fontSize: '0.65rem' }}>CREATE YOUR PET</span>
            </div>

            <p style={{ textAlign: 'center', fontSize: '1.1rem', margin: '8px 0' }}>
              Enter your pet name to summon your Chog guardian:
            </p>

            <input 
              type="text" 
              placeholder="ENTER PET NAME..." 
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="pet-name-input"
              maxLength={20}
            />

            <div className="skin-selector" style={{ display: 'flex', justifyContent: 'center' }}>
              {STARTER_SKINS.map((skin) => (
                <div 
                  key={skin.id}
                  className="skin-card selected"
                  style={{ width: '140px', cursor: 'default' }}
                >
                  <div className="skin-icon-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '8px 0', height: '60px' }}>
                    <img 
                      src="/chog.png" 
                      alt={skin.name} 
                      style={{ width: '55px', height: '55px', objectFit: 'contain', imageRendering: 'pixelated' }} 
                    />
                  </div>
                  <div className="skin-name" style={{ color: 'var(--neon-gold)', fontSize: '0.8rem', fontFamily: 'Press Start 2P' }}>
                    {skin.name}
                  </div>
                </div>
              ))}
            </div>

            <p style={{ textAlign: 'center', fontSize: '0.95rem', color: 'var(--text-inactive)', margin: '8px 0 16px 0' }}>
              {STARTER_SKINS[0].desc}
            </p>

            <button className="cyber-connect-btn" style={{ width: '100%' }} onClick={handleCreatePet}>
              SUMMON PET
            </button>
          </div>
        )}

        {/* Main Care Dashboard */}
        {(walletConnected || isDemoMode) && pet && !isLoading && !isTxPending && (
          <div>
            {/* Sub Header Cards Row */}
            <div className="sub-header-row">
              <div className="sub-header-card card-day">
                <span className="card-label">Level</span>
                <span className="card-value glow-gold">{pet.level}</span>
              </div>
              <div className="sub-header-card card-age">
                <span className="card-label">Age</span>
                <span className="card-value" style={{ fontSize: '0.9rem' }}>{petAgeString}</span>
              </div>
              <div className="sub-header-card card-energy-info">
                <span className="card-label">Status Monitor</span>
                <span className="card-value glow-amber" style={{ fontSize: '0.85rem', textTransform: 'uppercase' }}>
                  {isSleepingState ? "Sleeping (+30 En)" : "Decaying Slowly"}
                </span>
              </div>
            </div>

            {/* Pet Screen */}
            <div className="pet-screen-frame">
              <div className="pet-screen-circle" style={{ overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                <img 
                  src="/chog.png" 
                  alt="Chog" 
                  className={`pet-avatar-img ${isPlayingAnim ? 'playing' : ''} ${isSleepingState ? 'sleeping' : ''}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    imageRendering: 'pixelated',
                    filter: isSleepingState ? 'brightness(0.6)' : 'none',
                    animation: isSleepingState ? 'none' : isPlayingAnim ? 'petPlay 0.5s infinite alternate' : 'petFloat 3s infinite ease-in-out'
                  }}
                />
                {isSleepingState && (
                  <div className="sleeping-bubbles" style={{ position: 'absolute', top: '10px', right: '15px', color: 'var(--neon-gold)', fontSize: '0.9rem', fontFamily: 'Press Start 2P', animation: 'floatSleep 2s infinite ease-in-out' }}>
                    zZZ
                  </div>
                )}
              </div>
              <span className="pet-status-text glow-gold">
                {pet.name.toUpperCase()}: {petRepresentation.statusText}
              </span>
            </div>

            {/* Stats countdown header */}
            <div className="status-decay-bar">
              <span className="decay-label">{decayString}</span>
              <span className="decay-label glow-gold" style={{ fontFamily: 'Press Start 2P', fontSize: '0.5rem', marginTop: '5px' }}>
                CURRENT XP Level {pet.level}
              </span>
            </div>

            {/* Progress Bars */}
            <div className="stats-container">
              {/* Hunger */}
              <div className="stat-row">
                <span className="stat-name">Hunger</span>
                <span className="stat-percent">{pet.hunger}%</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${pet.hunger}%` }} />
                </div>
              </div>

              {/* Happiness */}
              <div className="stat-row">
                <span className="stat-name">Happiness</span>
                <span className="stat-percent">{happiness}%</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${happiness}%`, background: 'linear-gradient(90deg, #b45309 0%, #fbbf24 100%)' }} />
                </div>
              </div>

              {/* Energy */}
              <div className="stat-row">
                <span className="stat-name">Energy</span>
                <span className="stat-percent">{pet.energy}%</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${pet.energy}%`, background: 'linear-gradient(90deg, #0f766e, #2dd4bf)' }} />
                </div>
              </div>

              {/* Hygiene */}
              <div className="stat-row">
                <span className="stat-name">Hygiene</span>
                <span className="stat-percent">{pet.hygiene}%</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${pet.hygiene}%`, background: 'linear-gradient(90deg, #1d4ed8, #60a5fa)' }} />
                </div>
              </div>

              {/* XP Bar */}
              <div className="stat-row" style={{ marginTop: '4px' }}>
                <span className="stat-name" style={{ color: 'var(--text-active)' }}>XP Bar</span>
                <span className="stat-percent" style={{ color: 'var(--text-active)' }}>
                  {Number(pet.xp)}/{xpNeeded}
                </span>
                <div className="bar-track" style={{ borderColor: 'var(--text-active)' }}>
                  <div className="bar-fill" style={{ width: `${xpPercent}%`, background: 'linear-gradient(90deg, #84cc16 0%, #a3e635 100%)' }} />
                </div>
              </div>
            </div>

            {/* Action Buttons Grid */}
            <div className="action-grid">
              <button className="retro-btn" onClick={() => handleAction('feed')} disabled={pet.hunger >= 100}>
                FEED
              </button>
              <button className="retro-btn" onClick={() => handleAction('clean')} disabled={pet.hygiene >= 100}>
                CLEAN
              </button>
              <button className="retro-btn" onClick={() => handleAction('play')} disabled={pet.energy < 10}>
                PLAY
              </button>
              <button className="retro-btn" onClick={() => {
                if (isSleepingState) {
                  setIsSleepingState(false);
                  showToast("Woke up pet!");
                } else {
                  handleAction('sleep');
                }
              }}>
                {isSleepingState ? "WAKE" : "SLEEP"}
              </button>
            </div>

            {/* Sidecar Detail Panel handles Event Logs, Leaderboard and Rewards */}
          </div>
        )}
      </div>
    </div>

      {/* Footer Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '0.9rem', color: 'var(--text-inactive)' }} className="pixel-font">
        {walletConnected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className="network-dot active" />
            <span>{userAddress?.substring(0, 6)}...{userAddress?.substring(userAddress?.length - 4)}</span>
          </div>
        ) : isDemoMode ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className="network-dot" style={{ backgroundColor: '#a855f7' }} />
            <span>SIMULATION MODE (FREE)</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className="network-dot error" />
            <span>WALLET DISCONNECTED</span>
          </div>
        )}

        <div>
          <span>v1.0.0</span>
        </div>
      </div>
    </div>
  );
}

export default App;
