/**
 * Project Apex — Lightweight LAN WebSocket Server
 * Authoritative host-client room management and message relay for local network multiplayer.
 */

const { WebSocketServer, WebSocket } = require('ws');
const os = require('os');
const http = require('http');

const PORT = parseInt(process.env.PORT || '5050', 10);
const PROTOCOL_VERSION = '1.0.0';
const MAX_PLAYERS = 4;

// Helper: Retrieve all non-internal LAN IPv4 addresses for this machine
function getLocalIPAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses.length > 0 ? addresses : ['127.0.0.1'];
}

const primaryIp = getLocalIPAddresses()[0];

console.log('========================================================');
console.log('     PROJECT APEX — HIGH-SPEED LAN MULTIPLAYER SERVER   ');
console.log('========================================================');
console.log(`Port: ${PORT}`);
console.log(`Protocol Version: ${PROTOCOL_VERSION}`);
console.log(`Detected LAN IP(s): ${getLocalIPAddresses().join(', ')}`);
console.log(`Primary Host Address: ${primaryIp}:${PORT}`);
console.log('========================================================\n');

// Active Room State
let activeRoom = null;
let nextPlayerId = 1;

function resetRoom() {
  activeRoom = null;
  nextPlayerId = 1;
}

const wss = new WebSocketServer({ port: PORT });

function send(ws, msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(msg, excludeWs = null) {
  if (!activeRoom) return;
  for (const p of activeRoom.players) {
    if (p.ws !== excludeWs && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify(msg));
    }
  }
}

function sanitizeString(str, maxLen = 32) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, maxLen);
}

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[LAN Server] New client connection from ${clientIp}`);

  let boundPlayer = null;

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (err) {
      send(ws, { type: 'ERROR', message: 'Malformed JSON payload' });
      return;
    }

    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'PING': {
        send(ws, { type: 'PONG', timestamp: msg.timestamp || Date.now() });
        break;
      }

      case 'CREATE_ROOM': {
        if (activeRoom && activeRoom.players.length > 0) {
          // Check if existing room host is still connected
          const hostPlayer = activeRoom.players.find(p => p.isHost);
          if (hostPlayer && hostPlayer.ws.readyState === WebSocket.OPEN) {
            send(ws, { type: 'ERROR', message: 'A LAN race room is already active on this host server' });
            return;
          }
        }

        const playerName = sanitizeString(msg.player?.name || 'Host Driver', 20) || 'Host Driver';
        const vehicleId = sanitizeString(msg.player?.vehicleId || 'apex_sport_coupe', 40);
        const vehicleName = sanitizeString(msg.player?.vehicleName || 'APX-01 COUPE', 32);
        const paintId = sanitizeString(msg.player?.paintId || 'deep_blue', 32);

        const newPlayer = {
          id: `p_${nextPlayerId++}`,
          name: playerName,
          isHost: true,
          vehicleId,
          vehicleName,
          paintId,
          isReady: true,
          gridSlot: 1,
          pingMs: 0,
          ws
        };

        const roomConfig = {
          roomId: 'APEX-LAN',
          hostName: playerName,
          trackId: msg.roomConfig?.trackId || 'forest_valley',
          trackName: msg.roomConfig?.trackName || 'Forest Valley Circuit',
          raceMode: msg.roomConfig?.raceMode || 'circuit',
          maxPlayers: Math.max(2, Math.min(MAX_PLAYERS, msg.roomConfig?.maxPlayers || MAX_PLAYERS)),
          fillWithAI: msg.roomConfig?.fillWithAI !== false,
          lapCount: msg.roomConfig?.lapCount || 1
        };

        activeRoom = {
          config: roomConfig,
          players: [newPlayer],
          state: 'lobby'
        };

        boundPlayer = newPlayer;

        console.log(`[LAN Server] Room created by ${playerName} (${newPlayer.id}) on ${roomConfig.trackName}`);

        send(ws, {
          type: 'ROOM_CREATED',
          roomConfig,
          player: {
            id: newPlayer.id,
            name: newPlayer.name,
            isHost: true,
            vehicleId: newPlayer.vehicleId,
            vehicleName: newPlayer.vehicleName,
            paintId: newPlayer.paintId,
            isReady: true,
            gridSlot: 1,
            pingMs: 0
          },
          serverInfo: {
            localIp: primaryIp,
            port: PORT,
            version: PROTOCOL_VERSION
          }
        });
        break;
      }

      case 'JOIN_ROOM': {
        if (!activeRoom) {
          send(ws, { type: 'ERROR', message: 'No active room found on host. Host must create the race first.' });
          return;
        }

        if (activeRoom.state !== 'lobby') {
          send(ws, { type: 'ERROR', message: 'Race is currently in progress. Please wait for the next event.' });
          return;
        }

        if (activeRoom.players.length >= activeRoom.config.maxPlayers) {
          send(ws, { type: 'ERROR', message: `Lobby is full (Maximum ${activeRoom.config.maxPlayers} players).` });
          return;
        }

        const playerName = sanitizeString(msg.player?.name || `Driver ${activeRoom.players.length + 1}`, 20);
        const vehicleId = sanitizeString(msg.player?.vehicleId || 'apex_sport_coupe', 40);
        const vehicleName = sanitizeString(msg.player?.vehicleName || 'APX-01 COUPE', 32);
        const paintId = sanitizeString(msg.player?.paintId || 'racing_red', 32);

        // Assign next available grid slot
        const takenSlots = new Set(activeRoom.players.map(p => p.gridSlot));
        let assignedSlot = 2;
        for (let s = 1; s <= MAX_PLAYERS; s++) {
          if (!takenSlots.has(s)) {
            assignedSlot = s;
            break;
          }
        }

        const newPlayer = {
          id: `p_${nextPlayerId++}`,
          name: playerName,
          isHost: false,
          vehicleId,
          vehicleName,
          paintId,
          isReady: false,
          gridSlot: assignedSlot,
          pingMs: 0,
          ws
        };

        activeRoom.players.push(newPlayer);
        boundPlayer = newPlayer;

        console.log(`[LAN Server] Player joined: ${playerName} (${newPlayer.id}) in slot ${assignedSlot}`);

        const publicPlayers = activeRoom.players.map(p => ({
          id: p.id,
          name: p.name,
          isHost: p.isHost,
          vehicleId: p.vehicleId,
          vehicleName: p.vehicleName,
          paintId: p.paintId,
          isReady: p.isReady,
          gridSlot: p.gridSlot,
          pingMs: p.pingMs
        }));

        send(ws, {
          type: 'ROOM_JOINED',
          roomConfig: activeRoom.config,
          players: publicPlayers,
          selfId: newPlayer.id,
          serverInfo: {
            localIp: primaryIp,
            port: PORT,
            version: PROTOCOL_VERSION
          }
        });

        // Broadcast updated lobby to all other players
        broadcast({
          type: 'LOBBY_UPDATE',
          roomConfig: activeRoom.config,
          players: publicPlayers
        }, ws);
        break;
      }

      case 'UPDATE_LOBBY_CONFIG': {
        if (!boundPlayer || !boundPlayer.isHost || !activeRoom) return;

        if (msg.config) {
          if (msg.config.trackId) activeRoom.config.trackId = sanitizeString(msg.config.trackId, 40);
          if (msg.config.trackName) activeRoom.config.trackName = sanitizeString(msg.config.trackName, 40);
          if (msg.config.raceMode) activeRoom.config.raceMode = sanitizeString(msg.config.raceMode, 20);
          if (typeof msg.config.maxPlayers === 'number') {
            activeRoom.config.maxPlayers = Math.max(2, Math.min(MAX_PLAYERS, msg.config.maxPlayers));
          }
          if (typeof msg.config.fillWithAI === 'boolean') {
            activeRoom.config.fillWithAI = msg.config.fillWithAI;
          }
          if (typeof msg.config.lapCount === 'number') {
            activeRoom.config.lapCount = Math.max(1, Math.min(5, msg.config.lapCount));
          }
        }

        const publicPlayers = activeRoom.players.map(p => ({
          id: p.id,
          name: p.name,
          isHost: p.isHost,
          vehicleId: p.vehicleId,
          vehicleName: p.vehicleName,
          paintId: p.paintId,
          isReady: p.isReady,
          gridSlot: p.gridSlot,
          pingMs: p.pingMs
        }));

        broadcast({
          type: 'LOBBY_UPDATE',
          roomConfig: activeRoom.config,
          players: publicPlayers
        });
        break;
      }

      case 'UPDATE_PLAYER_INFO': {
        if (!boundPlayer || !activeRoom) return;

        if (msg.vehicleId) boundPlayer.vehicleId = sanitizeString(msg.vehicleId, 40);
        if (msg.vehicleName) boundPlayer.vehicleName = sanitizeString(msg.vehicleName, 32);
        if (msg.paintId) boundPlayer.paintId = sanitizeString(msg.paintId, 32);
        if (msg.name) boundPlayer.name = sanitizeString(msg.name, 20);

        const publicPlayers = activeRoom.players.map(p => ({
          id: p.id,
          name: p.name,
          isHost: p.isHost,
          vehicleId: p.vehicleId,
          vehicleName: p.vehicleName,
          paintId: p.paintId,
          isReady: p.isReady,
          gridSlot: p.gridSlot,
          pingMs: p.pingMs
        }));

        broadcast({
          type: 'LOBBY_UPDATE',
          roomConfig: activeRoom.config,
          players: publicPlayers
        });
        break;
      }

      case 'TOGGLE_READY': {
        if (!boundPlayer || !activeRoom) return;
        boundPlayer.isReady = typeof msg.isReady === 'boolean' ? msg.isReady : !boundPlayer.isReady;

        const publicPlayers = activeRoom.players.map(p => ({
          id: p.id,
          name: p.name,
          isHost: p.isHost,
          vehicleId: p.vehicleId,
          vehicleName: p.vehicleName,
          paintId: p.paintId,
          isReady: p.isReady,
          gridSlot: p.gridSlot,
          pingMs: p.pingMs
        }));

        broadcast({
          type: 'LOBBY_UPDATE',
          roomConfig: activeRoom.config,
          players: publicPlayers
        });
        break;
      }

      case 'START_RACE': {
        if (!boundPlayer || !boundPlayer.isHost || !activeRoom) {
          send(ws, { type: 'ERROR', message: 'Only the room host can launch the race.' });
          return;
        }

        // Check readiness of non-host clients
        const unready = activeRoom.players.filter(p => !p.isHost && !p.isReady);
        if (unready.length > 0) {
          send(ws, { type: 'ERROR', message: `Cannot start: ${unready.map(u => u.name).join(', ')} not ready.` });
          return;
        }

        activeRoom.state = 'racing';

        // Grid slot mappings: Slot 1 (P1), Slot 2 (P2), Slot 3 (P3), Slot 4 (P4)
        const gridAssignments = {};
        activeRoom.players.forEach(p => {
          gridAssignments[p.id] = p.gridSlot;
        });

        // AI opponent slots if fillWithAI is enabled and human count < 4
        const aiRacers = [];
        if (activeRoom.config.fillWithAI && activeRoom.players.length < MAX_PLAYERS) {
          const usedSlots = new Set(Object.values(gridAssignments));
          const aiArchetypes = [
            { name: 'APX ROSSO (AI)', vehicleId: 'apex_sport_coupe', vehicleName: 'APX-01 COUPE', paintId: 'racing_red' },
            { name: 'APX BILLET (AI)', vehicleId: 'azura_coupe', vehicleName: 'AZURA V6 COUPE', paintId: 'metallic_silver' },
            { name: 'APX OBSIDIAN (AI)', vehicleId: 'stratos_sedan', vehicleName: 'STRATOS SEDAN', paintId: 'gloss_black' },
          ];

          let aiIdx = 0;
          for (let slot = 1; slot <= MAX_PLAYERS; slot++) {
            if (!usedSlots.has(slot)) {
              const arch = aiArchetypes[aiIdx % aiArchetypes.length];
              aiRacers.push({
                id: `ai_${slot}`,
                name: arch.name,
                vehicleId: arch.vehicleId,
                vehicleName: arch.vehicleName,
                paintId: arch.paintId,
                gridSlot: slot
              });
              aiIdx++;
            }
          }
        }

        console.log(`[LAN Server] Launching race on ${activeRoom.config.trackName} with ${activeRoom.players.length} humans and ${aiRacers.length} AI.`);

        broadcast({
          type: 'RACE_STARTING',
          trackId: activeRoom.config.trackId,
          raceMode: activeRoom.config.raceMode,
          lapCount: activeRoom.config.lapCount,
          countdownDuration: 3.0,
          gridAssignments,
          aiRacers
        });
        break;
      }

      case 'CLIENT_INPUT_FRAME': {
        // Relay client input / predicted position to host
        if (!boundPlayer || !activeRoom) return;
        const hostPlayer = activeRoom.players.find(p => p.isHost);
        if (hostPlayer && hostPlayer.ws !== ws && hostPlayer.ws.readyState === WebSocket.OPEN) {
          msg.playerId = boundPlayer.id;
          hostPlayer.ws.send(JSON.stringify(msg));
        }
        break;
      }

      case 'HOST_WORLD_SNAPSHOT': {
        // Authoritative broadcast from host out to all clients
        if (!boundPlayer || !boundPlayer.isHost || !activeRoom) return;
        if (msg.snapshot) {
          broadcast(msg.snapshot, ws);
        }
        break;
      }

      case 'HOST_RACE_FINISHED': {
        // Authoritative finish standings from host out to all clients
        if (!boundPlayer || !boundPlayer.isHost || !activeRoom) return;
        activeRoom.state = 'finished';
        broadcast({
          type: 'RACE_FINISHED',
          standings: msg.standings || []
        });
        break;
      }

      case 'LEAVE_ROOM': {
        handleClientLeave(ws, boundPlayer);
        break;
      }
    }
  });

  ws.on('close', () => {
    handleClientLeave(ws, boundPlayer);
  });

  ws.on('error', (err) => {
    console.warn(`[LAN Server] Socket error: ${err.message}`);
    handleClientLeave(ws, boundPlayer);
  });
});

function handleClientLeave(ws, player) {
  if (!activeRoom || !player) return;

  console.log(`[LAN Server] Player left/disconnected: ${player.name} (${player.id})`);

  if (player.isHost) {
    console.log('[LAN Server] Host left. Closing active room.');
    broadcast({
      type: 'HOST_DISCONNECTED',
      message: 'The room host has disconnected or left the lobby.'
    }, ws);
    resetRoom();
  } else {
    activeRoom.players = activeRoom.players.filter(p => p.id !== player.id);
    broadcast({
      type: 'PLAYER_DISCONNECTED',
      playerId: player.id,
      playerName: player.name
    });

    const publicPlayers = activeRoom.players.map(p => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      vehicleId: p.vehicleId,
      vehicleName: p.vehicleName,
      paintId: p.paintId,
      isReady: p.isReady,
      gridSlot: p.gridSlot,
      pingMs: p.pingMs
    }));

    broadcast({
      type: 'LOBBY_UPDATE',
      roomConfig: activeRoom.config,
      players: publicPlayers
    });
  }
}

// Clean shutdown handler
process.on('SIGINT', () => {
  console.log('\n[LAN Server] Shutting down...');
  if (activeRoom) {
    broadcast({ type: 'HOST_DISCONNECTED', message: 'Server shutting down' });
  }
  wss.close(() => {
    process.exit(0);
  });
});
