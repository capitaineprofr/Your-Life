// --- Moteur de Rendu Isométrique & Déplacement Canvas ---

export class IsometricEngine {
  constructor(canvas, onFloorClick, onPlayerMoveStep) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onFloorClick = onFloorClick;
    this.onPlayerMoveStep = onPlayerMoveStep;

    // Décor
    this.decorImage = new Image();
    this.decorImage.src = 'assets/decor_apartment.jpg';
    this.isDecorLoaded = false;
    this.decorImage.onload = () => {
      this.isDecorLoaded = true;
    };

    // Dimensions virtuelles de l'image de référence
    this.V_WIDTH = 1200;
    this.V_HEIGHT = 896;

    // Constantes de transformation Isométrique
    this.ORIGIN_X = 600;
    this.ORIGIN_Y = 390;
    this.TILE_U_X = -29.4; // Vecteur U (gx : vers Sud-Ouest)
    this.TILE_U_Y = 14.4;
    this.TILE_V_X = 29.4;  // Vecteur V (gy : vers Sud-Est)
    this.TILE_V_Y = 14.4;

    this.GRID_SIZE = 16;

    // Grille de collision (16x16)
    // 0: Obstacle / Mur
    // 1: Sol Marchable
    // 2: Canapé (Assis)
    // 3: Bureau (Travailler)
    // 4: Cuisine (Boire / Manger)
    this.collisionGrid = this.initCollisionGrid();

    // Joueurs dans la pièce (Map: id -> playerData)
    this.players = new Map();
    this.localPlayerId = null;

    // Cibles et chemins de déplacement
    this.playerPaths = new Map(); // id -> [{gx, gy}, ...]

    // Particules et effets
    this.clickTarget = null; // {gx, gy, screenX, screenY, time}
    this.ceilingFanAngle = 0;

    // Gestion du redimensionnement
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Événements de clic
    this.canvas.addEventListener('click', (e) => this.handleClick(e));

    // Démarrage de la boucle d'animation
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.renderLoop(t));
  }

  initCollisionGrid() {
    const grid = Array.from({ length: 16 }, () => Array(16).fill(0));

    // Définition des zones marchables (intérieur du salon, couloirs, entrée)
    // 1. Allée principale centrale et tapis
    for (let x = 4; x <= 13; x++) {
      for (let y = 3; y <= 8; y++) {
        grid[x][y] = 1;
      }
    }

    // 2. Espace devant la fenêtre et le bureau
    for (let x = 2; x <= 5; x++) {
      for (let y = 3; y <= 5; y++) {
        grid[x][y] = 1;
      }
    }

    // 3. Espace devant le meuble TV
    for (let x = 3; x <= 5; x++) {
      for (let y = 6; y <= 8; y++) {
        grid[x][y] = 1;
      }
    }

    // 4. Espace carrelage cuisine & entrée
    for (let x = 8; x <= 13; x++) {
      for (let y = 6; y <= 12; y++) {
        grid[x][y] = 1;
      }
    }

    // Obstacles spécifiques / Meubles
    // Canapé central (GX: 5..7, GY: 5..7)
    grid[5][5] = 2; // Interactive Canapé
    grid[6][5] = 2;
    grid[5][6] = 2;
    grid[6][6] = 0; // Table basse

    // Bureau et ordinateur (GX: 2..3, GY: 2..3)
    grid[2][2] = 0; // Tour & Écran
    grid[3][2] = 3; // Chaise Bureau / Interactive
    grid[2][3] = 0; // Plante

    // Meuble TV (GX: 2..3, GY: 7..8)
    grid[2][7] = 0;
    grid[2][8] = 0;

    // Comptoir Cuisine (GX: 9..13, GY: 12..14)
    grid[9][12] = 4; // Interactive Cuisine
    grid[10][12] = 4;
    for (let x = 11; x <= 13; x++) {
      for (let y = 11; y <= 13; y++) {
        grid[x][y] = 0; // Meuble cuisine
      }
    }

    return grid;
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // Calcul du ratio pour afficher l'appartement centré
    const scaleX = this.canvas.width / this.V_WIDTH;
    const scaleY = this.canvas.height / this.V_HEIGHT;
    this.scale = Math.max(scaleX, scaleY); // Cover ou adaptatif

    // Si l'écran est très large, préserver les proportions
    if (this.scale * this.V_HEIGHT > this.canvas.height * 1.25) {
      this.scale = Math.min(scaleX, scaleY) * 1.1;
    }

    this.offsetX = (this.canvas.width - this.V_WIDTH * this.scale) / 2;
    this.offsetY = (this.canvas.height - this.V_HEIGHT * this.scale) / 2;
  }

  // Conversion Grille Isométrique -> Pixels dans l'image virtuelle
  gridToScreen(gx, gy) {
    const x = this.ORIGIN_X + (gx * this.TILE_U_X) + (gy * this.TILE_V_X);
    const y = this.ORIGIN_Y + (gx * this.TILE_U_Y) + (gy * this.TILE_V_Y);
    return { x, y };
  }

  // Conversion Pixels dans l'image virtuelle -> Grille Isométrique
  screenToGrid(x, y) {
    const dx = x - this.ORIGIN_X;
    const dy = y - this.ORIGIN_Y;

    const gy = ((dy / this.TILE_V_Y) + (dx / this.TILE_V_X)) / 2;
    const gx = ((dy / this.TILE_U_Y) - (dx / this.TILE_V_X)) / 2;
    return { gx, gy };
  }

  // Conversion Coordonnées Écran (Window) -> Pixels image virtuelle
  windowToVirtual(wx, wy) {
    const vx = (wx - this.offsetX) / this.scale;
    const vy = (wy - this.offsetY) / this.scale;
    return { vx, vy };
  }

  // Conversion Pixels image virtuelle -> Coordonnées Écran (Window)
  virtualToWindow(vx, vy) {
    const wx = this.offsetX + (vx * this.scale);
    const wy = this.offsetY + (vy * this.scale);
    return { wx, wy };
  }

  handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const { vx, vy } = this.windowToVirtual(clickX, clickY);
    const { gx, gy } = this.screenToGrid(vx, vy);

    const targetGx = Math.round(gx);
    const targetGy = Math.round(gy);

    // Vérifier les limites de la pièce
    if (targetGx < 0 || targetGx >= this.GRID_SIZE || targetGy < 0 || targetGy >= this.GRID_SIZE) {
      return;
    }

    const cellType = this.collisionGrid[targetGx][targetGy];

    // Trouver la cellule marchable la plus proche si l'utilisateur a cliqué sur un obstacle
    let finalGx = targetGx;
    let finalGy = targetGy;

    if (cellType === 0) {
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

    if (this.onFloorClick) {
      this.onFloorClick({
        gx: finalGx,
        gy: finalGy,
        windowX: windowCoord.wx,
        windowY: windowCoord.wy,
        cellType: this.collisionGrid[finalGx][finalGy]
      });
    }

    // Déplacer le joueur local
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

  // Algorithme de recherche de chemin (Pathfinding A*)
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

    // Ligne directe de secours si aucun obstacle bloquant
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
      player.chatTimer = performance.now() + 6000; // Visible pendant 6s
    }
  }

  setPlayerAction(playerId, action) {
    const player = this.players.get(playerId);
    if (player) {
      player.currentAction = action;
      if (action === 'sit') {
        player.isSitting = true;
        player.isMoving = false;
        this.playerPaths.delete(playerId);
      } else if (action === 'stand') {
        player.isSitting = false;
      }
    }
  }

  // Mise à jour de la physique et des déplacements
  update(delta) {
    const speed = 3.5 * (delta / 1000); // Vitesse de marche en cases/seconde

    for (const [id, player] of this.players) {
      const path = this.playerPaths.get(id);

      if (path && path.length > 0) {
        const nextTarget = path[0];
        const dx = nextTarget.gx - player.gx;
        const dy = nextTarget.gy - player.gy;
        const dist = Math.hypot(dx, dy);

        // Orientation de l'avatar selon la trajectoire
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

            // Vérifier interaction avec l'objet atteint
            const roundedGx = Math.round(player.gx);
            const roundedGy = Math.round(player.gy);
            const tile = this.collisionGrid[roundedGx]?.[roundedGy];
            if (tile === 2) {
              player.isSitting = true;
              player.direction = 'SE';
            }
          }
        } else {
          player.gx += (dx / dist) * speed;
          player.gy += (dy / dist) * speed;
          player.isMoving = true;
        }

        player.animFrame += delta * 0.008;

        // Émettre la synchronisation si c'est le joueur local
        if (id === this.localPlayerId && this.onPlayerMoveStep) {
          this.onPlayerMoveStep({
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

      // Nettoyer les bulles de chat expirées
      if (player.chatMessage && performance.now() > player.chatTimer) {
        player.chatMessage = null;
      }
    }
  }

  // Boucle de rendu Canvas
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
    ctx.scale(this.scale, this.scale);

    // 1. Fond unifié assorti au décor (#ebebeb)
    ctx.fillStyle = '#ebebeb';
    ctx.fillRect(-this.offsetX / this.scale, -this.offsetY / this.scale, canvas.width / this.scale, canvas.height / this.scale);

    // 2. Dessiner le décor de l'appartement (Fond Isométrique Pixel Art)
    if (this.isDecorLoaded) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.decorImage, 0, 0, this.V_WIDTH, this.V_HEIGHT);
    }

    // 2. Dessiner le marqueur de clic au sol
    if (this.clickTarget) {
      const elapsed = performance.now() - this.clickTarget.time;
      if (elapsed < 800) {
        this.drawClickMarker(this.clickTarget.screenX, this.clickTarget.screenY, elapsed);
      } else {
        this.clickTarget = null;
      }
    }

    // 3. Tri des entités par profondeur isométrique (Y-sorting : gx + gy)
    const sortedPlayers = Array.from(this.players.values()).sort((a, b) => {
      return (a.gx + a.gy) - (b.gx + b.gy);
    });

    // 4. Dessiner chaque avatar
    for (const player of sortedPlayers) {
      this.drawAvatar(player);
    }

    ctx.restore();
  }

  drawClickMarker(x, y, elapsed) {
    const { ctx } = this;
    const progress = elapsed / 800;
    const radius = 18 * (1 + progress * 0.4);
    const alpha = Math.max(0, 1 - progress);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(250, 204, 21, ${alpha})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fill();
    ctx.restore();
  }

  // Rendu complet d'un Avatar 2.5D Pixel Art Stylisé
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

    const bounce = isMoving ? Math.abs(Math.sin(player.animFrame * 8)) * 3 : 0;
    const legSwing = isMoving ? Math.sin(player.animFrame * 8) * 5 : 0;

    ctx.save();

    // 1. Ombre portée au sol
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 14, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    const avatarBaseY = y - bounce;

    // 2. Pieds & Chaussures
    ctx.fillStyle = '#111827';
    if (!isSitting) {
      ctx.fillRect(x - 6 + legSwing, avatarBaseY - 4, 5, 4);
      ctx.fillRect(x + 1 - legSwing, avatarBaseY - 4, 5, 4);
    } else {
      ctx.fillRect(x - 5, avatarBaseY - 2, 6, 4);
      ctx.fillRect(x + 2, avatarBaseY - 2, 6, 4);
    }

    // 3. Pantalon / Jambes
    ctx.fillStyle = pantsColor;
    if (!isSitting) {
      ctx.fillRect(x - 5 + (legSwing * 0.5), avatarBaseY - 14, 4, 10);
      ctx.fillRect(x + 1 - (legSwing * 0.5), avatarBaseY - 14, 4, 10);
    } else {
      ctx.fillRect(x - 6, avatarBaseY - 10, 12, 8);
    }

    // 4. Buste & Vêtement (Faso Dan Fani, Boubou ou Casual)
    const torsoY = avatarBaseY - 28;
    ctx.fillStyle = shirtColor;
    ctx.fillRect(x - 8, torsoY, 16, 15);

    // Motifs traditionnels Faso Dan Fani (rayures tissées africaines)
    if (outfitStyle === 'faso_dan_fani') {
      ctx.fillStyle = '#dc2626'; // Liseré rouge
      ctx.fillRect(x - 4, torsoY, 2, 15);
      ctx.fillStyle = '#facc15'; // Liseré or
      ctx.fillRect(x + 2, torsoY, 2, 15);
      ctx.fillStyle = '#16a34a'; // Liseré vert
      ctx.fillRect(x - 1, torsoY, 2, 15);
    } else if (outfitStyle === 'boubou') {
      // Évasement du boubou
      ctx.beginPath();
      ctx.moveTo(x - 11, torsoY + 16);
      ctx.lineTo(x - 8, torsoY);
      ctx.lineTo(x + 8, torsoY);
      ctx.lineTo(x + 11, torsoY + 16);
      ctx.closePath();
      ctx.fillStyle = shirtColor;
      ctx.fill();
      // Broderie dorée au col
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 3, torsoY, 6, 7);
    }

    // 5. Bras & Mains
    ctx.fillStyle = skinColor;
    const armSwing = isMoving ? legSwing : 0;
    ctx.fillRect(x - 11, torsoY + 3 - armSwing, 3, 9);
    ctx.fillRect(x + 8, torsoY + 3 + armSwing, 3, 9);

    // 6. Cou
    ctx.fillStyle = skinColor;
    ctx.fillRect(x - 2, torsoY - 4, 4, 4);

    // 7. Tête & Visage
    const headY = torsoY - 18;
    ctx.fillStyle = skinColor;
    ctx.fillRect(x - 7, headY, 14, 14);

    // Yeux selon la direction
    ctx.fillStyle = '#ffffff';
    let eyeLeftX = x - 4;
    let eyeRightX = x + 1;
    let pupilOffsetX = 0;

    if (dir === 'SE') {
      eyeLeftX = x - 2; eyeRightX = x + 3; pupilOffsetX = 1;
    } else if (dir === 'SW') {
      eyeLeftX = x - 5; eyeRightX = x; pupilOffsetX = -1;
    }

    if (dir === 'SE' || dir === 'SW') {
      ctx.fillRect(eyeLeftX, headY + 5, 3, 3);
      ctx.fillRect(eyeRightX, headY + 5, 3, 3);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(eyeLeftX + pupilOffsetX, headY + 6, 2, 2);
      ctx.fillRect(eyeRightX + pupilOffsetX, headY + 6, 2, 2);
    }

    // 8. Coiffure
    ctx.fillStyle = hairColor;
    if (hairStyle === 'afro') {
      ctx.beginPath();
      ctx.arc(x, headY + 2, 9, 0, Math.PI * 2);
      ctx.fill();
    } else if (hairStyle === 'dreads') {
      ctx.fillRect(x - 8, headY - 3, 16, 6);
      ctx.fillRect(x - 9, headY + 2, 3, 10);
      ctx.fillRect(x + 6, headY + 2, 3, 10);
    } else if (hairStyle === 'foulard') {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(x - 8, headY - 4, 16, 7);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x - 2, headY - 6, 5, 4);
    } else {
      // Short fade
      ctx.fillRect(x - 7, headY - 2, 14, 4);
    }

    // 9. Étiquette du Joueur (Nom + Badge BF)
    const labelY = headY - 12;
    const username = player.username || 'Joueur';
    ctx.font = '600 11px Outfit, sans-serif';
    const textWidth = ctx.measureText(username).width;
    const badgeWidth = textWidth + 30;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = player.id === this.localPlayerId ? 'rgba(250, 204, 21, 0.8)' : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x - (badgeWidth / 2), labelY - 12, badgeWidth, 16, 4);
    ctx.fill();
    ctx.stroke();

    // Mini drapeau BF (Rouge/Vert)
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(x - (badgeWidth / 2) + 3, labelY - 9, 5, 10);
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(x - (badgeWidth / 2) + 8, labelY - 9, 5, 10);

    // Texte du pseudo
    ctx.fillStyle = '#ffffff';
    ctx.fillText(username, x - (badgeWidth / 2) + 17, labelY);

    // 10. Bulle de dialogue si message de chat actif
    if (player.chatMessage) {
      this.drawChatBubble(x, labelY - 16, player.chatMessage);
    }

    ctx.restore();
  }

  drawChatBubble(x, y, text) {
    const { ctx } = this;
    ctx.font = '500 12px Outfit, sans-serif';
    const metrics = ctx.measureText(text);
    const bubbleWidth = Math.min(200, metrics.width + 18);
    const bubbleHeight = 22;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(x - (bubbleWidth / 2), y - bubbleHeight, bubbleWidth, bubbleHeight, 6);
    ctx.fill();

    // Pointe de la bulle
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
