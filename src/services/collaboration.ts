import * as Y from 'yjs';
import { io, Socket } from 'socket.io-client';

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  activeLayerId?: string;
  isDrawing?: boolean;
}

export class CollaborationManager {
  public ydoc: Y.Doc;
  public localUser: Collaborator;
  private socket: Socket | null = null;
  private peers: Map<string, Collaborator> = new Map();
  private onPeersChangeCallbacks: Set<(peers: Collaborator[]) => void> = new Set();
  private onRemoteDrawCallbacks: Set<(layerId: string, drawData: any) => void> = new Set();
  
  constructor() {
    this.ydoc = new Y.Doc();
    
    // Create local user settings
    const colors = ['#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const randomNames = ['CyberPainter', 'PixelWizard', 'InkMaster', 'VectorVibe', 'CanvasQueen', 'BrushStroker'];
    const randomName = randomNames[Math.floor(Math.random() * randomNames.length)];

    this.localUser = {
      id: 'user_' + Math.random().toString(36).substring(2, 9),
      name: randomName,
      color: randomColor,
      cursor: null,
    };
  }

  public connect(roomName: string, serverUrl: string = 'wss://palettex-collab.herokuapp.com') {
    try {
      // Setup socket connection
      this.socket = io(serverUrl, {
        autoConnect: false,
        transports: ['websocket'],
      });

      this.socket.on('connect', () => {
        console.log('Connected to collaboration server room:', roomName);
        this.socket?.emit('join-room', { roomName, user: this.localUser });
      });

      this.socket.on('user-joined', (user: Collaborator) => {
        this.peers.set(user.id, user);
        this.triggerPeersChange();
      });

      this.socket.on('user-left', (userId: string) => {
        this.peers.delete(userId);
        this.triggerPeersChange();
      });

      this.socket.on('cursor-update', ({ userId, cursor }: { userId: string; cursor: { x: number; y: number } }) => {
        const peer = this.peers.get(userId);
        if (peer) {
          peer.cursor = cursor;
          this.triggerPeersChange();
        }
      });

      this.socket.on('remote-drawing', ({ userId, layerId, drawData }: { userId: string; layerId: string; drawData: any }) => {
        this.onRemoteDrawCallbacks.forEach(cb => cb(layerId, drawData));
      });

      this.socket.connect();
    } catch (err) {
      console.warn('Socket server not reachable, running in Local Collaboration Sandbox mode.');
      this.startSimulation();
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.peers.clear();
    this.triggerPeersChange();
  }

  public updateLocalCursor(cursor: { x: number; y: number } | null) {
    this.localUser.cursor = cursor;
    if (this.socket && this.socket.connected) {
      this.socket.emit('cursor-move', cursor);
    }
  }

  public broadcastDrawing(layerId: string, drawData: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('drawing', { layerId, drawData });
    }
  }

  public getPeers(): Collaborator[] {
    return Array.from(this.peers.values());
  }

  public onPeersChange(callback: (peers: Collaborator[]) => void) {
    this.onPeersChangeCallbacks.add(callback);
    callback(this.getPeers());
    return () => this.onPeersChangeCallbacks.delete(callback);
  }

  public onRemoteDraw(callback: (layerId: string, drawData: any) => void) {
    this.onRemoteDrawCallbacks.add(callback);
    return () => this.onRemoteDrawCallbacks.delete(callback);
  }

  private triggerPeersChange() {
    const peerList = this.getPeers();
    this.onPeersChangeCallbacks.forEach((cb) => cb(peerList));
  }

  // --- Sandbox Simulation Mode ---
  // When no remote server is connected, mock peers join and draw to demonstrate collaboration features.
  private simulationInterval: any = null;
  
  private startSimulation() {
    // Add two mock collaborators
    const mockPeers: Collaborator[] = [
      { id: 'peer_bob', name: 'CyberGlow', color: '#ec4899', cursor: { x: 200, y: 300 } },
      { id: 'peer_alice', name: 'PixelDreamer', color: '#10b981', cursor: { x: 600, y: 400 } },
    ];

    mockPeers.forEach(p => this.peers.set(p.id, p));
    this.triggerPeersChange();

    let angle = 0;
    this.simulationInterval = setInterval(() => {
      angle += 0.05;
      
      // Move Bob in a circle
      const bob = this.peers.get('peer_bob');
      if (bob) {
        bob.cursor = {
          x: 400 + Math.cos(angle) * 150,
          y: 300 + Math.sin(angle) * 150,
        };
        bob.isDrawing = Math.sin(angle * 2) > 0;
        
        // Occasionally trigger a simulated remote draw stroke
        if (bob.isDrawing && Math.random() < 0.2) {
          const pt = bob.cursor;
          this.onRemoteDrawCallbacks.forEach(cb => cb('active', {
            type: 'brush',
            x: pt.x,
            y: pt.y,
            color: bob.color,
            size: 8,
          }));
        }
      }

      // Move Alice in a sine wave
      const alice = this.peers.get('peer_alice');
      if (alice) {
        alice.cursor = {
          x: 300 + Math.sin(angle * 0.7) * 200,
          y: 400 + Math.cos(angle * 1.3) * 100,
        };
      }

      this.triggerPeersChange();
    }, 100);
  }

  public stopSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }
}

export const collabInstance = new CollaborationManager();
