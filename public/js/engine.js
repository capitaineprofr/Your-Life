// --- Moteur de Rendu Isométrique 2.5D, Mobilier Dynamique & Navigation ---

import { renderFurniture, FURNITURE_CATALOG } from './furniture.js';

export class IsometricEngine {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;

    // Décor de la pièce vide (Permet la customisation totale sans meubles incrustés)
    this.decorImage = new Image();
    this.decorImage.src = 'assets/decor_empty_room.jpg';
    this.isDecorLoaded = false;
    this.decorImage.onload = () => {
      this.isDecorLoaded = true;
    };

    // Dimensions virtuelles de l'image de référence
    this.V_WIDTH = 1200;
    this.V_HEIGHT = 896;

    // Constantes de projection Isométrique
    this.ORIGIN_X = 600;
    this.ORIGIN_Y = 390;
    this.TILE_U_X = -29.4; // Vecteur U (gx : Sud-Ouest)
    this.TILE_U_Y = 14.4;
    this.TILE_V_X = 29.4;  // Vecteur V (gy : Sud-Est)
    this.TILE_V_Y = 14.4;

    this.GRID_SIZE = 16;

    // Grille de collision dynamique (16x16)
    this.collisionGrid = Array.from({ length: 16 }, () => Array(16).fill(0));

    // Mode d'affichage de la carte : 'architectural' (Style Les Sims / CAO) ou 'photo'
    this.viewMode = 'architectural';

    // Liste du mobilier placé
    this.furniture = [];
    this.selectedFurniture = null;
    this.placingItemType = null; // En cours de pose
    this.placingRotation = 0;   // 0, 90, 180, 270

    // Joueurs dans la pièce
    this.players = new Map();
    this.localPlayerId = null;
    this.isOwner = false;

    // Chemins de déplacement
    this.playerPaths = new Map();

    // Effets visuels
    this.clickTarget = null;
    this.hoverGrid = { gx: 0, gy: 0 };

    // Zoom & Pan (Molette et Recentrage)
    this.userZoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.lastMousePos = { x: 0, y: 0 };

    // Initialisation
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Événements Souris & Zoom
    this.bindMouseEvents();

    // Boucle de rendu
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.renderLoop(t));
  }

  // Reconstruction de la grille de collision en fonction des meubles
  rebuildCollisionGrid() {
    // 1. Réinitialiser la pièce vide : tout le sol intérieur est marchable
    for (let x = 0; x < this.GRID_SIZE; x++) {
      for (let y = 0; y < this.GRID_SIZE; y++) {
        // Murs extérieurs et limites
        if (x < 2 || y < 2 || x > 14 || y > 14) {
          this.collisionGrid[x][y] = 0; // Mur
        } else {
          this.collisionGrid[x][y] = 1; // Sol libre
        }
      }
    }

    // 2. Appliquer les collisions du mobilier placé (en tenant compte de la rotation)
    for (const item of this.furniture) {
      if (item.isWalkable) continue; // Les tapis ne bloquent pas

      const rot = item.rotation || 0;
      const isSwapped = (rot === 90 || rot === 270);
      const sx = isSwapped ? (item.sizeY || 1) : (item.sizeX || 1);
      const sy = isSwapped ? (item.sizeX || 1) : (item.sizeY || 1);

      // Bloquer strictement toutes les cases couvertes par la hitbox du meuble
      for (let dx = 0; dx < sx; dx++) {
        for (let dy = 0; dy < sy; dy++) {
          const fx = item.gx + dx;
          const fy = item.gy + dy;
          if (fx >= 0 && fx < this.GRID_SIZE && fy >= 0 && fy < this.GRID_SIZE) {
            this.collisionGrid[fx][fy] = 0; // Obstacle infranchissable
          }
        }
      }
    }
  }

  setFurniture(furnitureList) {
    this.furniture = furnitureList || [];
    this.rebuildCollisionGrid();
  }

  setIsOwner(isOwner) {
    this.isOwner = isOwner;
  }


  toggleViewMode() {
    this.viewMode = this.viewMode === 'architectural' ? 'photo' : 'architectural';
    return this.viewMode;
  }

  rotatePlacingItem() {
    this.placingRotation = ((this.placingRotation || 0) + 90) % 360;
  }

  rotateSelectedFurniture() {
    if (!this.selectedFurniture) return;
    this.selectedFurniture.rotation = ((this.selectedFurniture.rotation || 0) + 90) % 360;
    this.rebuildCollisionGrid();
    if (this.callbacks.onRotateFurniture) {
      this.callbacks.onRotateFurniture(this.selectedFurniture.id);
    }
  }

  setPlacingItem(itemType) {
    this.placingItemType = itemType;
    this.selectedFurniture = null;
  }

  cancelPlacing() {
    this.placingItemType = null;
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    const scaleX = this.canvas.width / this.V_WIDTH;
    const scaleY = this.canvas.height / this.V_HEIGHT;
    this.scale = Math.min(scaleX, scaleY) * 1.05;

    this.offsetX = (this.canvas.width - this.V_WIDTH * this.scale * this.userZoom) / 2 + this.panX;
    this.offsetY = (this.canvas.height - this.V_HEIGHT * this.scale * this.userZoom) / 2 + this.panY;
  }

  recenter() {
    this.userZoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.resize();
  }

  bindMouseEvents() {
    // Zoom avec la molette
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(2.5, Math.max(0.65, this.userZoom * zoomFactor));

      // Ajuster pour zoomer vers le curseur
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      this.panX -= (mouseX - this.offsetX) * (newZoom / this.userZoom - 1);
      this.panY -= (mouseY - this.offsetY) * (newZoom / this.userZoom - 1);
      this.userZoom = newZoom;
      this.resize();
    }, { passive: false });

    // Pan avec clic droit ou bouton du milieu
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || e.button === 2) {
        this.isPanning = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        const dx = e.clientX - this.lastMousePos.x;
        const dy = e.clientY - this.lastMousePos.y;
        this.panX += dx;
        this.panY += dy;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        this.resize();
      } else {
        // Suivi de la case sous la souris
        const rect = this.canvas.getBoundingClientRect();
        const { vx, vy } = this.windowToVirtual(e.clientX - rect.left, e.clientY - rect.top);
        const { gx, gy } = this.screenToGrid(vx, vy);
        this.hoverGrid = { gx: Math.round(gx), gy: Math.round(gy) };
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 1 || e.button === 2) {
        this.isPanning = false;
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Clic gauche (Déplacement ou Pose de meuble)
    this.canvas.addEventListener('click', (e) => {
      if (e.button !== 0) return;
      this.handleClick(e);
    });

    // Raccourci Clavier 'R' pour pivoter le meuble (comme dans Les Sims)
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'r' || e.key === 'R') {
        if (this.placingItemType) {
          this.rotatePlacingItem();
        } else if (this.selectedFurniture) {
          this.rotateSelectedFurniture();
        }
      }
    });
  }

  // Transformations géométriques
  gridToScreen(gx, gy) {
    const x = this.ORIGIN_X + (gx * this.TILE_U_X) + (gy * this.TILE_V_X);
    const y = this.ORIGIN_Y + (gx * this.TILE_U_Y) + (gy * this.TILE_V_Y);
    return { x, y };
  }

  screenToGrid(x, y) {
    const dx = x - this.ORIGIN_X;
    const dy = y - this.ORIGIN_Y;
    const gy = ((dy / this.TILE_V_Y) + (dx / this.TILE_V_X)) / 2;
    const gx = ((dy / this.TILE_U_Y) - (dx / this.TILE_V_X)) / 2;
    return { gx, gy };
  }

  windowToVirtual(wx, wy) {
    const totalScale = this.scale * this.userZoom;
    const vx = (wx - this.offsetX) / totalScale;
    const vy = (wy - this.offsetY) / totalScale;
    return { vx, vy };
  }

  virtualToWindow(vx, vy) {
    const totalScale = this.scale * this.userZoom;
    const wx = this.offsetX + (vx * totalScale);
    const wy = this.offsetY + (vy * totalScale);
    return { wx, wy };
  }

  handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const { vx, vy } = this.windowToVirtual(e.clientX - rect.left, e.clientY - rect.top);
    const { gx, gy } = this.screenToGrid(vx, vy);

    const targetGx = Math.round(gx);
    const targetGy = Math.round(gy);

    if (targetGx < 0 || targetGx >= this.GRID_SIZE || targetGy < 0 || targetGy >= this.GRID_SIZE) {
      return;
    }

    // 1. Si en mode Pose de Meuble (Propriétaire)
    if (this.placingItemType && this.isOwner) {
      const def = FURNITURE_CATALOG[this.placingItemType];
      if (def) {
        if (this.callbacks.onPlaceFurniture) {
          this.callbacks.onPlaceFurniture({
            type: def.id,
            gx: targetGx,
            gy: targetGy,
            sizeX: def.sizeX,
            sizeY: def.sizeY,
            rotation: this.placingRotation || 0,
            interactive: def.interactive,
            isWalkable: def.isWalkable
          });
        }
        this.placingItemType = null;
        this.placingRotation = 0;
      }
      return;
    }

    // 2. Vérifier si un meuble existant a été cliqué
    const clickedFurniture = this.furniture.find(f => {
      const sx = f.sizeX || 1;
      const sy = f.sizeY || 1;
      return targetGx >= f.gx && targetGx < f.gx + sx && targetGy >= f.gy && targetGy < f.gy + sy;
    });

    if (clickedFurniture) {
      if (this.isOwner && this.callbacks.onSelectFurniture) {
        this.selectedFurniture = clickedFurniture;
        this.callbacks.onSelectFurniture(clickedFurniture);
      }

      // Interaction avec le meuble (S'asseoir, Dormir, Travailler, Boire)
      if (clickedFurniture.interactive && this.callbacks.onFurnitureInteract) {
        this.callbacks.onFurnitureInteract(clickedFurniture);
      }
    } else {
      this.selectedFurniture = null;
      if (this.callbacks.onDeselectFurniture) {
        this.callbacks.onDeselectFurniture();
      }
    }

    // 3. Déplacement du joueur
    let finalGx = targetGx;
    let finalGy = targetGy;

    if (this.collisionGrid[targetGx][targetGy] === 0) {
      const nearest = this.findNearestWalkable(targetGx, targetGy);
      if (nearest) {
        finalGx = nearest.gx;
        finalGy = nearest.gy;
      } else {
        return;
      }
    }

    const targetScreen = this.gridToScreen(finalGx, finalGy);
    const windowCoord = this.virtualToWindow(targetScreen.x, targetScreen.y);

    this.clickTarget = {
      gx: finalGx,
      gy: finalGy,
      screenX: targetScreen.x,
      screenY: targetScreen.y,
      time: performance.now()
    };

    if (this.callbacks.onFloorClick) {
      this.callbacks.onFloorClick({
        gx: finalGx,
        gy: finalGy,
        windowX: windowCoord.wx,
        windowY: windowCoord.wy
      });
    }

    if (this.localPlayerId && this.players.has(this.localPlayerId)) {
      this.movePlayerTo(this.localPlayerId, finalGx, finalGy);
    }
  }

  findNearestWalkable(gx, gy) {
    const deltas = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }
    ];
    for (const d of deltas) {
      const nx = gx + d.dx;
      const ny = gy + d.dy;
      if (nx >= 0 && nx < this.GRID_SIZE && ny >= 0 && ny < this.GRID_SIZE) {
        if (this.collisionGrid[nx][ny] !== 0) {
          return { gx: nx, gy: ny };
        }
      }
    }
    return null;
  }

  findPath(startGx, startGy, endGx, endGy) {
    const startX = Math.round(startGx);
    const startY = Math.round(startGy);
    const targetX = Math.round(endGx);
    const targetY = Math.round(endGy);

    if (startX === targetX && startY === targetY) {
      return [{ gx: endGx, gy: endGy }];
    }

    const openSet = [{ x: startX, y: startY, g: 0, h: 0, f: 0, parent: null }];
    const closedSet = new Set();
    const getKey = (x, y) => `${x},${y}`;

    while (openSet.length > 0) {
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift();

      if (current.x === targetX && current.y === targetY) {
        const path = [];
        let curr = current;
        while (curr.parent) {
          path.unshift({ gx: curr.x, gy: curr.y });
          curr = curr.parent;
        }
        return path;
      }

      closedSet.add(getKey(current.x, current.y));

      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 }
      ];

      for (const nb of neighbors) {
        if (nb.x < 0 || nb.x >= this.GRID_SIZE || nb.y < 0 || nb.y >= this.GRID_SIZE) continue;
        // Collision stricte : aucun obstacle n'est traversable, même la case de destination
        if (this.collisionGrid[nb.x][nb.y] === 0) continue;
        if (closedSet.has(getKey(nb.x, nb.y))) continue;

        const gScore = current.g + 1;
        const hScore = Math.abs(nb.x - targetX) + Math.abs(nb.y - targetY);
        const fScore = gScore + hScore;

        const existing = openSet.find(o => o.x === nb.x && o.y === nb.y);
        if (!existing) {
          openSet.push({ x: nb.x, y: nb.y, g: gScore, h: hScore, f: fScore, parent: current });
        } else if (gScore < existing.g) {
          existing.g = gScore;
          existing.f = fScore;
          existing.parent = current;
        }
      }
    }

    // Aucun chemin sans obstacle trouvé : NE PAS traverser les meubles !
    return [];
  }

  movePlayerTo(playerId, targetGx, targetGy) {
    const player = this.players.get(playerId);
    if (!player) return;

    const path = this.findPath(player.gx, player.gy, targetGx, targetGy);
    this.playerPaths.set(playerId, path);
    player.isMoving = true;
    player.isSitting = false;
  }

  setLocalPlayerId(id) {
    this.localPlayerId = id;
  }

  setPlayers(playersList) {
    this.players.clear();
    for (const p of playersList) {
      this.players.set(p.id, {
        ...p,
        animFrame: 0,
        chatMessage: null,
        chatTimer: 0
      });
    }
  }

  addOrUpdatePlayer(playerData) {
    const existing = this.players.get(playerData.id);
    if (existing) {
      Object.assign(existing, playerData);
    } else {
      this.players.set(playerData.id, {
        ...playerData,
        animFrame: 0,
        chatMessage: null,
        chatTimer: 0
      });
    }
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    this.playerPaths.delete(playerId);
  }

  setPlayerChat(playerId, text) {
    const player = this.players.get(playerId);
    if (player) {
      player.chatMessage = text;
      player.chatTimer = performance.now() + 6000;
    }
  }

  setPlayerAction(playerId, action) {
    const player = this.players.get(playerId);
    if (player) {
      player.currentAction = action;
      if (action === 'sit' || action === 'sleep') {
        player.isSitting = true;
        player.isMoving = false;
        this.playerPaths.delete(playerId);
      } else if (action === 'stand') {
        player.isSitting = false;
      }
    }
  }

  update(delta) {
    const speed = 3.5 * (delta / 1000);

    for (const [id, player] of this.players) {
      const path = this.playerPaths.get(id);

      if (path && path.length > 0) {
        const nextTarget = path[0];
        const dx = nextTarget.gx - player.gx;
        const dy = nextTarget.gy - player.gy;
        const dist = Math.hypot(dx, dy);

        if (Math.abs(dx) > Math.abs(dy)) {
          player.direction = dx > 0 ? 'SW' : 'NE';
        } else {
          player.direction = dy > 0 ? 'SE' : 'NW';
        }

        if (dist <= speed) {
          player.gx = nextTarget.gx;
          player.gy = nextTarget.gy;
          path.shift();

          if (path.length === 0) {
            player.isMoving = false;
            this.playerPaths.delete(id);
          }
        } else {
          player.gx += (dx / dist) * speed;
          player.gy += (dy / dist) * speed;
          player.isMoving = true;
        }

        player.animFrame += delta * 0.008;

        if (id === this.localPlayerId && this.callbacks.onPlayerMoveStep) {
          this.callbacks.onPlayerMoveStep({
            gx: player.gx,
            gy: player.gy,
            direction: player.direction,
            isMoving: player.isMoving
          });
        }
      } else {
        if (!player.isSitting) {
          player.animFrame = 0;
        }
      }

      if (player.chatMessage && performance.now() > player.chatTimer) {
        player.chatMessage = null;
      }
    }
  }

  renderLoop(time) {
    const delta = Math.min(time - this.lastTime, 100);
    this.lastTime = time;

    this.update(delta);
    this.draw();

    requestAnimationFrame((t) => this.renderLoop(t));
  }

  draw() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    const totalScale = this.scale * this.userZoom;
    ctx.scale(totalScale, totalScale);

    // 1. Fond studio
    ctx.fillStyle = this.viewMode === 'architectural' ? '#111827' : '#ebebeb';
    ctx.fillRect(-this.offsetX / totalScale, -this.offsetY / totalScale, canvas.width / totalScale, canvas.height / totalScale);

    // 2. Décor de la pièce : Mode Architecture Sims ou Décor Photo
    if (this.viewMode === 'architectural') {
      this.drawArchitecturalRoom(ctx);
    } else if (this.isDecorLoaded) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.decorImage, 0, 0, this.V_WIDTH, this.V_HEIGHT);
    }

    // 3. Marqueur de clic
    if (this.clickTarget) {
      const elapsed = performance.now() - this.clickTarget.time;
      if (elapsed < 800) {
        this.drawClickMarker(this.clickTarget.screenX, this.clickTarget.screenY, elapsed);
      } else {
        this.clickTarget = null;
      }
    }

    // 4. Tri en profondeur unifié (Y-sorting : Mobilier & Joueurs)
    const renderEntities = [];

    // Ajouter le mobilier
    for (const f of this.furniture) {
      const pos = this.gridToScreen(f.gx, f.gy);
      renderEntities.push({
        type: 'furniture',
        item: f,
        depth: f.gx + f.gy + ((f.sizeX || 1) + (f.sizeY || 1)) * 0.5,
        pos
      });
    }

    // Ajouter les joueurs
    for (const p of this.players.values()) {
      const pos = this.gridToScreen(p.gx, p.gy);
      renderEntities.push({
        type: 'player',
        player: p,
        depth: p.gx + p.gy,
        pos
      });
    }

    // Trier par profondeur
    renderEntities.sort((a, b) => a.depth - b.depth);

    // Dessiner chaque entité dans l'ordre de profondeur
    for (const entity of renderEntities) {
      if (entity.type === 'furniture') {
        const isSelected = this.selectedFurniture && this.selectedFurniture.id === entity.item.id;
        renderFurniture(ctx, entity.item, entity.pos, isSelected);
      } else if (entity.type === 'player') {
        this.drawAvatar(entity.player);
      }
    }

    // 5. Fantôme de meuble en cours de pose
    if (this.placingItemType && this.isOwner && this.hoverGrid) {
      const def = FURNITURE_CATALOG[this.placingItemType];
      if (def) {
        const hPos = this.gridToScreen(this.hoverGrid.gx, this.hoverGrid.gy);
        ctx.globalAlpha = 0.65;
        renderFurniture(ctx, { ...def, gx: this.hoverGrid.gx, gy: this.hoverGrid.gy, rotation: this.placingRotation || 0 }, hPos, true);
        ctx.globalAlpha = 1.0;
      }
    }

    ctx.restore();
  }


  // Rendu de la pièce en Mode Architecture Sims (Bâtiment modulaire en coupe)
  drawArchitecturalRoom(ctx) {
    const minGx = 2, maxGx = 13;
    const minGy = 2, maxGy = 13;
    const wallHeight = 175; // Hauteur architecturale proportionnée

    // 1. Mur Porteur Arrière-Gauche (Nord-Ouest le long de gy = minGy)
    const pCornerBase = this.gridToScreen(minGx, minGy);
    const pLeftBase = this.gridToScreen(maxGx + 1, minGy);
    const pRightBase = this.gridToScreen(minGx, maxGy + 1);

    // Quad du mur Nord-Ouest
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pCornerBase.x, pCornerBase.y);
    ctx.lineTo(pLeftBase.x, pLeftBase.y);
    ctx.lineTo(pLeftBase.x, pLeftBase.y - wallHeight);
    ctx.lineTo(pCornerBase.x, pCornerBase.y - wallHeight);
    ctx.closePath();
    const gradWallLeft = ctx.createLinearGradient(pLeftBase.x, pLeftBase.y - wallHeight, pCornerBase.x, pCornerBase.y);
    gradWallLeft.addColorStop(0, '#c9b091');
    gradWallLeft.addColorStop(1, '#dbcaa9');
    ctx.fillStyle = gradWallLeft;
    ctx.fill();
    ctx.strokeStyle = '#854d0e';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Poutre supérieure en bois noble
    ctx.beginPath();
    ctx.moveTo(pLeftBase.x, pLeftBase.y - wallHeight);
    ctx.lineTo(pCornerBase.x, pCornerBase.y - wallHeight);
    ctx.lineTo(pCornerBase.x, pCornerBase.y - wallHeight + 14);
    ctx.lineTo(pLeftBase.x, pLeftBase.y - wallHeight + 14);
    ctx.closePath();
    ctx.fillStyle = '#78350f';
    ctx.fill();

    // Plinthe en bois le long du mur gauche
    ctx.beginPath();
    ctx.moveTo(pCornerBase.x, pCornerBase.y);
    ctx.lineTo(pLeftBase.x, pLeftBase.y);
    ctx.lineTo(pLeftBase.x, pLeftBase.y - 12);
    ctx.lineTo(pCornerBase.x, pCornerBase.y - 12);
    ctx.closePath();
    ctx.fillStyle = '#451a03';
    ctx.fill();

    // Grande Baie Vitrée Moderne sur le mur gauche (entre gx=5 et gx=9)
    const pWin1 = this.gridToScreen(5.5, minGy);
    const pWin2 = this.gridToScreen(9.5, minGy);
    const winBottom = -35;
    const winHeight = 90;

    // Fond fenêtre (Ciel ensoleillé & savane sahélienne)
    ctx.beginPath();
    ctx.moveTo(pWin1.x, pWin1.y + winBottom);
    ctx.lineTo(pWin2.x, pWin2.y + winBottom);
    ctx.lineTo(pWin2.x, pWin2.y + winBottom - winHeight);
    ctx.lineTo(pWin1.x, pWin1.y + winBottom - winHeight);
    ctx.closePath();
    const skyGrad = ctx.createLinearGradient(0, pWin1.y + winBottom - winHeight, 0, pWin1.y + winBottom);
    skyGrad.addColorStop(0, '#38bdf8');
    skyGrad.addColorStop(0.7, '#bae6fd');
    skyGrad.addColorStop(1, '#86efac');
    ctx.fillStyle = skyGrad;
    ctx.fill();

    // Cadre et stores de la fenêtre
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Montant central
    const pWinMid = this.gridToScreen(7.5, minGy);
    ctx.beginPath();
    ctx.moveTo(pWinMid.x, pWinMid.y + winBottom);
    ctx.lineTo(pWinMid.x, pWinMid.y + winBottom - winHeight);
    ctx.lineWidth = 2;
    ctx.stroke();

    // 2. Mur Porteur Arrière-Droit (Nord-Est le long de gx = minGx)
    ctx.beginPath();
    ctx.moveTo(pCornerBase.x, pCornerBase.y);
    ctx.lineTo(pRightBase.x, pRightBase.y);
    ctx.lineTo(pRightBase.x, pRightBase.y - wallHeight);
    ctx.lineTo(pCornerBase.x, pCornerBase.y - wallHeight);
    ctx.closePath();
    const gradWallRight = ctx.createLinearGradient(pCornerBase.x, pCornerBase.y - wallHeight, pRightBase.x, pRightBase.y);
    gradWallRight.addColorStop(0, '#ebdcc7');
    gradWallRight.addColorStop(1, '#dfceb5');
    ctx.fillStyle = gradWallRight;
    ctx.fill();
    ctx.strokeStyle = '#854d0e';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Poutre supérieure droite
    ctx.beginPath();
    ctx.moveTo(pCornerBase.x, pCornerBase.y - wallHeight);
    ctx.lineTo(pRightBase.x, pRightBase.y - wallHeight);
    ctx.lineTo(pRightBase.x, pRightBase.y - wallHeight + 14);
    ctx.lineTo(pCornerBase.x, pCornerBase.y - wallHeight + 14);
    ctx.closePath();
    ctx.fillStyle = '#78350f';
    ctx.fill();

    // Plinthe mur droit
    ctx.beginPath();
    ctx.moveTo(pCornerBase.x, pCornerBase.y);
    ctx.lineTo(pRightBase.x, pRightBase.y);
    ctx.lineTo(pRightBase.x, pRightBase.y - 12);
    ctx.lineTo(pCornerBase.x, pCornerBase.y - 12);
    ctx.closePath();
    ctx.fillStyle = '#451a03';
    ctx.fill();

    // Porte intérieure avec chambranle en bois massif (entre gy=8 et gy=11)
    const pDoor1 = this.gridToScreen(minGx, 7.8);
    const pDoor2 = this.gridToScreen(minGx, 10.8);
    const doorHeight = 120;

    // Ouverture couloir sombre
    ctx.beginPath();
    ctx.moveTo(pDoor1.x, pDoor1.y);
    ctx.lineTo(pDoor2.x, pDoor2.y);
    ctx.lineTo(pDoor2.x, pDoor2.y - doorHeight);
    ctx.lineTo(pDoor1.x, pDoor1.y - doorHeight);
    ctx.closePath();
    ctx.fillStyle = '#1e1b18';
    ctx.fill();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 4;
    ctx.stroke();

    // 3. Dalles du Sol Architectural (Parquet noble sahélien & Mosaïque)
    for (let gx = minGx; gx <= maxGx; gx++) {
      for (let gy = minGy; gy <= maxGy; gy++) {
        const c0 = this.gridToScreen(gx, gy);
        const c1 = this.gridToScreen(gx + 1, gy);
        const c2 = this.gridToScreen(gx + 1, gy + 1);
        const c3 = this.gridToScreen(gx, gy + 1);

        ctx.beginPath();
        ctx.moveTo(c0.x, c0.y);
        ctx.lineTo(c1.x, c1.y);
        ctx.lineTo(c2.x, c2.y);
        ctx.lineTo(c3.x, c3.y);
        ctx.closePath();

        // Zone de Tapis / Mosaïque géométrique sous le salon
        if (gx >= 5 && gx <= 8 && gy >= 5 && gy <= 8) {
          ctx.fillStyle = (gx + gy) % 2 === 0 ? '#b91c1c' : '#ca8a04';
          ctx.fill();
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          // Lames de parquet en bois d'acacia polies
          ctx.fillStyle = (gx + gy) % 2 === 0 ? '#b45309' : '#9a3412';
          ctx.fill();
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }

        // Grille architecturale subtile en mode pose de meuble (Style Les Sims)
        if (this.placingItemType || this.selectedFurniture) {
          ctx.save();
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // 4. Murs Sud en coupe basse (Sims Cutaway Walls)
    const pFrontCorner = this.gridToScreen(maxGx + 1, maxGy + 1);
    const cutHeight = 16;

    // Arête avant-gauche
    ctx.beginPath();
    ctx.moveTo(pLeftBase.x, pLeftBase.y);
    ctx.lineTo(pFrontCorner.x, pFrontCorner.y);
    ctx.lineTo(pFrontCorner.x, pFrontCorner.y + cutHeight);
    ctx.lineTo(pLeftBase.x, pLeftBase.y + cutHeight);
    ctx.closePath();
    ctx.fillStyle = '#451a03';
    ctx.fill();
    ctx.strokeStyle = '#291102';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Arête avant-droite
    ctx.beginPath();
    ctx.moveTo(pRightBase.x, pRightBase.y);
    ctx.lineTo(pFrontCorner.x, pFrontCorner.y);
    ctx.lineTo(pFrontCorner.x, pFrontCorner.y + cutHeight);
    ctx.lineTo(pRightBase.x, pRightBase.y + cutHeight);
    ctx.closePath();
    ctx.fillStyle = '#361402';
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  drawClickMarker(x, y, elapsed) {
    const { ctx } = this;
    const progress = elapsed / 800;
    const radius = 28 * (1 + progress * 0.4);
    const alpha = Math.max(0, 1 - progress);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(250, 204, 21, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fill();
    ctx.restore();
  }

  drawAvatar(player) {
    const { ctx } = this;
    const pos = this.gridToScreen(player.gx, player.gy);
    const x = pos.x;
    const y = pos.y;

    const isSitting = player.isSitting;
    const isMoving = player.isMoving;
    const dir = player.direction || 'SE';
    const avatar = player.avatar || {};

    const skinColor = avatar.skin || '#8d5524';
    const shirtColor = avatar.shirtColor || '#d97706';
    const pantsColor = avatar.pantsColor || '#1e293b';
    const hairStyle = avatar.hairStyle || 'afro';
    const hairColor = avatar.hairColor || '#1a110b';
    const outfitStyle = avatar.outfitStyle || 'faso_dan_fani';

    // Animation fluide Bitmoji
    const bounce = isMoving ? Math.abs(Math.sin(player.animFrame * 7)) * 6 : 0;
    const walkSwing = isMoving ? Math.sin(player.animFrame * 7) : 0;
    const armSwing = walkSwing * 12;
    const legSwing = walkSwing * 10;

    ctx.save();

    // 1. Ombre douce au sol
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 28, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.fill();

    const baseY = y - bounce;

    // 2. Sneakers / Baskets Urbaines Bitmoji (Semelle blanche & tige stylisée)
    const shoeY = baseY - 2;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#0f172a';

    const drawSneaker = (sx, sy, swing) => {
      ctx.save();
      ctx.translate(sx + swing, sy);
      // Semelle blanche épaisse
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-6, -4, 15, 6, [2, 4, 3, 2]);
      ctx.fill();
      ctx.stroke();
      // Tige de la basket
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(-6, -11, 13, 8, [3, 4, 2, 1]);
      ctx.fill();
      // Accent couleur
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(-2, -9, 4, 3);
      ctx.restore();
    };

    if (!isSitting) {
      drawSneaker(x - 12, shoeY, -legSwing);
      drawSneaker(x + 5, shoeY, legSwing);
    } else {
      drawSneaker(x - 10, shoeY + 2, 0);
      drawSneaker(x + 4, shoeY + 2, 0);
    }

    // 3. Jambes & Pantalon Slim Denim / Cargo Bitmoji
    const hipY = baseY - 48;
    ctx.fillStyle = pantsColor;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;

    if (!isSitting) {
      // Jambe gauche
      ctx.beginPath();
      ctx.roundRect(x - 14 - (legSwing * 0.5), hipY + 12, 11, 34, 4);
      ctx.fill();
      ctx.stroke();
      // Jambe droite
      ctx.beginPath();
      ctx.roundRect(x + 3 + (legSwing * 0.5), hipY + 12, 11, 34, 4);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.roundRect(x - 15, hipY + 16, 30, 24, 6);
      ctx.fill();
      ctx.stroke();
    }

    // 4. Buste & Veste Streetwear / Tunique Faso Dan Fani Bitmoji
    const torsoY = hipY - 32;
    ctx.fillStyle = shirtColor;
    ctx.beginPath();
    ctx.roundRect(x - 18, torsoY, 36, 42, [8, 8, 4, 4]);
    ctx.fill();
    ctx.stroke();

    // Détails de Style Bitmoji
    if (outfitStyle === 'faso_dan_fani') {
      // Bandes artisanales Faso Dan Fani & Zip central
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x - 8, torsoY, 5, 42);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(x + 3, torsoY, 5, 42);
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(x - 2, torsoY, 4, 42);
      // Fermeture éclair
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, torsoY);
      ctx.lineTo(x, torsoY + 42);
      ctx.stroke();
    } else if (outfitStyle === 'boubou') {
      // Grand Boubou ample avec broderie dorée royale
      ctx.beginPath();
      ctx.moveTo(x - 24, torsoY + 42);
      ctx.lineTo(x - 18, torsoY);
      ctx.lineTo(x + 18, torsoY);
      ctx.lineTo(x + 24, torsoY + 42);
      ctx.closePath();
      ctx.fillStyle = shirtColor;
      ctx.fill();
      ctx.stroke();
      // Broderie col en losange doré
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x - 6, torsoY + 4, 12, 16);
    } else {
      // Sweat à capuche / Hoodie urbain
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.roundRect(x - 12, torsoY + 22, 24, 14, 4);
      ctx.fill();
    }

    // 5. Bras & Mains Expressives Cartoon
    ctx.fillStyle = skinColor;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;

    // Bras gauche
    ctx.save();
    ctx.translate(x - 18, torsoY + 6);
    ctx.rotate((-armSwing * Math.PI) / 180);
    ctx.fillStyle = shirtColor;
    ctx.beginPath();
    ctx.roundRect(-4, 0, 9, 20, 4);
    ctx.fill();
    ctx.stroke();
    // Avant-bras et main cartoon
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.roundRect(-3, 20, 7, 14, 3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Bras droit
    ctx.save();
    ctx.translate(x + 18, torsoY + 6);
    ctx.rotate((armSwing * Math.PI) / 180);
    ctx.fillStyle = shirtColor;
    ctx.beginPath();
    ctx.roundRect(-5, 0, 9, 20, 4);
    ctx.fill();
    ctx.stroke();
    // Main cartoon
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.roundRect(-4, 20, 7, 14, 3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 6. Cou & Tête Bitmoji Snap Expressive (~36x40px)
    ctx.fillStyle = skinColor;
    ctx.fillRect(x - 4, torsoY - 8, 8, 10); // Cou

    const headY = torsoY - 48;
    // Visage aux contours arrondis
    ctx.beginPath();
    ctx.roundRect(x - 17, headY, 34, 40, [16, 16, 18, 18]);
    ctx.fill();
    ctx.stroke();

    // Joues / Teint chaleureux
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.beginPath();
    ctx.arc(x - 10, headY + 24, 4, 0, Math.PI * 2);
    ctx.arc(x + 10, headY + 24, 4, 0, Math.PI * 2);
    ctx.fill();

    // Yeux Bitmoji Expressifs
    const drawBitmojiEye = (ex, ey, pOff) => {
      // Blanc de l'œil
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex, ey, 5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // Iris coloré
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.arc(ex + pOff, ey, 3.5, 0, Math.PI * 2);
      ctx.fill();
      // Pupille noire
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(ex + pOff, ey, 2, 0, Math.PI * 2);
      ctx.fill();
      // Éclat de vie / Reflet blanc signature Bitmoji
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + pOff - 1, ey - 1.5, 1.2, 0, Math.PI * 2);
      ctx.fill();
    };

    let eyeOffset = 0;
    if (dir === 'SE') eyeOffset = 1.5;
    else if (dir === 'SW') eyeOffset = -1.5;

    drawBitmojiEye(x - 7, headY + 18, eyeOffset);
    drawBitmojiEye(x + 7, headY + 18, eyeOffset);

    // Sourcils expressifs
    ctx.strokeStyle = hairColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 12, headY + 11);
    ctx.quadraticCurveTo(x - 7, headY + 9, x - 2, headY + 11);
    ctx.moveTo(x + 2, headY + 11);
    ctx.quadraticCurveTo(x + 7, headY + 9, x + 12, headY + 11);
    ctx.stroke();

    // Sourire cartoon chaleureux
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(x, headY + 26, 6, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    // 7. Coiffures Bitmoji Volumétriques
    ctx.fillStyle = hairColor;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;

    if (hairStyle === 'afro') {
      // Silhouette Afro volumineuse
      ctx.beginPath();
      ctx.arc(x, headY + 4, 23, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Éclat de lumière stylisé
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x - 5, headY - 2, 16, 1.1 * Math.PI, 1.6 * Math.PI);
      ctx.stroke();
    } else if (hairStyle === 'dreads') {
      // Dreads soignées avec bagues dorées
      ctx.beginPath();
      ctx.roundRect(x - 19, headY - 6, 38, 14, 8);
      ctx.fill();
      ctx.stroke();
      // Mèches tombantes
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.roundRect(x + (i * 8) - 3, headY + 6, 6, 26, 3);
        ctx.fill();
        ctx.stroke();
        // Bague dorée
        ctx.fillStyle = '#facc15';
        ctx.fillRect(x + (i * 8) - 3, headY + 22, 6, 3);
        ctx.fillStyle = hairColor;
      }
    } else if (hairStyle === 'foulard') {
      // Foulard traditionnel drapé
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.roundRect(x - 18, headY - 8, 36, 18, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(x, headY - 8, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // Dégradé court net
      ctx.beginPath();
      ctx.roundRect(x - 18, headY - 5, 36, 12, [8, 8, 2, 2]);
      ctx.fill();
      ctx.stroke();
    }

    // 8. Prisme Plumbob animé au-dessus de la tête (Style Les Sims)
    const plumbobY = headY - 24 + Math.sin(performance.now() * 0.005) * 4;
    ctx.beginPath();
    ctx.moveTo(x, plumbobY - 10);
    ctx.lineTo(x + 6, plumbobY);
    ctx.lineTo(x, plumbobY + 10);
    ctx.lineTo(x - 6, plumbobY);
    ctx.closePath();
    ctx.fillStyle = '#22c55e';
    ctx.fill();
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 9. Étiquette du Joueur
    const labelY = plumbobY - 12;
    const username = player.username || 'Joueur';
    ctx.font = '600 12px Outfit, sans-serif';
    const textWidth = ctx.measureText(username).width;
    const badgeWidth = textWidth + (player.isOwner ? 58 : 34);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = player.isOwner ? '#facc15' : 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = player.isOwner ? 1.5 : 1;
    ctx.beginPath();
    ctx.roundRect(x - (badgeWidth / 2), labelY - 14, badgeWidth, 18, 4);
    ctx.fill();
    ctx.stroke();

    if (player.isOwner) {
      ctx.fillStyle = '#facc15';
      ctx.font = '700 9px sans-serif';
      ctx.fillText('HÔTE', x - (badgeWidth / 2) + 5, labelY);
      ctx.font = '600 12px Outfit, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(username, x - (badgeWidth / 2) + 36, labelY);
    } else {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x - (badgeWidth / 2) + 4, labelY - 10, 5, 11);
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(x - (badgeWidth / 2) + 9, labelY - 10, 5, 11);
      ctx.font = '600 12px Outfit, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(username, x - (badgeWidth / 2) + 20, labelY);
    }

    // Bulle de dialogue si message récent
    if (player.chatMessage) {
      this.drawChatBubble(x, labelY - 24, player.chatMessage);
    }

    ctx.restore();
  }

  drawChatBubble(x, y, text) {
    const { ctx } = this;
    ctx.font = '500 12px Outfit, sans-serif';
    const metrics = ctx.measureText(text);
    const bubbleWidth = Math.min(220, metrics.width + 18);
    const bubbleHeight = 22;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(x - (bubbleWidth / 2), y - bubbleHeight, bubbleWidth, bubbleHeight, 6);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x + 4, y);
    ctx.lineTo(x, y + 5);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y - (bubbleHeight / 2));
    ctx.restore();
  }
}
