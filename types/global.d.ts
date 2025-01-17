interface VideoFrame {
  readonly format: VideoPixelFormat | null;
  readonly timestamp: number;
  readonly codedWidth: number;
  readonly codedHeight: number;
  close(): void;
}
