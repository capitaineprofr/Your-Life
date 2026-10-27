// --- Client Réseau (API REST & WebSockets Multijoueur) ---

export class NetworkClient {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.ws = null;
    this.token = localStorage.getItem('your_life_token') || null;
    this.currentUser = null;
    this.isConnected = false;
  }

  // --- Appels API REST ---

  async register(username, password, avatar) {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, avatar })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'inscription');

    this.token = data.token;
    this.currentUser = data.user;
    localStorage.setItem('your_life_token', this.token);
    return data;
  }

  async login(username, password) {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Identifiants invalides');

    this.token = data.token;
    this.currentUser = data.user;
    localStorage.setItem('your_life_token', this.token);
    return data;
  }

  async fetchMe() {
    if (!this.token) return null;
    try {
      const res = await fetch('/api/me', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (!res.ok) {
        this.logout();
        return null;
      }
      const data = await res.json();
      this.currentUser = data.user;
      return data.user;
    } catch {
      return null;
    }
  }

  async workPC() {
    if (!this.token) return null;
    const res = await fetch('/api/work', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return await res.json();
  }

  logout() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('your_life_token');
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // --- Connexion WebSocket Multijoueur ---

  connectWebSocket() {
    if (!this.token) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.isConnected = true;
      // Authentification auprès du serveur WebSocket
      this.send({ type: 'auth', token: this.token });
      if (this.callbacks.onConnected) this.callbacks.onConnected();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (e) {
        console.error('Erreur parsing message WS:', e);
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      if (this.callbacks.onDisconnected) this.callbacks.onDisconnected();
    };

    this.ws.onerror = (err) => {
      console.error('Erreur WebSocket:', err);
    };
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'room_init':
        if (this.callbacks.onRoomInit) this.callbacks.onRoomInit(msg);
        break;
      case 'player_joined':
        if (this.callbacks.onPlayerJoined) this.callbacks.onPlayerJoined(msg.player);
        break;
      case 'player_left':
        if (this.callbacks.onPlayerLeft) this.callbacks.onPlayerLeft(msg.id);
        break;
      case 'player_move':
        if (this.callbacks.onPlayerMove) this.callbacks.onPlayerMove(msg);
        break;
      case 'player_position':
        if (this.callbacks.onPlayerPosition) this.callbacks.onPlayerPosition(msg);
        break;
      case 'player_chat':
        if (this.callbacks.onPlayerChat) this.callbacks.onPlayerChat(msg);
        break;
      case 'player_action':
        if (this.callbacks.onPlayerAction) this.callbacks.onPlayerAction(msg);
        break;
      case 'auth_error':
        this.logout();
        if (this.callbacks.onAuthError) this.callbacks.onAuthError(msg.message);
        break;
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  sendMove(targetGx, targetGy, direction) {
    this.send({ type: 'move', targetGx, targetGy, direction });
  }

  sendPositionSync(gx, gy, direction, isMoving) {
    this.send({ type: 'position_sync', gx, gy, direction, isMoving });
  }

  sendChat(text) {
    this.send({ type: 'chat', text });
  }

  sendAction(action) {
    this.send({ type: 'action', action });
  }
}
