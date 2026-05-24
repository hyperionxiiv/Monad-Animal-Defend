export type TowerType = 'chog' | 'molandak';

export interface Tower {
  id: string;
  gridX: number;
  gridY: number;
  x: number; // canvas x (centered)
  y: number; // canvas y (centered)
  type: TowerType;
  level: number;
  damage: number;
  range: number; // in grid cells (e.g. 2 means 2 cells radius)
  cost: number; // gold/MON cost to buy or upgrade
  cooldown: number; // in milliseconds
  lastShotTime: number;
  targetId: string | null;
}

export type EnemyType = 'normal' | 'fast' | 'boss';

export interface Enemy {
  id: string;
  x: number;
  y: number;
  pathIndex: number; // current segment of the path
  health: number;
  maxHealth: number;
  speed: number;
  reward: number; // amount of gold awarded on kill
  size: number; // visual radius
  type: EnemyType;
  isDead: boolean;
  distanceTraveled: number; // to sort enemies by progression (target furthest)
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  targetEnemyId: string;
  targetX: number;
  targetY: number;
  damage: number;
  speed: number;
  type: 'single' | 'splash';
  splashRadius: number; // only applicable for splash type
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  size: number;
  maxLife: number;
  life: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface GameStats {
  gold: number; // In-game gold (referred to as MON in-game currency)
  score: number;
  lives: number; // standard: 20 lives
  wave: number;
  isGameStarted: boolean;
  isGameOver: boolean;
  isWeb3Mode: boolean;
  isTxPending: boolean;
  txHash: string | null;
  walletConnected: boolean;
  userAddress: string | null;
  networkError: boolean;
}

export const TOWER_CONFIGS = {
  chog: {
    name: 'Chog (AOE Splash)',
    type: 'chog' as TowerType,
    cost: 100,
    range: 2.0, // 2 grid units
    damage: 15,
    cooldown: 900, // 0.9s (faster splash)
    description: 'Deals AOE splash damage hitting up to 3 units in a 2-cell radius.',
    color: '#a855f7', // purple
  },
  molandak: {
    name: 'Molandak (Sniper)',
    type: 'molandak' as TowerType,
    cost: 150,
    range: 4.0, // 4 grid units
    damage: 35,
    cooldown: 500, // 0.5s (rapid double-speed shooting)
    description: 'Rapid single-target sniper dealing heavy direct damage.',
    color: '#eab308', // gold/yellow
  }
};
