export interface RecordSaveResult {
  isNewRecord: boolean;
  bestTime: number; // For time-based events: time in seconds. For score-based events: score in points.
  previousBest: number | null;
}

export class RecordManager {
  private static readonly STORAGE_KEY = 'project_apex_records';

  public static getBestTime(trackId: string = 'forest_loop_220m'): number | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const val = parsed[trackId];
      return typeof val === 'number' && !isNaN(val) ? val : null;
    } catch {
      return null;
    }
  }

  public static saveTime(trackId: string = 'forest_loop_220m', timeSeconds: number): RecordSaveResult {
    const previousBest = this.getBestTime(trackId);
    let isNewRecord = false;

    if (previousBest === null || timeSeconds < previousBest) {
      isNewRecord = true;
      try {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        const records = raw ? JSON.parse(raw) : {};
        records[trackId] = timeSeconds;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
      } catch (err) {
        console.warn('[RecordManager] Failed to persist time record:', err);
      }
    }

    return {
      isNewRecord,
      bestTime: isNewRecord ? timeSeconds : (previousBest ?? timeSeconds),
      previousBest,
    };
  }

  public static getBestScore(trackId: string = 'forest_drift_90s'): number | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const val = parsed[trackId];
      return typeof val === 'number' && !isNaN(val) ? val : null;
    } catch {
      return null;
    }
  }

  public static saveScore(trackId: string = 'forest_drift_90s', score: number): RecordSaveResult {
    const previousBest = this.getBestScore(trackId);
    let isNewRecord = false;

    // Higher score is better
    if (previousBest === null || score > previousBest) {
      isNewRecord = true;
      try {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        const records = raw ? JSON.parse(raw) : {};
        records[trackId] = score;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
      } catch (err) {
        console.warn('[RecordManager] Failed to persist score record:', err);
      }
    }

    return {
      isNewRecord,
      bestTime: isNewRecord ? score : (previousBest ?? score),
      previousBest,
    };
  }

  public static formatTime(totalSeconds: number | null): string {
    if (totalSeconds === null || isNaN(totalSeconds)) {
      return '--:--.--';
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.floor((totalSeconds % 1) * 100);

    const mStr = String(minutes).padStart(2, '0');
    const sStr = String(seconds).padStart(2, '0');
    const msStr = String(milliseconds).padStart(2, '0');

    return `${mStr}:${sStr}.${msStr}`;
  }

  public static formatScore(score: number | null): string {
    if (score === null || isNaN(score) || score < 0) {
      return '-- PTS';
    }
    return `${Math.round(score).toLocaleString()} PTS`;
  }
}
