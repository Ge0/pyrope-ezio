import type { PyropeAPI, PyropePlugin } from "./dreadcast";

import {
  FarinLocator,
  type FarinQuality,
} from "./farin-locator";

interface Position {
  name: string;
  address: string;
  x: number;
  y: number;
}

interface DreadcastEngine {
  map: {
    offsetX: number;
    offsetY: number;
    posX: number;
    posY: number;
  };
}

declare global {
  interface Window {
    engine: DreadcastEngine;
  }
}

class LocationLocator {

  public isImperialSector() {
    const element = document.querySelector<HTMLElement>("#carte_fond");

    const background = element
      ? getComputedStyle(element).backgroundImage
      : "";

    const filename = background.match(/\/([^/"')]+\.png)(?:\?[^"')]*)?["']?\)/)?.[1];

    return filename === "carte_rues_s1.png";
  }

  public locateLocally(): Position {
    const name = document
      .querySelector("#lieu_actuel .titre1")
      ?.textContent
      ?.trim();

    const address = document
      .querySelector("#lieu_actuel .titre2")
      ?.textContent
      ?.trim();

    if (!name || !address) {
      throw new Error(
        "Impossible de déterminer le lieu actuel."
      );
    }

    const { offsetX, offsetY, posX, posY } = window.engine.map;

    return {
      name,
      address,
      x: offsetX + posX,
      y: offsetY + posY,
    };
  }
}

class EzioPlugin implements PyropePlugin {
  public readonly name = "ezio";

  private readonly farinLocator = new FarinLocator();
  private readonly locationLocator = new LocationLocator();

  private async locateFarin(
    pyrope: PyropeAPI,
    options: {
      illegal: boolean;
      quality: FarinQuality;
      relative: boolean;
      count: number;
    }
  ): Promise<void> {
    const {
      illegal,
      quality,
      relative,
      count,
    } = options;

    const basePosition = this.locationLocator.locateLocally();

    const positionName = basePosition.name.toUpperCase();

    if (
      positionName !== "DANS LA RUE" &&
      positionName !== "TERRAIN VAGUE"
    ) {
      pyrope.print(
        `Vous devez vous trouver dans la rue pour localiser des cristaux farins ! ` +
        `(votre position actuelle : ${positionName})`
      );
      return;
    }

    pyrope.print(
      `Recherche de cristaux farins de qualité "${quality}"...`
    );

    try {
      const result = await this.farinLocator.locate({
        illegal,
        quality,
        basePosition: relative ? basePosition : null,
        count,
      });

      if (!result || (Array.isArray(result) && result.length === 0)) {
        pyrope.print(`Aucun spot détecté (qualité = ${quality}).`);
        return;
      }

      if (Array.isArray(result)) {
        const formatOffset = (value: number) =>
          value >= 0 ? `+${value}` : `${value}`;

        const positions = result.map(position => {
          const dx = position.x - basePosition.x;
          const dy = position.y - basePosition.y;

          return `(${formatOffset(dx)}, ${formatOffset(dy)})`;
        });

        pyrope.print(
          `Spots les plus proches (nombre demandé : ${count}) :\n` +
          positions.join("\n")
        );

        return;
      }

      pyrope.print(
        `Spot localisé en (${result.x}, ${result.y}).`
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        pyrope.print("^C\nScan annulé.");
        return;
      }

      throw error;
    }
  }

  public init(pyrope: PyropeAPI): void {
    pyrope.registerCommand({
      name: "maPosition",
      description: "Donne des informations sur votre localisation.",

      execute: () => {
        const position = this.locationLocator.locateLocally();

        pyrope.print(
          `Position actuelle : ${position.name} (${position.address}) en (${position.x}, ${position.y})`
        );

        const canonicalName = position.name.toUpperCase();

        if (
          canonicalName !== "DANS LA RUE" &&
          canonicalName !== "TERRAIN VAGUE"
        ) {
          return;
        }

        const isImperialSector = this.locationLocator.isImperialSector();

        const zone =
          position.y < 28
            ? "haute ville"
            : position.y < 74
              ? "centre ville"
              : "basse ville";
        if (isImperialSector) {
          pyrope.print("Vous êtes en secteur impéral.");
        }
        pyrope.print(`Vous êtes en ${zone}.`);
      },
    });

    pyrope.registerCommand({
      name: "localiseFarin",
      description: "Localise un spot de cristaux farins.",

      flags: [
        { name: "illegal", alias: "i", type: "boolean" },
        { name: "relative", alias: "r", type: "boolean" },
        { name: "quality", alias: "q", type: "string", default: "best" },
        { name: "count", alias: "c", type: "number", default: 5 },
      ],


      execute: async ({ flags }) => {

        const illegal = flags.illegal === true;
        const relative = flags.relative === true;
        const quality = String(flags.quality ?? "best");

        const count = Number(flags.count ?? 5);

        if (
          !["best", "good", "medium", "poor"].includes(quality)
        ) {
          throw new Error(`Qualité de farin invalide : ${quality}`);
        }

        if (!Number.isInteger(count) || count < 1) {
          throw new Error("Le nombre de cases doit être un entier positif.");
        }

        await this.locateFarin(pyrope, {
          illegal,
          relative,
          quality: quality as FarinQuality,
          count,
        });
      },
    });
  }
}

function registerPlugin(): void {
  const pyrope = window.pyrope;

  if (!pyrope) {
    return;
  }

  void pyrope.registerPlugin(new EzioPlugin());
}

if (window.pyrope?.isInitialized()) {
  registerPlugin();
} else {
  window.addEventListener(
    "pyrope:ready",
    registerPlugin,
    { once: true }
  );
}