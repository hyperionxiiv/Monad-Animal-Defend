import type { Tower, Enemy, Projectile, Particle, Point, TowerType, EnemyType } from './types';
import { TOWER_CONFIGS } from './types';

// Preload Game Images
export const chogImage = new Image();
chogImage.src = '/chog.png';

export const molandakImage = new Image();
molandakImage.src = '/molandak.png';

export const bobImage = new Image();
bobImage.src = '/bob.png';

// Grid Dimensions
export const GRID_COLS = 16;
export const GRID_ROWS = 10;
export const CELL_SIZE = 50; // pixels per cell
export const CANVAS_WIDTH = GRID_COLS * CELL_SIZE; // 800px
export const CANVAS_HEIGHT = GRID_ROWS * CELL_SIZE; // 500px

// Path grid coordinates: Winding from Left to Right
// (col, row)
export const GRID_PATH: Point[] = [
  { x: 0, y: 3 },
  { x: 4, y: 3 },
  { x: 4, y: 7 },
  { x: 10, y: 7 },
  { x: 10, y: 2 },
  { x: 15, y: 2 }
];

// Convert Grid Coordinates to Canvas Pixels (Centered in grid cell)
export function getPixelPath(): Point[] {
  return GRID_PATH.map(pt => ({
    x: pt.x * CELL_SIZE + CELL_SIZE / 2,
    y: pt.y * CELL_SIZE + CELL_SIZE / 2
  }));
}

/**
 * Check if a cell is part of the enemy path
 */
export function isCellOnPath(gridX: number, gridY: number): boolean {
  // We check if the cell falls on any line segment of the path
  for (let i = 0; i < GRID_PATH.length - 1; i++) {
    const start = GRID_PATH[i];
    const end = GRID_PATH[i + 1];

    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    if (gridX >= minX && gridX <= maxX && gridY >= minY && gridY <= maxY) {
      return true;
    }
  }
  return false;
}

/**
 * Generate enemies for a specific wave
 */
export function generateWaveEnemies(waveNumber: number): Omit<Enemy, 'id' | 'x' | 'y'>[] {
  // Wave 1: 30 enemies
  // Increase by 5 enemies each wave
  const count = 30 + (waveNumber - 1) * 5;
  const list: Omit<Enemy, 'id' | 'x' | 'y'>[] = [];

  // Health doubles every wave. Wave 1: Normal HP = 50, Fast HP = 30, Boss HP = 250
  const hpMultiplier = Math.pow(2, waveNumber - 1);
  const normalHP = 50 * hpMultiplier;
  const fastHP = 30 * hpMultiplier;
  const bossHP = 250 * hpMultiplier;

  for (let i = 0; i < count; i++) {
    // Every 10th enemy is a Boss (starting from wave 2)
    // Every 3rd enemy is a Fast enemy
    let type: EnemyType = 'normal';
    let health = normalHP;
    // 1 block per second = CELL_SIZE (50px) / 60 frames = 50 / 60
    let speed = 50 / 60; 
    let reward = 10; // each monster drops 10 MON
    let size = 12;

    if (waveNumber > 1 && (i + 1) % 10 === 0) {
      type = 'boss';
      health = bossHP;
      speed = 50 / 60; // 1 block per second
      reward = 10; // also drop 10 MON
      size = 18;
    } else if ((i + 1) % 3 === 0) {
      type = 'fast';
      health = fastHP;
      speed = 50 / 60; // 1 block per second
      reward = 10; // also drop 10 MON
      size = 10;
    }

    list.push({
      pathIndex: 0,
      health,
      maxHealth: health,
      speed,
      reward,
      size,
      type,
      isDead: false,
      distanceTraveled: 0
    });
  }

  return list;
}

/**
 * Spawns particle explosion
 */
export function createExplosion(particles: Particle[], x: number, y: number, color: string, count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1;
    const maxLife = Math.random() * 20 + 15;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1.0,
      color,
      size: Math.random() * 3 + 2,
      maxLife,
      life: maxLife
    });
  }
}

/**
 * Draw the map grid, path, towers, enemies, projectiles, particles
 */
export function drawGame(
  ctx: CanvasRenderingContext2D,
  towers: Tower[],
  enemies: Enemy[],
  projectiles: Projectile[],
  particles: Particle[],
  hoveredCell: Point | null,
  selectedTower: Tower | null,
  placingTowerType: TowerType | null,
  isPlacingInvalid: boolean
) {
  // Clear canvas with dark cyber background
  ctx.fillStyle = '#0b0816';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Draw Grid Lines (subtle purple)
  ctx.strokeStyle = 'rgba(131, 110, 253, 0.04)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= GRID_COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL_SIZE, 0);
    ctx.lineTo(c * CELL_SIZE, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let r = 0; r <= GRID_ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL_SIZE);
    ctx.lineTo(CANVAS_WIDTH, r * CELL_SIZE);
    ctx.stroke();
  }

  // Draw Enemy Path (glowing neon line)
  const pixelPath = getPixelPath();
  ctx.beginPath();
  ctx.moveTo(pixelPath[0].x, pixelPath[0].y);
  for (let i = 1; i < pixelPath.length; i++) {
    ctx.lineTo(pixelPath[i].x, pixelPath[i].y);
  }
  ctx.strokeStyle = 'rgba(95, 69, 255, 0.4)';
  ctx.lineWidth = 20;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.strokeStyle = 'rgba(161, 147, 255, 0.8)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Glow path overlay
  ctx.shadowColor = '#5f45ff';
  ctx.shadowBlur = 15;
  ctx.strokeStyle = '#836efd';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.shadowBlur = 0; // Reset shadow

  // Draw Spawn Portal (Start of path)
  ctx.beginPath();
  ctx.arc(pixelPath[0].x, pixelPath[0].y, 16, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(95, 69, 255, 0.3)';
  ctx.fill();
  ctx.strokeStyle = '#836efd';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Portal inner core
  ctx.beginPath();
  ctx.arc(pixelPath[0].x, pixelPath[0].y, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#a193ff';
  ctx.fill();

  // Draw Monad Base Portal (End of path)
  const endPt = pixelPath[pixelPath.length - 1];
  ctx.shadowColor = '#836efd';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(endPt.x, endPt.y, 22, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(131, 110, 253, 0.2)';
  ctx.fill();
  ctx.strokeStyle = '#836efd';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Draw base inner core (Monad cube symbol styled)
  ctx.fillStyle = '#836efd';
  ctx.fillRect(endPt.x - 8, endPt.y - 8, 16, 16);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(endPt.x - 8, endPt.y - 8, 16, 16);
  ctx.shadowBlur = 0;

  // Draw Placement Hover / Grid Highlighter
  if (hoveredCell) {
    ctx.fillStyle = isCellOnPath(hoveredCell.x, hoveredCell.y)
      ? 'rgba(239, 68, 68, 0.15)' // red for path
      : 'rgba(34, 197, 94, 0.15)'; // green for buildable
    
    if (placingTowerType && isPlacingInvalid) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    }

    ctx.fillRect(hoveredCell.x * CELL_SIZE, hoveredCell.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    ctx.strokeStyle = placingTowerType && isPlacingInvalid ? '#ef4444' : '#836efd';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(hoveredCell.x * CELL_SIZE, hoveredCell.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);

    // Draw range preview when placing
    if (placingTowerType) {
      const config = TOWER_CONFIGS[placingTowerType];
      const cx = hoveredCell.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = hoveredCell.y * CELL_SIZE + CELL_SIZE / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, config.range * CELL_SIZE, 0, Math.PI * 2);
      ctx.strokeStyle = isPlacingInvalid ? 'rgba(239, 68, 68, 0.4)' : 'rgba(131, 110, 253, 0.4)';
      ctx.fillStyle = isPlacingInvalid ? 'rgba(239, 68, 68, 0.03)' : 'rgba(131, 110, 253, 0.03)';
      ctx.fill();
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Draw Selected Tower range ring
  if (selectedTower) {
    ctx.beginPath();
    ctx.arc(selectedTower.x, selectedTower.y, selectedTower.range * CELL_SIZE, 0, Math.PI * 2);
    ctx.strokeStyle = selectedTower.type === 'chog' ? 'rgba(168, 85, 247, 0.5)' : 'rgba(234, 179, 8, 0.5)';
    ctx.fillStyle = selectedTower.type === 'chog' ? 'rgba(168, 85, 247, 0.03)' : 'rgba(234, 179, 8, 0.03)';
    ctx.fill();
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw Towers
  towers.forEach(tower => {
    ctx.save();
    
    // Draw Base Platform
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1b30';
    ctx.fill();
    ctx.strokeStyle = tower.type === 'chog' ? '#a855f7' : '#eab308';
    ctx.lineWidth = selectedTower?.id === tower.id ? 2.5 : 1;
    ctx.stroke();

    // Tower Level Tag
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`L${tower.level}`, tower.x, tower.y + 14);

    // Glow effects for Tower Core
    ctx.shadowBlur = 8;
    ctx.shadowColor = tower.type === 'chog' ? '#a855f7' : '#eab308';

    if (tower.type === 'chog') {
      if (chogImage.complete && chogImage.naturalWidth !== 0) {
        // Draw Chog character image
        ctx.drawImage(chogImage, tower.x - 18, tower.y - 18, 36, 36);
      } else {
        // Fallback: Chog Purple Void Elemental
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.arc(tower.x, tower.y - 5, 8, 0, Math.PI * 2);
        ctx.fill();

        // Outer revolving rings (simulated with lines)
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(tower.x, tower.y - 5, 14, 5, Math.PI / 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(tower.x, tower.y - 5, 14, 5, -Math.PI / 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      if (molandakImage.complete && molandakImage.naturalWidth !== 0) {
        // Draw Molandak character image
        ctx.drawImage(molandakImage, tower.x - 18, tower.y - 18, 36, 36);
      } else {
        // Fallback: Molandak Sniper Turret
        ctx.fillStyle = '#eab308';
        ctx.fillRect(tower.x - 6, tower.y - 12, 12, 12);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(tower.x - 3, tower.y - 15, 6, 4);

        // Gun Barrel (pointing towards target if any)
        let angle = -Math.PI / 2; // Point up by default
        if (tower.targetId) {
          const target = enemies.find(e => e.id === tower.targetId);
          if (target) {
            angle = Math.atan2(target.y - tower.y, target.x - tower.x);
          }
        }
        ctx.translate(tower.x, tower.y - 6);
        ctx.rotate(angle);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, -2, 16, 4);
      }
    }
    
    ctx.restore();
  });

  // Draw Enemies (Square Nodes or BOB Images)
  enemies.forEach(enemy => {
    ctx.save();
    
    // Draw Enemy shadow (Square shadow)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(enemy.x - enemy.size, enemy.y - enemy.size + 4, enemy.size * 2, enemy.size * 2);

    let coreColor = '#ef4444'; // default red
    let strokeColor = '#f87171';
    
    if (enemy.type === 'fast') {
      coreColor = '#3b82f6'; // blue
      strokeColor = '#60a5fa';
    } else if (enemy.type === 'boss') {
      coreColor = '#10b981'; // green boss
      strokeColor = '#34d399';
    }
    
    // Draw Enemy Core (Image or Square fallback)
    if (bobImage.complete && bobImage.naturalWidth !== 0) {
      ctx.drawImage(bobImage, enemy.x - enemy.size, enemy.y - enemy.size, enemy.size * 2, enemy.size * 2);
      
      // Draw border mapping the enemy type
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(enemy.x - enemy.size, enemy.y - enemy.size, enemy.size * 2, enemy.size * 2);
    } else {
      ctx.fillStyle = coreColor;
      ctx.fillRect(enemy.x - enemy.size, enemy.y - enemy.size, enemy.size * 2, enemy.size * 2);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(enemy.x - enemy.size, enemy.y - enemy.size, enemy.size * 2, enemy.size * 2);

      // Draw BOB text inside the square
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(7, enemy.size * 0.75)}px 'Share Tech Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BOB', enemy.x, enemy.y);
    }

    // Enemy glow aura (Inner outline)
    ctx.shadowBlur = 10;
    ctx.shadowColor = coreColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(enemy.x - enemy.size + 2, enemy.y - enemy.size + 2, (enemy.size - 2) * 2, (enemy.size - 2) * 2);
    ctx.shadowBlur = 0; // Reset

    // Health Bar
    const barW = enemy.size * 2;
    const barH = 3;
    const barX = enemy.x - enemy.size;
    const barY = enemy.y - enemy.size - 8;

    // Health Bar Background
    ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.fillRect(barX, barY, barW, barH);
    
    // Health Bar Foreground
    const hpPct = Math.max(0, enemy.health / enemy.maxHealth);
    ctx.fillStyle = '#22c55e'; // Green health
    ctx.fillRect(barX, barY, barW * hpPct, barH);

    ctx.restore();
  });

  // Draw Projectiles
  projectiles.forEach(proj => {
    ctx.save();
    ctx.beginPath();
    
    if (proj.type === 'splash') {
      // Chog bullet: glowing purple orb
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#c084fc';
      ctx.arc(proj.x, proj.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#a855f7';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // Molandak bullet: cyber yellow energy beam
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#fde047';
      ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#eab308';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
    ctx.restore();
  });

  // Draw Particles
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.restore();
  });
}

/**
 * Handle game physics, projectile updates, enemy movements, collision detection
 */
export function updateGameEngine(
  towers: Tower[],
  enemies: Enemy[],
  projectiles: Projectile[],
  particles: Particle[],
  currentTime: number,
  dt: number, // delta time modifier (e.g. 1 for normal speed, 2 for fast-forward)
  onBaseDamage: (damage: number) => void,
  onGainGold: (amount: number) => void,
  onGainScore: (amount: number) => void
): { updatedTowers: Tower[]; updatedEnemies: Enemy[]; updatedProjectiles: Projectile[]; updatedParticles: Particle[] } {
  
  const pixelPath = getPixelPath();

  // 1. Update Particles
  const nextParticles: Particle[] = [];
  particles.forEach(p => {
    const nextLife = p.life - 1 * dt;
    if (nextLife > 0) {
      nextParticles.push({
        ...p,
        x: p.x + p.vx * dt,
        y: p.y + p.vy * dt,
        life: nextLife,
        alpha: nextLife / p.maxLife
      });
    }
  });

  // 2. Update Enemies along path
  const nextEnemies: Enemy[] = [];
  enemies.forEach(enemy => {
    if (enemy.isDead || enemy.health <= 0) return;

    let { x, y, pathIndex, distanceTraveled } = enemy;
    const speed = enemy.speed * dt;

    // Follow path segments
    let moveRemainder = speed;
    let reachedEnd = false;

    while (moveRemainder > 0 && pathIndex < pixelPath.length - 1) {
      const nextPoint = pixelPath[pathIndex + 1];
      const dx = nextPoint.x - x;
      const dy = nextPoint.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (moveRemainder >= dist) {
        // Move fully to next path node
        x = nextPoint.x;
        y = nextPoint.y;
        pathIndex++;
        distanceTraveled += dist;
        moveRemainder -= dist;
      } else {
        // Move partially along segment
        const pct = moveRemainder / dist;
        x += dx * pct;
        y += dy * pct;
        distanceTraveled += moveRemainder;
        moveRemainder = 0;
      }

      if (pathIndex === pixelPath.length - 1) {
        reachedEnd = true;
        break;
      }
    }

    if (reachedEnd) {
      // Enemy reached base! Decrease lives
      const dmg = enemy.type === 'boss' ? 5 : 1;
      onBaseDamage(dmg);
      // Spawn red portal particles
      createExplosion(nextParticles, x, y, '#ef4444', 8);
    } else {
      nextEnemies.push({
        ...enemy,
        x,
        y,
        pathIndex,
        distanceTraveled
      });
    }
  });

  // 3. Update Tower Targets & Shooting
  const nextTowers = towers.map(tower => {
    let targetId = tower.targetId;
    
    // Validate target
    let target = targetId ? nextEnemies.find(e => e.id === targetId) : null;
    
    // Range limit helper
    const isOutOfRange = (t: Tower, e: Enemy) => {
      const dx = e.x - t.x;
      const dy = e.y - t.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist > t.range * CELL_SIZE;
    };

    if (!target || isOutOfRange(tower, target)) {
      // Find new target (closest to the end of the path that is in range)
      let bestTarget: Enemy | null = null;
      let maxDistTraveled = -1;

      nextEnemies.forEach(enemy => {
        const dx = enemy.x - tower.x;
        const dy = enemy.y - tower.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= tower.range * CELL_SIZE) {
          if (enemy.distanceTraveled > maxDistTraveled) {
            maxDistTraveled = enemy.distanceTraveled;
            bestTarget = enemy;
          }
        }
      });

      target = bestTarget;
      targetId = target ? (target as Enemy).id : null;
    }

    // Shoot if cooldown expired
    let lastShotTime = tower.lastShotTime;
    if (target && currentTime - lastShotTime >= tower.cooldown / dt) {
      lastShotTime = currentTime;
      
      // Spawn Projectile
      projectiles.push({
        id: Math.random().toString(36).substring(2, 9),
        x: tower.x,
        y: tower.y - (tower.type === 'chog' ? 5 : 6),
        targetEnemyId: target.id,
        targetX: target.x,
        targetY: target.y,
        damage: tower.damage,
        speed: tower.type === 'chog' ? 5 : 8,
        type: tower.type === 'chog' ? 'splash' : 'single',
        splashRadius: tower.type === 'chog' ? 1.8 * CELL_SIZE : 0, // Splash radius of 1.8 grid cells (approx 90 pixels)
      });
    }

    return {
      ...tower,
      targetId,
      lastShotTime
    };
  });

  // 4. Update Projectiles
  const nextProjectiles: Projectile[] = [];
  projectiles.forEach(proj => {
    // Find target enemy to track them
    const target = nextEnemies.find(e => e.id === proj.targetEnemyId);
    
    // Update target coordinates to enemy's current position, or use last known
    const tx = target ? target.x : proj.targetX;
    const ty = target ? target.y : proj.targetY;
    
    const dx = tx - proj.x;
    const dy = ty - proj.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const moveStep = proj.speed * dt;

    if (moveStep >= dist) {
      // Impact!
      if (proj.type === 'splash') {
        // AOE Splash Damage: hits target and nearby enemies within radius
        const hitColor = '#c084fc';
        createExplosion(nextParticles, tx, ty, hitColor, 20);

        // Circular splash damage rings
        nextParticles.push({
          x: tx,
          y: ty,
          vx: 0,
          vy: 0,
          alpha: 0.6,
          color: 'rgba(168, 85, 247, 0.2)',
          size: proj.splashRadius,
          maxLife: 15,
          life: 15
        });

        // "chog(dame AOE bắn lan 2 trong vòng 2 ô)" -> hits target + up to 2 other enemies in splash range
        // Apply damage to primary target
        if (target) {
          target.health -= proj.damage;
          if (target.health <= 0) {
            target.isDead = true;
            onGainGold(target.reward);
            onGainScore(target.maxHealth);
            createExplosion(nextParticles, target.x, target.y, '#22c55e', 10);
          }
        }

        // Apply damage to up to 2 splash targets
        let splashHitsCount = 0;
        nextEnemies.forEach(enemy => {
          if (enemy.isDead || (target && enemy.id === target.id)) return;
          
          const sDx = enemy.x - tx;
          const sDy = enemy.y - ty;
          const sDist = Math.sqrt(sDx * sDx + sDy * sDy);
          
          if (sDist <= proj.splashRadius && splashHitsCount < 2) {
            enemy.health -= proj.damage; // deal same damage
            splashHitsCount++;
            
            if (enemy.health <= 0) {
              enemy.isDead = true;
              onGainGold(enemy.reward);
              onGainScore(enemy.maxHealth);
              createExplosion(nextParticles, enemy.x, enemy.y, '#22c55e', 10);
            }
          }
        });
      } else {
        // Single Target damage (Molandak)
        createExplosion(nextParticles, tx, ty, '#facc15', 8);
        if (target) {
          target.health -= proj.damage;
          if (target.health <= 0) {
            target.isDead = true;
            onGainGold(target.reward);
            onGainScore(target.maxHealth);
            createExplosion(nextParticles, target.x, target.y, '#22c55e', 10);
          }
        }
      }
    } else {
      // Continue flying towards target
      const pct = moveStep / dist;
      nextProjectiles.push({
        ...proj,
        x: proj.x + dx * pct,
        y: proj.y + dy * pct,
        targetX: tx,
        targetY: ty
      });
    }
  });

  // Filter out dead enemies
  const filteredEnemies = nextEnemies.filter(e => !e.isDead && e.health > 0);

  return {
    updatedTowers: nextTowers,
    updatedEnemies: filteredEnemies,
    updatedProjectiles: nextProjectiles,
    updatedParticles: nextParticles
  };
}
