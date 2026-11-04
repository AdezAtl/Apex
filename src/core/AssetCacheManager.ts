/**
 * AssetCacheManager
 * Handles client-side persistent storage and service worker asset caching.
 * Ensures that after the first load, all 3D vehicle models, track geometry,
 * textures, and game data are cached locally so subsequent loads are near-instantaneous.
 */
export class AssetCacheManager {
  private static instance: AssetCacheManager | null = null;
  private isRegistered: boolean = false;

  private static readonly STORAGE_FLAG_KEY = 'apex_assets_cached';
  private static readonly STORAGE_TIMESTAMP_KEY = 'apex_cache_timestamp';

  // Common assets to preload into cache during idle time after first boot
  private static readonly ESSENTIAL_ASSET_URLS = [
    './assets/vehicles/APX01.glb',
    './assets/vehicles/slc.glb',
    './assets/vehicles/x6.glb',
    './assets/vehicles/F-1500.glb',
    './assets/vehicles/cubertrick.glb',
    './assets/vehicles/sopra.glb',
    './assets/vehicles/bmw_m3_gtr.glb',
    './assets/vehicles/camara.glb',
    './assets/vehicles/GT34R.glb',
    './assets/vehicles/GTRS3.glb',
    './assets/vehicles/fairheaven_lt_80_cop_cruiser_-_low_poly_model.glb',
    './assets/tracks/decoration-forest.glb',
    './assets/tracks/track-straight.glb',
    './assets/tracks/track-corner.glb',
    './assets/tracks/track-bump.glb',
    './assets/tracks/track-finish.glb',
    './assets/tracks/colormap.png',
    './assets/buildings_ads/roadside_asset_kit.glb',
    './assets/buildings_ads/track_barrier_banner.glb',
  ];

  public static getInstance(): AssetCacheManager {
    if (!AssetCacheManager.instance) {
      AssetCacheManager.instance = new AssetCacheManager();
    }
    return AssetCacheManager.instance;
  }

  private constructor() {
    this.registerServiceWorker();
  }

  /**
   * Registers the Service Worker for transparent network caching of all GLBs, textures & scripts
   */
  public registerServiceWorker(): void {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        this.isRegistered = true;
        console.log('[AssetCache] Service Worker active, scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[AssetCache] Service Worker registration failed:', err);
      });
  }

  /**
   * Asynchronously pre-fetches essential assets into Cache Storage during background idle time
   */
  public preloadAssetsInBackground(): void {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;

    const runPreload = async () => {
      try {
        console.log('[AssetCache] Starting background asset persistence...');
        let cachedCount = 0;

        for (const url of AssetCacheManager.ESSENTIAL_ASSET_URLS) {
          try {
            // Using standard fetch with cache-first service worker will automatically store in Cache Storage
            const res = await fetch(url, { cache: 'force-cache' });
            if (res.ok) cachedCount++;
          } catch {
            // Non-critical: continue with next asset
          }
        }

        try {
          localStorage.setItem(AssetCacheManager.STORAGE_FLAG_KEY, 'true');
          localStorage.setItem(AssetCacheManager.STORAGE_TIMESTAMP_KEY, Date.now().toString());
        } catch {}

        console.log(`[AssetCache] Successfully cached ${cachedCount}/${AssetCacheManager.ESSENTIAL_ASSET_URLS.length} assets locally.`);
      } catch (err) {
        console.warn('[AssetCache] Background caching warning:', err);
      }
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => runPreload(), { timeout: 4000 });
    } else {
      setTimeout(runPreload, 2500);
    }
  }

  public isServiceWorkerRegistered(): boolean {
    return this.isRegistered;
  }

  /**
   * Returns whether game assets have been saved to local storage / cache
   */
  public isAssetsCachedLocally(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(AssetCacheManager.STORAGE_FLAG_KEY) === 'true';
  }
}
