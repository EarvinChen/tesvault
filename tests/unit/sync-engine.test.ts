import { describe, it, expect, vi } from 'vitest';
import { SyncEngine, type VideoElement } from '@/lib/video/sync-engine';

function createMockVideoElements(count: number): VideoElement[] {
  return Array.from({ length: count }, () => ({
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    currentTime: 0,
    playbackRate: 1,
    duration: 60,
    readyState: 4,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

// Mock requestAnimationFrame for node environment
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  return setTimeout(() => cb(Date.now()), 0) as unknown as number;
});
vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));

describe('Video Sync Engine', () => {
  it('TC-U011: play() should call play on all videos', () => {
    const mockVideos = createMockVideoElements(4);
    const engine = new SyncEngine(mockVideos);

    engine.play();

    mockVideos.forEach((video) => {
      expect(video.play).toHaveBeenCalled();
    });
  });

  it('TC-U012: pause() should call pause on all videos', () => {
    const mockVideos = createMockVideoElements(4);
    const engine = new SyncEngine(mockVideos);

    engine.pause();

    mockVideos.forEach((video) => {
      expect(video.pause).toHaveBeenCalled();
    });
  });

  it('TC-U013: seek() should set all videos to same time', () => {
    const mockVideos = createMockVideoElements(4);
    const engine = new SyncEngine(mockVideos);

    engine.seek(30.5);

    mockVideos.forEach((video) => {
      expect(video.currentTime).toBe(30.5);
    });
  });

  it('TC-U014: setPlaybackRate() should apply to all videos', () => {
    const mockVideos = createMockVideoElements(6);
    const engine = new SyncEngine(mockVideos);

    engine.setPlaybackRate(2.0);

    mockVideos.forEach((video) => {
      expect(video.playbackRate).toBe(2.0);
    });
  });

  it('TC-U015: should correct drift > 100ms on checkSync', () => {
    const mockVideos = createMockVideoElements(4);
    mockVideos[0].currentTime = 10.0;
    mockVideos[1].currentTime = 10.2; // 200ms drift

    const engine = new SyncEngine(mockVideos);
    engine.checkSync();

    expect(mockVideos[1].currentTime).toBeCloseTo(10.0, 1);
  });

  it('TC-U016: should support 6 video sync', () => {
    const mockVideos = createMockVideoElements(6);
    const engine = new SyncEngine(mockVideos);

    expect(engine.videoCount).toBe(6);
    engine.play();
    expect(mockVideos.every((v) => (v.play as ReturnType<typeof vi.fn>).mock.calls.length > 0)).toBe(true);
  });

  it('TC-U017: single video load failure should not block others', () => {
    const mockVideos = createMockVideoElements(4);
    mockVideos[2].play = vi.fn().mockRejectedValue(new Error('Load failed'));

    const engine = new SyncEngine(mockVideos);
    expect(() => engine.play()).not.toThrow();

    // Wait for async rejection to be caught
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(engine.getErrors()).toHaveLength(1);
        expect(engine.getErrors()[0].camera).toBe(2);
        resolve();
      }, 10);
    });
  });
});
