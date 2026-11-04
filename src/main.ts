import './style.css';
import * as BABYLON from '@babylonjs/core';
import { Game } from './core/Game';
import { RecordManager } from './records/RecordManager';
import { CareerManager } from './career/CareerManager';
import { AssetCacheManager } from './core/AssetCacheManager';

async function bootstrap(): Promise<void> {
  console.log('[ProjectApex] Bootstrapping game...');
  // Initialize persistent asset cache and service worker
  AssetCacheManager.getInstance();
  const game = new Game();
  const win = window as any;
  win.BABYLON = BABYLON;
  win.game = game;
  win.apexGame = game;
  win.gameInstance = game;
  win.RecordManager = RecordManager;
  win.CareerManager = CareerManager;
  await game.start();
  console.log('[ProjectApex] Game started successfully.');
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    bootstrap().catch(console.error);
  });
} else {
  bootstrap().catch(console.error);
}
