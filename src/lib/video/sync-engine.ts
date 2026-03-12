/**
 * Multi-video sync engine.
 * Uses front camera as master clock and keeps all videos in sync.
 */

export interface SyncError {
  camera: number;
  message: string;
}

export interface VideoElement {
  play: () => Promise<void>;
  pause: () => void;
  currentTime: number;
  playbackRate: number;
  duration: number;
  readyState: number;
  addEventListener: (event: string, handler: () => void) => void;
  removeEventListener: (event: string, handler: () => void) => void;
}

const SYNC_THRESHOLD_MS = 100; // max allowed drift in ms

export class SyncEngine {
  private videos: VideoElement[];
  private errors: SyncError[] = [];
  private rafId: number | null = null;
  private _isPlaying = false;

  constructor(videos: VideoElement[]) {
    this.videos = videos;
  }

  get videoCount(): number {
    return this.videos.length;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  /** Get master clock time (from first video = front camera) */
  get currentTime(): number {
    return this.videos[0]?.currentTime ?? 0;
  }

  get duration(): number {
    return this.videos[0]?.duration ?? 0;
  }

  getErrors(): SyncError[] {
    return [...this.errors];
  }

  play(): void {
    this.errors = [];
    this._isPlaying = true;

    this.videos.forEach((video, i) => {
      try {
        const result = video.play();
        if (result && typeof result.catch === 'function') {
          result.catch((err: Error) => {
            this.errors.push({ camera: i, message: err.message });
          });
        }
      } catch (err) {
        this.errors.push({
          camera: i,
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    });

    this.startSyncLoop();
  }

  pause(): void {
    this._isPlaying = false;
    this.stopSyncLoop();

    this.videos.forEach((video) => {
      try {
        video.pause();
      } catch {
        // ignore pause errors
      }
    });
  }

  seek(time: number): void {
    this.videos.forEach((video) => {
      video.currentTime = time;
    });
  }

  setPlaybackRate(rate: number): void {
    this.videos.forEach((video) => {
      video.playbackRate = rate;
    });
  }

  setVolume(volume: number, videoIndex: number = 0): void {
    const video = this.videos[videoIndex] as VideoElement & { volume?: number };
    if (video && 'volume' in video) {
      video.volume = volume;
    }
  }

  /** Check sync across all videos and correct drift */
  checkSync(): void {
    if (this.videos.length < 2) return;

    const masterTime = this.videos[0].currentTime;

    for (let i = 1; i < this.videos.length; i++) {
      const drift = Math.abs(this.videos[i].currentTime - masterTime);
      if (drift > SYNC_THRESHOLD_MS / 1000) {
        this.videos[i].currentTime = masterTime;
      }
    }
  }

  private startSyncLoop(): void {
    this.stopSyncLoop();

    const loop = () => {
      if (!this._isPlaying) return;
      this.checkSync();
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  private stopSyncLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy(): void {
    this.pause();
    this.videos = [];
    this.errors = [];
  }
}
