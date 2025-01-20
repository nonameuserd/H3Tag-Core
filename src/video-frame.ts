export class VideoFrameImpl implements VideoFrame {
  readonly format: VideoPixelFormat | null;
  readonly timestamp: number;
  readonly codedWidth: number;
  readonly codedHeight: number;
  readonly codedRect: DOMRectReadOnly | null;
  readonly visibleRect: DOMRectReadOnly | null;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly duration: number | null;
  readonly colorSpace: VideoColorSpace;

  constructor(
    format: VideoPixelFormat | null,
    timestamp: number,
    codedWidth: number,
    codedHeight: number,
    codedRect: DOMRectReadOnly | null,
    visibleRect: DOMRectReadOnly | null,
    displayWidth: number,
    displayHeight: number,
    colorSpace: VideoColorSpace,
    duration: number | null,
  ) {
    this.format = format;
    this.timestamp = timestamp;
    this.codedWidth = codedWidth;
    this.codedHeight = codedHeight;
    this.duration = duration;
    this.colorSpace = colorSpace;
    this.codedRect = codedRect;
    this.visibleRect = visibleRect;
    this.displayWidth = displayWidth;
    this.displayHeight = displayHeight;
  }

  allocationSize(): number {
    return 0;
  }

  clone(): VideoFrame {
    return new VideoFrameImpl(
      this.format,
      this.timestamp,
      this.codedWidth,
      this.codedHeight,
      this.codedRect,
      this.visibleRect,
      this.displayWidth,
      this.displayHeight,
      this.colorSpace,
      this.duration,
    );
  }

  close(): void {}

  copyTo(destination: BufferSource): Promise<PlaneLayout[]> {
    if (
      !(destination instanceof ArrayBuffer || ArrayBuffer.isView(destination))
    ) {
      throw new TypeError('Destination must be a BufferSource');
    }

    const layouts: PlaneLayout[] = [];
    const destView = new Uint8Array(
      destination instanceof ArrayBuffer ? destination : destination.buffer,
    );

    switch (this.format) {
      case 'RGBA':
      case 'BGRA': {
        const bytesPerPixel = 4;
        const stride = this.codedWidth * bytesPerPixel;
        const size = this.codedHeight * stride;

        if (destView.length < size) {
          throw new Error('Destination buffer is too small');
        }

        layouts.push({
          offset: 0,
          stride: stride,
        });
        break;
      }

      case 'I420': {
        const yStride = this.codedWidth;
        const uvStride = Math.floor(this.codedWidth / 2);
        const ySize = yStride * this.codedHeight;
        const uvSize = uvStride * Math.floor(this.codedHeight / 2);
        const totalSize = ySize + 2 * uvSize;

        if (destView.length < totalSize) {
          throw new Error('Destination buffer is too small');
        }

        layouts.push(
          { offset: 0, stride: yStride }, // Y plane
          { offset: ySize, stride: uvStride }, // U plane
          { offset: ySize + uvSize, stride: uvStride }, // V plane
        );
        break;
      }

      case 'NV12': {
        const yStride = this.codedWidth;
        const uvStride = this.codedWidth;
        const ySize = yStride * this.codedHeight;
        const uvSize = uvStride * Math.floor(this.codedHeight / 2);

        if (destView.length < ySize + uvSize) {
          throw new Error('Destination buffer is too small');
        }

        layouts.push(
          { offset: 0, stride: yStride }, // Y plane
          { offset: ySize, stride: uvStride }, // UV plane
        );
        break;
      }

      default:
        throw new Error(`Unsupported format: ${this.format}`);
    }

    return Promise.resolve(layouts);
  }
}
