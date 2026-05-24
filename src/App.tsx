import { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Coins, 
  Play, 
  RotateCcw, 
  ChevronRight, 
  Zap, 
  AlertTriangle, 
  Info,
  TrendingUp,
  Settings,
  Flame,
  Sparkles,
  Link
} from 'lucide-react';
import type { 
  Tower, 
  Enemy, 
  Projectile, 
  Particle, 
  Point, 
  TowerType, 
  GameStats,
} from './game/types';
import { 
  TOWER_CONFIGS, 
  TOWER_CONFIGS as Configs
} from './game/types';
import { 
  drawGame, 
  updateGameEngine, 
  CELL_SIZE, 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  isCellOnPath, 
  generateWaveEnemies,
  createExplosion,
  GRID_COLS,
  GRID_ROWS,
  getPixelPath
} from './game/gameEngine';
import { 
  isMetaMaskInstalled, 
  connectWallet, 
  switchToMonadTestnet, 
  sendStartGameTx, 
  waitForTxReceipt,
  DEFAULT_CONTRACT_ADDRESS,
  getCurrentChainId,
  MONAD_TESTNET_CONFIG
} from './utils/web3';

function App() {
  // Web3 State
  const [walletConnected, setWalletConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [isWeb3Mode, setIsWeb3Mode] = useState(false);
  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT_ADDRESS);
  const [isTxPending, setIsTxPending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [networkError, setNetworkError] = useState(false);

  // Game Stats
  const [stats, setStats] = useState<GameStats>({
    gold: 400, // Starts with 400 gold so they can place a couple of towers
    score: 0,
    lives: 20,
    wave: 0,
    isGameStarted: false,
    isGameOver: false,
    isWeb3Mode: false,
    isTxPending: false,
    txHash: null,
    walletConnected: false,
    userAddress: null,
    networkError: false
  });

  // Game Objects State (Towers remains React state, others are Refs to prevent loop race conditions)
  const [towers, setTowers] = useState<Tower[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  
  // Wave Spawner State
  const enemiesToSpawnRef = useRef<Omit<Enemy, 'id' | 'x' | 'y'>[]>([]);
  const lastSpawnTimeRef = useRef<number>(0);
  const [enemyCount, setEnemyCount] = useState(0);
  
  const [autoStartNextWave, setAutoStartNextWave] = useState(false);
  const [currentWaveLaunched, setCurrentWaveLaunched] = useState(false);

  // Placement & Selection
  const [placingTowerType, setPlacingTowerType] = useState<TowerType | null>(null);
  const [selectedTowerId, setSelectedTowerId] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<Point | null>(null);

  // Loop control
  const [isPaused, setIsPaused] = useState(false);
  const [gameSpeed, setGameSpeed] = useState<1 | 2>(1);

  // Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Latest values for game loop to avoid stale closures
  const gameObjectsRef = useRef({
    towers,
    stats,
    isPaused,
    gameSpeed,
    selectedTowerId,
    currentWaveLaunched,
    autoStartNextWave
  });

  useEffect(() => {
    gameObjectsRef.current = {
      towers,
      stats,
      isPaused,
      gameSpeed,
      selectedTowerId,
      currentWaveLaunched,
      autoStartNextWave
    };
  }, [towers, stats, isPaused, gameSpeed, selectedTowerId, currentWaveLaunched, autoStartNextWave]);

  // Check MetaMask connection status on load
  useEffect(() => {
    async function checkConnection() {
      if (isMetaMaskInstalled()) {
        const ethereum = (window as any).ethereum;
        try {
          const accounts = await ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            setUserAddress(accounts[0]);
            setWalletConnected(true);
            
            // Check chain ID
            const chainId = await getCurrentChainId();
            if (chainId !== MONAD_TESTNET_CONFIG.chainId) {
              setNetworkError(true);
            }
          }
        } catch (e) {
          console.error(e);
        }

        // Listen for accounts change
        ethereum.on('accountsChanged', (accounts: string[]) => {
          if (accounts.length > 0) {
            setUserAddress(accounts[0]);
            setWalletConnected(true);
          } else {
            setUserAddress(null);
            setWalletConnected(false);
            setIsWeb3Mode(false);
          }
        });

        // Listen for chain change
        ethereum.on('chainChanged', (chainId: string) => {
          if (chainId === MONAD_TESTNET_CONFIG.chainId) {
            setNetworkError(false);
          } else {
            setNetworkError(true);
            setIsWeb3Mode(false);
          }
        });
      }
    }
    checkConnection();
  }, []);

  // Web3 Connection triggers
  const handleConnectWallet = async () => {
    try {
      const address = await connectWallet();
      if (address) {
        setUserAddress(address);
        setWalletConnected(true);
        const chainId = await getCurrentChainId();
        if (chainId === MONAD_TESTNET_CONFIG.chainId) {
          setNetworkError(false);
          setIsWeb3Mode(true); // default to Web3 Mode on connection
        } else {
          setNetworkError(true);
          // Try switching
          await handleSwitchNetwork();
        }
      }
    } catch (e: any) {
      alert(e.message || 'Failed to connect wallet');
    }
  };

  const handleSwitchNetwork = async () => {
    const success = await switchToMonadTestnet();
    if (success) {
      setNetworkError(false);
      setIsWeb3Mode(true);
    } else {
      alert('Could not switch to Monad Testnet. Please add it to MetaMask.');
    }
  };

  // Start the Game
  const handleStartGame = async () => {
    const gameId = Math.floor(Math.random() * 1000000);

    if (isWeb3Mode) {
      if (!walletConnected) {
        alert('Please connect your wallet first!');
        return;
      }
      setIsTxPending(true);
      setTxHash(null);

      try {
        const hash = await sendStartGameTx(contractAddress, gameId);
        setTxHash(hash);
        
        // Wait for blockchain confirmation
        const success = await waitForTxReceipt(hash);
        if (!success) {
          throw new Error('Transaction failed on-chain.');
        }
        
        setIsTxPending(false);
        initializeGameSession();
      } catch (error: any) {
        setIsTxPending(false);
        setTxHash(null);
        alert(error.message || 'Transaction rejected or failed. Try Demo Mode if you do not have MON testnet.');
      }
    } else {
      // Demo Mode starts instantly
      initializeGameSession();
    }
  };

  const initializeGameSession = () => {
    setTowers([]);
    
    // Clear refs to prevent state race conditions
    enemiesRef.current = [];
    projectilesRef.current = [];
    particlesRef.current = [];
    enemiesToSpawnRef.current = [];
    lastSpawnTimeRef.current = 0;

    setPlacingTowerType(null);
    setSelectedTowerId(null);
    setIsPaused(false);
    setCurrentWaveLaunched(false);

    setStats({
      gold: 400,
      score: 0,
      lives: 20,
      wave: 1,
      isGameStarted: true,
      isGameOver: false,
      isWeb3Mode,
      isTxPending: false,
      txHash: null,
      walletConnected,
      userAddress,
      networkError
    });
  };

  const launchCurrentWave = () => {
    if (!stats.isGameStarted || stats.isGameOver || currentWaveLaunched) return;
    setCurrentWaveLaunched(true);
    const waveEnemies = generateWaveEnemies(stats.wave);
    enemiesToSpawnRef.current = waveEnemies;
    lastSpawnTimeRef.current = 0; // Trigger instant spawn on first loop iteration!
  };



  // Build a tower
  const handlePlaceTower = (gridX: number, gridY: number) => {
    if (!placingTowerType) return;
    
    const config = TOWER_CONFIGS[placingTowerType];
    if (stats.gold < config.cost) {
      alert('Not enough gold (MON)!');
      return;
    }

    // Check if cell is occupied or on path
    const isOccupied = towers.some(t => t.gridX === gridX && t.gridY === gridY);
    const isOnPath = isCellOnPath(gridX, gridY);

    if (isOccupied || isOnPath) {
      return;
    }

    // Create the Tower
    const newTower: Tower = {
      id: Math.random().toString(36).substring(2, 9),
      gridX,
      gridY,
      x: gridX * CELL_SIZE + CELL_SIZE / 2,
      y: gridY * CELL_SIZE + CELL_SIZE / 2,
      type: placingTowerType,
      level: 1,
      damage: config.damage,
      range: config.range,
      cost: config.cost,
      cooldown: config.cooldown,
      lastShotTime: 0,
      targetId: null
    };

    setTowers(prev => [...prev, newTower]);
    setStats(prev => ({
      ...prev,
      gold: prev.gold - config.cost
    }));
    setPlacingTowerType(null); // Reset placement selection
  };

  // Upgrading Tower logic
  const handleUpgradeSelectedTower = () => {
    if (!selectedTowerId) return;
    const tower = towers.find(t => t.id === selectedTowerId);
    if (!tower) return;

    const upgradeCost = tower.cost * 2; // Next level upgrade cost is double current level cost
    if (stats.gold < upgradeCost) {
      alert('Not enough gold (MON)!');
      return;
    }

    setTowers(prev => prev.map(t => {
      if (t.id === selectedTowerId) {
        return {
          ...t,
          level: t.level + 1,
          damage: t.damage * 2, // Double the damage
          cost: upgradeCost // Set cost to double
        };
      }
      return t;
    }));

    setStats(prev => ({
      ...prev,
      gold: prev.gold - upgradeCost
    }));

    // Trigger visual particles at tower location
    const upgradedTower = towers.find(t => t.id === selectedTowerId);
    if (upgradedTower && canvasRef.current) {
      const effectColor = upgradedTower.type === 'chog' ? '#d8b4fe' : '#fef08a';
      createExplosion(particlesRef.current, upgradedTower.x, upgradedTower.y, effectColor, 25);
    }
  };

  const handleSellSelectedTower = () => {
    if (!selectedTowerId) return;
    const tower = towers.find(t => t.id === selectedTowerId);
    if (!tower) return;

    // Sell refunds 50% of the total cost (accumulated through upgrades)
    const refund = Math.round(tower.cost / 2);
    setTowers(prev => prev.filter(t => t.id !== selectedTowerId));
    setStats(prev => ({
      ...prev,
      gold: prev.gold + refund
    }));
    setSelectedTowerId(null);
  };

  // Game Loop execution
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const state = gameObjectsRef.current;
      if (!state.stats.isGameStarted || state.stats.isGameOver || state.isPaused) {
        lastTime = time;
        animationFrameId = requestAnimationFrame(loop);
        return;
      }

      // Delta Time (scaled for 60 FPS normal speed)
      const elapsed = time - lastTime;
      lastTime = time;
      
      const frameDelta = (elapsed / 16.666) * state.gameSpeed;

      // 1. Spawning Logic
      const now = Date.now();
      const spawnInterval = 1200 / state.gameSpeed; // speed up spawns with speed toggles

      if (enemiesToSpawnRef.current.length > 0 && now - lastSpawnTimeRef.current >= spawnInterval) {
        const spawned = enemiesToSpawnRef.current.shift();
        if (spawned) {
          const pixelPath = getPixelPath();
          const startPt = pixelPath[0];
          
          const newEnemy: Enemy = {
            ...spawned,
            id: Math.random().toString(36).substring(2, 9),
            x: startPt.x,
            y: startPt.y
          };
          
          enemiesRef.current.push(newEnemy);
          lastSpawnTimeRef.current = now; // update ref synchronously to prevent consecutive frame spawns
        }
      }

      // 2. Physics & Engine update
      const { updatedTowers, updatedEnemies, updatedProjectiles, updatedParticles } = updateGameEngine(
        state.towers,
        enemiesRef.current,
        projectilesRef.current,
        particlesRef.current,
        time,
        frameDelta,
        // Base Damage callback
        (dmg) => {
          setStats(prev => {
            const nextLives = Math.max(0, prev.lives - dmg);
            const isOver = nextLives <= 0;
            if (isOver) {
              enemiesRef.current = [];
              projectilesRef.current = [];
              particlesRef.current = [];
              enemiesToSpawnRef.current = [];
            }
            return {
              ...prev,
              lives: nextLives,
              isGameOver: isOver
            };
          });
        },
        // Gold Gain callback
        (amount) => {
          setStats(prev => ({
            ...prev,
            gold: prev.gold + amount
          }));
        },
        // Score Gain callback
        (amount) => {
          setStats(prev => ({
            ...prev,
            score: prev.score + amount
          }));
        }
      );

      // Mutate refs directly with updated states
      enemiesRef.current = updatedEnemies;
      projectilesRef.current = updatedProjectiles;
      particlesRef.current = updatedParticles;

      // Sync enemy count for React UI (only when it changes)
      if (updatedEnemies.length !== enemyCount) {
        setEnemyCount(updatedEnemies.length);
      }

      setTowers(updatedTowers);

      // 3. Wave completion detection inside loop
      if (
        state.currentWaveLaunched &&
        enemiesRef.current.length === 0 &&
        enemiesToSpawnRef.current.length === 0
      ) {
        setCurrentWaveLaunched(false);
        
        if (state.autoStartNextWave) {
          setStats(prev => {
            const nextWave = prev.wave + 1;
            enemiesToSpawnRef.current = generateWaveEnemies(nextWave);
            lastSpawnTimeRef.current = 0; // trigger instantly
            return {
              ...prev,
              wave: nextWave
            };
          });
          setCurrentWaveLaunched(true);
        } else {
          // Manual next wave: increment wave number, but don't launch yet
          setStats(prev => ({
            ...prev,
            wave: prev.wave + 1
          }));
        }
      }

      // 3. Render
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Check placement hover state validity
          let isPlacingInvalid = false;
          if (hoveredCell && placingTowerType) {
            const isOccupied = state.towers.some(t => t.gridX === hoveredCell.x && t.gridY === hoveredCell.y);
            const isOnPath = isCellOnPath(hoveredCell.x, hoveredCell.y);
            isPlacingInvalid = isOccupied || isOnPath;
          }

          const selectedTower = state.selectedTowerId 
            ? updatedTowers.find(t => t.id === state.selectedTowerId) || null 
            : null;

          drawGame(
            ctx,
            updatedTowers,
            updatedEnemies,
            updatedProjectiles,
            updatedParticles,
            hoveredCell,
            selectedTower,
            placingTowerType,
            isPlacingInvalid
          );
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    if (stats.isGameStarted && !stats.isGameOver) {
      animationFrameId = requestAnimationFrame(loop);
    } else {
      // Just draw background / grid when game is off
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawGame(ctx, [], [], [], [], null, null, null, false);
        }
      }
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [stats.isGameStarted, stats.isGameOver, placingTowerType, hoveredCell]);

  // Click on Canvas handlers
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!stats.isGameStarted || stats.isGameOver) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const gridX = Math.floor(clickX / CELL_SIZE);
    const gridY = Math.floor(clickY / CELL_SIZE);

    if (placingTowerType) {
      // Placing mode
      handlePlaceTower(gridX, gridY);
    } else {
      // Selection mode: check if click fell on a tower
      const clickedTower = towers.find(t => t.gridX === gridX && t.gridY === gridY);
      if (clickedTower) {
        setSelectedTowerId(clickedTower.id);
      } else {
        setSelectedTowerId(null);
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!stats.isGameStarted || stats.isGameOver) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const gridX = Math.floor(mouseX / CELL_SIZE);
    const gridY = Math.floor(mouseY / CELL_SIZE);

    if (gridX >= 0 && gridX < GRID_COLS && gridY >= 0 && gridY < GRID_ROWS) {
      setHoveredCell({ x: gridX, y: gridY });
    } else {
      setHoveredCell(null);
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoveredCell(null);
  };

  // Find currently selected tower object
  const selectedTowerObj = selectedTowerId 
    ? towers.find(t => t.id === selectedTowerId) 
    : null;


  return (
    <div className="app-container">
      {/* HEADER SECTION */}
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: 'var(--monad-purple)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1.2rem',
            color: '#fff',
            boxShadow: '0 0 10px var(--monad-purple-glow)'
          }}>M</div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.05em' }} className="glow-text-purple">
              MONAD DEFENSE
            </h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Rise of Chog & Molandak</span>
          </div>
        </div>

        {/* Web3 Wallet and settings controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="mode-toggle-container">
            <button 
              className={`mode-toggle-btn ${!isWeb3Mode ? 'active' : ''}`}
              onClick={() => setIsWeb3Mode(false)}
            >
              Demo Play
            </button>
            <button 
              className={`mode-toggle-btn ${isWeb3Mode ? 'active' : ''}`}
              onClick={handleConnectWallet}
            >
              Web3 Mode
            </button>
          </div>

          {walletConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {networkError ? (
                <button 
                  onClick={handleSwitchNetwork}
                  className="cyber-button"
                  style={{ background: 'var(--neon-red)', padding: '6px 12px', fontSize: '0.75rem' }}
                >
                  <AlertTriangle size={14} /> Switch Network
                </button>
              ) : (
                <div style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  color: '#22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
                  {userAddress?.substring(0, 6)}...{userAddress?.substring(userAddress.length - 4)}
                </div>
              )}
            </div>
          ) : (
            isWeb3Mode && (
              <button onClick={handleConnectWallet} className="cyber-button" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                Connect Wallet
              </button>
            )
          )}

          <button 
            onClick={() => setShowSettings(!showSettings)} 
            className="cyber-button-outline"
            style={{ padding: '8px' }}
            title="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* SETTINGS OVERLAY PANEL */}
      {showSettings && (
        <div style={{
          position: 'absolute',
          top: '80px',
          right: '24px',
          width: '320px',
          zIndex: 50,
          padding: '20px',
        }} className="glass-panel pulsing-border">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--monad-purple)' }}>Smart Contract Settings</h3>
            <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Monad Testnet RPC:
            </label>
            <div style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px', overflowX: 'auto' }}>
              {MONAD_TESTNET_CONFIG.rpcUrls[0]}
            </div>
            
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Contract Address ($MON game registry):
            </label>
            <input 
              type="text" 
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              style={{
                background: 'var(--bg-darker)',
                border: '1px solid rgba(131, 110, 253, 0.4)',
                borderRadius: '6px',
                padding: '8px',
                color: '#fff',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Modify this to point to your custom contract deployed on Monad testnet.
            </span>
          </div>
        </div>
      )}

      {/* MAIN SCREEN AREA */}
      <main className="game-main">
        {/* LEFT COLUMN: CANVAS + BOTTOM CONTROLS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* STATS OVERVIEW BAR */}
          <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 24px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Coins size={18} className="glow-text-yellow" style={{ color: 'var(--neon-yellow)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>In-Game Gold</span>
                <span className="mono-font" style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--neon-yellow)' }}>{stats.gold} MON</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} style={{ color: 'var(--neon-red)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Lives</span>
                <span className="mono-font" style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--neon-red)' }}>{stats.lives} / 20</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flame size={18} style={{ color: 'var(--monad-purple)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Current Wave</span>
                <span className="mono-font" style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--monad-purple)' }}>{stats.wave || '--'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} style={{ color: 'var(--neon-green)' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Score</span>
                <span className="mono-font" style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--neon-green)' }}>{stats.score}</span>
              </div>
            </div>
          </div>

          {/* GAME WINDOW */}
          <div className="canvas-container pulsing-border">
            <canvas 
              ref={canvasRef} 
              width={CANVAS_WIDTH} 
              height={CANVAS_HEIGHT} 
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
              style={{ display: 'block', cursor: placingTowerType ? 'crosshair' : 'default' }}
            />
            
            {/* Grid grid lines aesthetics */}
            <div className="grid-overlay" />
            <div className="scanline-effect" />

            {/* PRE-GAME OVERLAY */}
            {!stats.isGameStarted && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(6, 4, 10, 0.85)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '40px',
                textAlign: 'center',
                zIndex: 20
              }}>
                <Sparkles size={48} className="floating" style={{ color: 'var(--monad-purple)', marginBottom: '16px' }} />
                <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 10px 0', letterSpacing: '0.05em' }}>
                  MONAD TOWER DEFENSE
                </h2>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '460px', margin: '0 0 24px 0', fontSize: '0.95rem', lineHeight: 1.5 }}>
                  Defend the Monad blockchain from malicious nodes! In Web3 mode, a fee of <strong style={{ color: '#fff' }}>0.01 MON Testnet</strong> is required to initialize the game.
                </p>

                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', width: '100%' }}>
                  {!isWeb3Mode ? (
                    <button 
                      onClick={handleStartGame} 
                      className="cyber-button"
                      style={{ fontSize: '1rem', padding: '12px 28px' }}
                    >
                      <Play size={18} fill="#fff" /> Play Demo Free
                    </button>
                  ) : (
                    <button 
                      onClick={handleStartGame} 
                      className="cyber-button"
                      disabled={isTxPending || networkError}
                      style={{ fontSize: '1rem', padding: '12px 28px' }}
                    >
                      {isTxPending ? 'Awaiting Confirm...' : (
                        <>
                          <Play size={18} fill="#fff" /> Pay 0.01 $MON & Play
                        </>
                      )}
                    </button>
                  )}
                </div>

                {isWeb3Mode && networkError && (
                  <div style={{ color: 'var(--neon-red)', fontSize: '0.85rem', marginTop: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} /> Please switch wallet network to Monad Testnet to play Web3.
                  </div>
                )}
              </div>
            )}

            {/* BLOCKCHAIN LOADING OVERLAY */}
            {isTxPending && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(6, 4, 10, 0.9)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 30
              }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  border: '3px solid rgba(131, 110, 253, 0.1)',
                  borderTop: '3px solid var(--monad-purple)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '20px'
                }} className="spinner-animation" />
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem' }}>Confirming On-Chain Game Start</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '360px', textAlign: 'center', margin: '0 0 14px 0' }}>
                  Please approve the transaction in MetaMask/Rabby. Sending 0.01 MON on Monad Testnet...
                </p>
                {txHash && (
                  <a 
                    href={`${MONAD_TESTNET_CONFIG.blockExplorerUrls[0]}/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: 'var(--monad-purple)',
                      fontSize: '0.8rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      textDecoration: 'none'
                    }}
                    className="hover:underline"
                  >
                    View Tx on Explorer <Link size={12} />
                  </a>
                )}
              </div>
            )}

            {/* GAME OVER OVERLAY */}
            {stats.isGameOver && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(239, 68, 68, 0.15)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 20
              }}>
                <h2 style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--neon-red)', margin: '0 0 8px 0', letterSpacing: '0.1em' }} className="glow-text-red">
                  BASE BREACHED
                </h2>
                <p style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '24px' }}>
                  You held off nodes until <strong style={{ color: 'var(--monad-purple)' }}>Wave {stats.wave}</strong> with a score of <strong style={{ color: 'var(--neon-green)' }}>{stats.score}</strong>!
                </p>
                <button 
                  onClick={handleStartGame} 
                  className="cyber-button"
                  style={{ padding: '12px 28px', fontSize: '1rem' }}
                >
                  <RotateCcw size={16} /> Deploy Again
                </button>
              </div>
            )}
          </div>

          {/* LOWER CONTROLS & TIMING BAR */}
          <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                onClick={() => setIsPaused(!isPaused)} 
                className="cyber-button-outline"
                style={{ minWidth: '80px' }}
                disabled={!stats.isGameStarted || stats.isGameOver}
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              
              <div style={{ display: 'flex', background: 'var(--bg-panel-light)', borderRadius: '6px', padding: '2px' }}>
                <button 
                  onClick={() => setGameSpeed(1)} 
                  className={`mode-toggle-btn ${gameSpeed === 1 ? 'active' : ''}`}
                  style={{ padding: '6px 12px', borderRadius: '4px' }}
                  disabled={!stats.isGameStarted || stats.isGameOver}
                >
                  1x Speed
                </button>
                <button 
                  onClick={() => setGameSpeed(2)} 
                  className={`mode-toggle-btn ${gameSpeed === 2 ? 'active' : ''}`}
                  style={{ padding: '6px 12px', borderRadius: '4px' }}
                  disabled={!stats.isGameStarted || stats.isGameOver}
                >
                  2x Speed
                </button>
              </div>
            </div>

            {/* Next Wave triggers */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {stats.isGameStarted && !stats.isGameOver && (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <input 
                      type="checkbox" 
                      checked={autoStartNextWave} 
                      onChange={(e) => setAutoStartNextWave(e.target.checked)}
                      style={{
                        accentColor: 'var(--monad-purple)',
                        width: '15px',
                        height: '15px',
                        cursor: 'pointer'
                      }}
                    />
                    Auto-start waves
                  </label>

                  <button 
                    onClick={launchCurrentWave}
                    className="cyber-button"
                    disabled={currentWaveLaunched}
                    style={{
                      background: currentWaveLaunched 
                        ? 'var(--bg-panel-light)' 
                        : 'linear-gradient(135deg, var(--monad-purple-deep) 0%, var(--monad-purple) 100%)',
                      boxShadow: currentWaveLaunched ? 'none' : '0 0 15px var(--monad-purple-glow)',
                      minWidth: '160px'
                    }}
                  >
                    {currentWaveLaunched ? (
                      <span style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                        Defending... ({enemyCount} left)
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, justifyContent: 'center' }}>
                        START WAVE {stats.wave} <ChevronRight size={18} />
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SHOP + SELECTED TOWER UPGRADE INTERFACE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* TOWER SHOP */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1.1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
              Tower Assembly
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* CHOG CARD */}
              <div 
                className={`tower-card chog-border ${placingTowerType === 'chog' ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedTowerId(null);
                  setPlacingTowerType(placingTowerType === 'chog' ? null : 'chog');
                }}
              >
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <img src="/chog.png" style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(168,85,247,0.3)', objectFit: 'cover' }} alt="Chog" />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Chog
                      </strong>
                      <span className="mono-font" style={{ color: 'var(--neon-yellow)', fontWeight: 'bold' }}>
                        100 MON
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {Configs.chog.description}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', paddingLeft: '42px' }}>
                  <span>Dmg: {Configs.chog.damage}</span>
                  <span>Range: {Configs.chog.range}</span>
                  <span>CD: {Configs.chog.cooldown}ms</span>
                </div>
              </div>

              {/* MOLANDAK CARD */}
              <div 
                className={`tower-card molandak-border ${placingTowerType === 'molandak' ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedTowerId(null);
                  setPlacingTowerType(placingTowerType === 'molandak' ? null : 'molandak');
                }}
              >
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <img src="/molandak.png" style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(234,179,8,0.3)', objectFit: 'cover' }} alt="Molandak" />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: 'var(--neon-yellow)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Molandak
                      </strong>
                      <span className="mono-font" style={{ color: 'var(--neon-yellow)', fontWeight: 'bold' }}>
                        150 MON
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {Configs.molandak.description}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', paddingLeft: '42px' }}>
                  <span>Dmg: {Configs.molandak.damage}</span>
                  <span>Range: {Configs.molandak.range}</span>
                  <span>CD: {Configs.molandak.cooldown}ms</span>
                </div>
              </div>
            </div>

            {placingTowerType && (
              <div style={{
                marginTop: '14px',
                padding: '10px',
                background: 'rgba(131, 110, 253, 0.1)',
                border: '1px solid rgba(131, 110, 253, 0.3)',
                borderRadius: '6px',
                fontSize: '0.8rem',
                color: 'var(--monad-purple)'
              }}>
                Click on any open dark grid cell on the map to construct the tower.
              </div>
            )}
          </div>

          {/* UPGRADE / SELL SELECTED TOWER CONTROL PANEL */}
          <div className="glass-panel" style={{ padding: '20px', minHeight: '220px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1.1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
              Turret Controller
            </h3>

            {selectedTowerObj ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <img 
                    src={selectedTowerObj.type === 'chog' ? '/chog.png' : '/molandak.png'} 
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '6px',
                      background: 'rgba(255,255,255,0.05)',
                      border: `1px solid ${selectedTowerObj.type === 'chog' ? '#a855f7' : '#eab308'}`,
                      objectFit: 'cover'
                    }}
                    alt={selectedTowerObj.type}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{
                        color: selectedTowerObj.type === 'chog' ? '#c084fc' : '#eab308',
                        fontSize: '1.05rem'
                      }}>
                        {selectedTowerObj.type === 'chog' ? 'Chog Splash' : 'Molandak Sniper'}
                      </strong>
                      <span style={{
                        background: 'var(--bg-panel-light)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold'
                      }}>
                        Level {selectedTowerObj.level}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="stats-grid">
                  <div className="stat-item">
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>DAMAGE</span>
                    <div className="mono-font" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                      {selectedTowerObj.damage}
                      <span style={{ color: 'var(--neon-green)', fontSize: '0.75rem', marginLeft: '4px' }}>
                        (+{selectedTowerObj.damage})
                      </span>
                    </div>
                  </div>
                  
                  <div className="stat-item">
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>RANGE</span>
                    <div className="mono-font" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                      {selectedTowerObj.range} cells
                    </div>
                  </div>
                </div>

                {/* BOTTOM ACTION BUTTONS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
                  <button 
                    onClick={handleUpgradeSelectedTower}
                    className="cyber-button cyber-button-yellow"
                    disabled={stats.gold < (selectedTowerObj.cost * 2)}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    <Zap size={14} fill="#06040a" /> Upgrade: {selectedTowerObj.cost * 2} MON
                  </button>

                  <button 
                    onClick={handleSellSelectedTower}
                    className="cyber-button-outline"
                    style={{ width: '100%', borderColor: 'rgba(239, 68, 68, 0.4)', color: 'var(--neon-red)' }}
                  >
                    Deconstruct (Refund: {Math.round(selectedTowerObj.cost / 2)} MON)
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'var(--text-muted)',
                textAlign: 'center',
                fontSize: '0.85rem'
              }}>
                <Info size={24} style={{ marginBottom: '10px', color: 'var(--text-muted)' }} />
                Select a placed tower on the grid to perform level upgrades or reclaim parts.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer style={{
        marginTop: 'auto',
        background: 'var(--bg-darker)',
        padding: '20px 24px',
        textAlign: 'center',
        borderTop: '1px solid rgba(131, 110, 253, 0.05)',
        fontSize: '0.8rem',
        color: 'var(--text-muted)'
      }}>
        Monad Defense — Built using Vibecoding on Monad Testnet. Starting a game requires spending $MON testnet.
      </footer>
    </div>
  );
}

export default App;
