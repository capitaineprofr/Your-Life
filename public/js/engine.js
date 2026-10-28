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

    // Liste du mobilier placé
    this.furniture = [];
    this.selectedFurniture = null;
    this.placingItemType = null; // En cours de pose

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

    // 2. Appliquer les collisions du mobilier placé
    for (const item of this.furniture) {
      if (item.isWalkable) continue; // Les tapis ne bloquent pas

      const sx = item.sizeX || 1;
      const sy = item.sizeY || 1;

      for (let dx = 0; dx < sx; dx++) {
        for (let dy = 0; dy < sy; dy++) {
          const fx = item.gx + dx;
          const fy = item.gy + dy;
          if (fx >= 0 && fx < this.GRID_SIZE && fy >= 0 && fy < this.GRID_SIZE) {
            this.collisionGrid[fx][fy] = 0; // Obstacle
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
            interactive: def.interactive,
            isWalkable: def.isWalkable
          });
        }
        this.placingItemType = null;
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
        if (this.collisionGrid[nb.x][nb.y] === 0 && (nb.x !== targetX || nb.y !== targetY)) continue;
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

    return [{ gx: endGx, gy: endGy }];
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

    // 1. Fond studio unifié (#ebebeb)
    ctx.fillStyle = '#ebebeb';
    ctx.fillRect(-this.offsetX / totalScale, -this.offsetY / totalScale, canvas.width / totalScale, canvas.height / totalScale);

    // 2. Décor de la pièce vide
    if (this.isDecorLoaded) {
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
        renderFurniture(ctx, { ...def, gx: this.hoverGrid.gx, gy: this.hoverGrid.gy }, hPos, true);
        ctx.globalAlpha = 1.0;
      }
    }

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

    // Animation de marche isométrique
    const bounce = isMoving ? Math.abs(Math.sin(player.animFrame * 8)) * 5 : 0;
    const legSwing = isMoving ? Math.sin(player.animFrame * 8) * 8 : 0;
    const armSwing = isMoving ? legSwing : 0;

    ctx.save();

    // 1. Ombre portée au sol
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 24, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    const avatarBaseY = y - bounce;

    // 2. Pieds & Chaussures (Style voxel Minecraft 3D)
    ctx.fillStyle = '#0f172a';
    if (!isSitting) {
      ctx.fillRect(x - 11 + legSwing, avatarBaseY - 6, 9, 6);
      ctx.fillRect(x + 2 - legSwing, avatarBaseY - 6, 9, 6);
    } else {
      ctx.fillRect(x - 9, avatarBaseY - 4, 9, 6);
      ctx.fillRect(x + 2, avatarBaseY - 4, 9, 6);
    }

    // 3. Jambes & Pantalon
    ctx.fillStyle = pantsColor;
    if (!isSitting) {
      ctx.fillRect(x - 10 + (legSwing * 0.6), avatarBaseY - 26, 8, 20);
      ctx.fillRect(x + 2 - (legSwing * 0.6), avatarBaseY - 26, 8, 20);
    } else {
      ctx.fillRect(x - 10, avatarBaseY - 20, 20, 16);
    }

    // 4. Torse / Buste (Proportions Minecraft : 26x28px avec épaisseur 3D)
    const torsoY = avatarBaseY - 54;
    ctx.fillStyle = shirtColor;
    ctx.fillRect(x - 13, torsoY, 26, 28);
    // Légère bordure d'ombrage Minecraft
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 13, torsoY, 26, 28);

    // Motifs de Tenues Sahéliennes
    if (outfitStyle === 'faso_dan_fani') {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x - 7, torsoY, 4, 28);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(x + 3, torsoY, 4, 28);
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(x - 2, torsoY, 4, 28);
    } else if (outfitStyle === 'boubou') {
      ctx.beginPath();
      ctx.moveTo(x - 18, torsoY + 28);
      ctx.lineTo(x - 13, torsoY);
      ctx.lineTo(x + 13, torsoY);
      ctx.lineTo(x + 18, torsoY + 28);
      ctx.closePath();
      ctx.fillStyle = shirtColor;
      ctx.fill();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 5, torsoY + 3, 10, 12);
    }

    // 5. Bras (Style Minecraft : 8x24px de chaque côté avec balancement)
    ctx.fillStyle = skinColor;
    ctx.fillRect(x - 19, torsoY + 3 - armSwing, 6, 22);
    ctx.fillStyle = shirtColor;
    ctx.fillRect(x - 19, torsoY + 3 - armSwing, 6, 8); // Mancheron

    ctx.fillStyle = skinColor;
    ctx.fillRect(x + 13, torsoY + 3 + armSwing, 6, 22);
    ctx.fillStyle = shirtColor;
    ctx.fillRect(x + 13, torsoY + 3 + armSwing, 6, 8); // Mancheron

    // 6. Cou & Tête (Cube Minecraft 24x24px)
    ctx.fillStyle = skinColor;
    ctx.fillRect(x - 3, torsoY - 6, 6, 6);

    const headY = torsoY - 30;
    ctx.fillRect(x - 12, headY, 24, 24);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(x - 12, headY, 24, 4);

    // Yeux (Pixel-art Minecraft)
    ctx.fillStyle = '#ffffff';
    let eyeLeftX = x - 7;
    let eyeRightX = x + 2;
    let pupilOffsetX = 0;

    if (dir === 'SE') {
      eyeLeftX = x - 4; eyeRightX = x + 4; pupilOffsetX = 1;
    } else if (dir === 'SW') {
      eyeLeftX = x - 8; eyeRightX = x; pupilOffsetX = -1;
    }

    ctx.fillRect(eyeLeftX, headY + 8, 5, 5);
    ctx.fillRect(eyeRightX, headY + 8, 5, 5);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(eyeLeftX + pupilOffsetX + 1, headY + 9, 3, 4);
    ctx.fillRect(eyeRightX + pupilOffsetX + 1, headY + 9, 3, 4);

    // 7. Coiffure & Accessoires
    ctx.fillStyle = hairColor;
    if (hairStyle === 'afro') {
      ctx.beginPath();
      ctx.arc(x, headY + 2, 16, 0, Math.PI * 2);
      ctx.fill();
    } else if (hairStyle === 'dreads') {
      ctx.fillRect(x - 14, headY - 5, 28, 9);
      ctx.fillRect(x - 16, headY + 3, 5, 18);
      ctx.fillRect(x + 11, headY + 3, 5, 18);
    } else if (hairStyle === 'foulard') {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(x - 14, headY - 6, 28, 12);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x - 3, headY - 9, 7, 6);
    } else {
      ctx.fillRect(x - 13, headY - 4, 26, 8);
    }

    // 8. Prisme Plumbob animé au-dessus de la tête (Style Les Sims)
    const plumbobY = headY - 20 + Math.sin(performance.now() * 0.005) * 3;
    ctx.beginPath();
    ctx.moveTo(x, plumbobY - 8);
    ctx.lineTo(x + 5, plumbobY);
    ctx.lineTo(x, plumbobY + 8);
    ctx.lineTo(x - 5, plumbobY);
    ctx.closePath();
    ctx.fillStyle = '#22c55e';
    ctx.fill();
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 9. Étiquette du Joueur (Nom + Badge Propriétaire ou Drapeau BF)
    const labelY = plumbobY - 10;
    const username = player.username || 'Joueur';
    ctx.font = '600 12px Outfit, sans-serif';
    const textWidth = ctx.measureText(username).width;
    const badgeWidth = textWidth + (player.isOwner ? 58 : 34);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
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
