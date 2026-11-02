/**
 * Mobile device and viewport detection for automatic fullscreen engagement.
 */
export function isMobileDeviceOrViewport(): boolean {
  if (typeof window === 'undefined') return false;
  const isSmallViewport = window.innerWidth <= 960 || window.innerHeight <= 600;
  const isCoarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const isMobileUA =
    /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints !== undefined && navigator.maxTouchPoints > 1);
  return isSmallViewport || isCoarse || isMobileUA;
}

/**
 * Attempts to launch fullscreen mode if running on mobile / touch screen device.
 * Gracefully respects browser user-activation permission constraints.
 */
export async function requestFullscreenIfMobile(): Promise<boolean> {
  if (!isMobileDeviceOrViewport()) return false;
  if (typeof document === 'undefined') return false;
  if (document.fullscreenElement) return true;

  try {
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
      mozRequestFullScreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };

    if (docEl.requestFullscreen) {
      await docEl.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
    } else if (docEl.webkitRequestFullscreen) {
      await docEl.webkitRequestFullscreen();
    } else if (docEl.mozRequestFullScreen) {
      await docEl.mozRequestFullScreen();
    } else if (docEl.msRequestFullscreen) {
      await docEl.msRequestFullscreen();
    }

    // Attempt orientation lock to landscape if API is accessible
    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      if (orientation && typeof orientation.lock === 'function') {
        orientation.lock('landscape').catch(() => {});
      }
    } catch {}

    return true;
  } catch (_e) {
    // Silently continue if browser security policy requires subsequent touch gesture
    return false;
  }
}

/**
 * Exits fullscreen mode if active.
 */
export async function exitFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;
  if (!document.fullscreenElement) return;

  try {
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void>;
      mozCancelFullScreen?: () => Promise<void>;
      msExitFullscreen?: () => Promise<void>;
    };

    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
    } else if (doc.mozCancelFullScreen) {
      await doc.mozCancelFullScreen();
    } else if (doc.msExitFullscreen) {
      await doc.msExitFullscreen();
    }
  } catch {}
}

/**
 * Toggles fullscreen mode.
 */
export async function toggleFullscreen(): Promise<void> {
  if (document.fullscreenElement) {
    await exitFullscreen();
  } else {
    await requestFullscreenIfMobile();
  }
}

