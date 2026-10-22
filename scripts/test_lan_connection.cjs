const { WebSocket } = require('ws');

async function testConnectionPrototype() {
  console.log('--- TESTING STAGE B: LAN CONNECTION PROTOTYPE ---');

  const wsHost = new WebSocket('ws://localhost:5050');
  const wsClient = new WebSocket('ws://localhost:5050');

  await Promise.all([
    new Promise(r => wsHost.on('open', r)),
    new Promise(r => wsClient.on('open', r))
  ]);
  console.log('✓ Both sockets connected successfully to ws://localhost:5050');

  let roomCreated = false;
  let roomJoined = false;
  let clientReadyReceived = false;
  let raceStartedReceived = false;

  wsHost.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('[Host Recv]:', msg.type);
    if (msg.type === 'ROOM_CREATED') {
      roomCreated = true;
      console.log('✓ Room created on host:', msg.roomConfig.roomId, 'Host IP:', msg.serverInfo.localIp);
      // Now client joins
      wsClient.send(JSON.stringify({
        type: 'JOIN_ROOM',
        version: '1.0.0',
        player: { name: 'Player Two', vehicleId: 'azura_coupe', vehicleName: 'AZURA V6 COUPE', paintId: 'racing_red' }
      }));
    } else if (msg.type === 'LOBBY_UPDATE') {
      const p2 = msg.players.find(p => p.name === 'Player Two');
      if (p2 && p2.isReady) {
        clientReadyReceived = true;
        console.log('✓ Host received Player Two is READY! Launching race...');
        wsHost.send(JSON.stringify({ type: 'START_RACE' }));
      }
    } else if (msg.type === 'RACE_STARTING') {
      raceStartedReceived = true;
      console.log('✓ Host received RACE_STARTING! Grid slots:', msg.gridAssignments, 'AI fill count:', msg.aiRacers.length);
    }
  });

  wsClient.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('[Client Recv]:', msg.type);
    if (msg.type === 'ROOM_JOINED') {
      roomJoined = true;
      console.log('✓ Client joined successfully! Assigned slot:', msg.players.find(p => p.name === 'Player Two')?.gridSlot);
      // Client toggles ready
      wsClient.send(JSON.stringify({ type: 'TOGGLE_READY', isReady: true }));
    } else if (msg.type === 'RACE_STARTING') {
      console.log('✓ Client received synchronized RACE_STARTING on track:', msg.trackId);
    }
  });

  // Host sends CREATE_ROOM
  wsHost.send(JSON.stringify({
    type: 'CREATE_ROOM',
    version: '1.0.0',
    roomConfig: { trackId: 'forest_valley', trackName: 'Forest Valley Circuit', raceMode: 'circuit', maxPlayers: 4, fillWithAI: true },
    player: { name: 'Host Racer', vehicleId: 'apex_sport_coupe', vehicleName: 'APX-01 COUPE', paintId: 'deep_blue' }
  }));

  // Wait for race starting
  for (let i = 0; i < 40; i++) {
    if (raceStartedReceived) break;
    await new Promise(r => setTimeout(r, 100));
  }

  wsHost.close();
  wsClient.close();

  if (roomCreated && roomJoined && clientReadyReceived && raceStartedReceived) {
    console.log('\n========================================');
    console.log('STAGE B PROTOTYPE: ALL CHECKS PASSED! ✓');
    console.log('========================================');
    process.exit(0);
  } else {
    console.error('FAILED checks:', { roomCreated, roomJoined, clientReadyReceived, raceStartedReceived });
    process.exit(1);
  }
}

testConnectionPrototype().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
