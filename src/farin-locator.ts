import { INVALID_POSITIONS, WALKABLE_POSITIONS } from "./positions";

export interface Coordinates {
  x: number;
  y: number;
}

export type FarinQuality =
  | "best"
  | "good"
  | "medium"
  | "poor";

export interface FarinSearchOptions {
  illegal?: boolean;
  quality?: FarinQuality;
  basePosition?: Coordinates | null;
  count?: number;
}

export class FarinLocator {
  private static readonly MAP_URL = "/Admin/Map/Crystals";
  private static readonly PIXEL_STEP = 4;

  private static readonly SOIL_QUALITIES = {
    best: { r: 0x58, g: 0x18, b: 0x45 },
    good: { r: 0x90, g: 0x0c, b: 0x3f },
    medium: { r: 0xc7, g: 0x00, b: 0x39 },
    poor: { r: 0xff, g: 0x57, b: 0x33 },
  } satisfies Record<FarinQuality, {
    r: number;
    g: number;
    b: number;
  }>;

  private static readonly RESTRICTED_ZONE = {
    minX: 15,
    maxX: 26,
    minY: 41,
    maxY: 46,
  };


  private controller: AbortController | null = null;

  public get running(): boolean {
    return this.controller !== null;
  }

  public abort(): void {
    this.controller?.abort();
  }

  public async locate({
    illegal = false,
    quality = "best",
    basePosition = null,
    count = 5,
  }: FarinSearchOptions = {}): Promise<Coordinates | Coordinates[] | null> {
    this.abort();

    const controller = new AbortController();
    this.controller = controller;

    try {
      const image = await this.loadImage(
        FarinLocator.MAP_URL,
        controller.signal
      );

      const positions = await this.scan(
        image,
        controller.signal,
        illegal,
        FarinLocator.SOIL_QUALITIES[quality]
      );

      controller.signal.throwIfAborted();

      const walkable = positions.filter(({ x, y }) =>
        (illegal || y < 74) &&
        FarinLocator.isWalkable(x, y)
      );

      if (walkable.length === 0) {
        return null;
      }

      if (basePosition) {
        return walkable
          .map(position => ({
            position,
            distance: Math.hypot(
              position.x - basePosition.x,
              position.y - basePosition.y
            ),
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, count)
          .map(({ position }) => position);
      }

      return walkable[
        Math.floor(Math.random() * walkable.length)
      ];
    } finally {
      if (this.controller === controller) {
        this.controller = null;
      }
    }
  }

  private static isWalkable(x: number, y: number): boolean {
    const key = `${x},${y}`;

    return (
      WALKABLE_POSITIONS.has(key) &&
      !INVALID_POSITIONS.has(key)
    );
  }

  private isRestricted({ x, y }: Coordinates): boolean {
    const zone = FarinLocator.RESTRICTED_ZONE;

    return (
      x >= zone.minX &&
      x <= zone.maxX &&
      y >= zone.minY &&
      y <= zone.maxY
    );
  }

  private async loadImage(
    url: string,
    signal: AbortSignal
  ): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();

      const cleanup = () => {
        signal.removeEventListener("abort", onAbort);
      };

      const onAbort = () => {
        cleanup();
        image.src = "";
        reject(new DOMException(
          "Scan de farin annulé.",
          "AbortError"
        ));
      };

      signal.addEventListener("abort", onAbort, { once: true });

      if (signal.aborted) {
        onAbort();
        return;
      }

      image.onload = () => {
        cleanup();
        resolve(image);
      };

      image.onerror = () => {
        cleanup();
        reject(new Error(
          "Impossible de charger la carte de la ville."
        ));
      };

      image.src = url;
    });
  }

  private async scan(
    image: HTMLImageElement,
    signal: AbortSignal,
    illegal: boolean,
    targetColor: { r: number; g: number; b: number }
  ): Promise<Coordinates[]> {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const step = FarinLocator.PIXEL_STEP;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (!context) {
      throw new Error("Impossible de créer le contexte Canvas.");
    }

    context.drawImage(image, 0, 0);

    const data = context.getImageData(
      0, 0, width, height
    ).data;

    const positions: Coordinates[] = [];

    for (let y = 0; y < height; y += step) {
      signal.throwIfAborted();

      for (let x = 0; x < width; x += step) {
        let matches = 0;

        for (let dy = 0; dy < step && y + dy < height; dy++) {
          for (let dx = 0; dx < step && x + dx < width; dx++) {
            const offset = ((y + dy) * width + x + dx) * 4;

            if (
              data[offset] === targetColor.r &&
              data[offset + 1] === targetColor.g &&
              data[offset + 2] === targetColor.b
            ) {
              matches++;
            }
          }
        }

        if (matches >= 3) {
          const position = {
            x: x / step,
            y: y / step,
          };

          if (illegal || !this.isRestricted(position)) {
            positions.push(position);
          }
        }
      }

      if (y % 100 === 0) {
        await new Promise<void>(resolve =>
          setTimeout(resolve, 0)
        );
      }
    }

    return positions;
  }
}