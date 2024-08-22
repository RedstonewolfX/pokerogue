import BattleScene from "#app/battle-scene.js";
import { biomeLinks, getBiomeName } from "#app/data/biomes.js";
import { Biome } from "#app/enums/biome.js";
import { MoneyInterestModifier, MapModifier, BiomeRateBoosterModifier } from "#app/modifier/modifier.js";
import { OptionSelectItem } from "#app/ui/abstact-option-select-ui-handler.js";
import { Mode } from "#app/ui/ui.js";
import { BattlePhase } from "./battle-phase";
import * as Utils from "#app/utils.js";
import { PartyHealPhase } from "./party-heal-phase";
import { SwitchBiomePhase } from "./switch-biome-phase";

export class SelectBiomePhase extends BattlePhase {
  constructor(scene: BattleScene) {
    super(scene);
  }

  start() {
    super.start();

    const currentBiome = this.scene.arena.biomeType;

    const setNextBiome = (nextBiome: Biome) => {
      if (this.scene.currentBattle.waveIndex % 10 === 1) {
        this.scene.applyModifiers(MoneyInterestModifier, true, this.scene);
        this.scene.unshiftPhase(new PartyHealPhase(this.scene, false));
      }
      this.scene.unshiftPhase(new SwitchBiomePhase(this.scene, nextBiome));
      this.end();
    };

    if ((this.scene.gameMode.isClassic && this.scene.gameMode.isWaveFinal(this.scene.currentBattle.waveIndex + 9))
        || (this.scene.gameMode.isDaily && this.scene.gameMode.isWaveFinal(this.scene.currentBattle.waveIndex))
        || (this.scene.gameMode.hasShortBiomes && !(this.scene.currentBattle.waveIndex % 50))) {
      setNextBiome(Biome.END);
    } else if (this.scene.gameMode.hasRandomBiomes) {
      setNextBiome(this.generateNextBiome());
    } else if (Array.isArray(biomeLinks[currentBiome])) {
      let biomes: Biome[] = [];
      let biomeBoost = 0
      if (this.scene.findModifier(m => m instanceof BiomeRateBoosterModifier)) {
        biomeBoost = this.scene.findModifier(m => m instanceof BiomeRateBoosterModifier)!.getStackCount()
      }
      this.scene.executeWithSeedOffset(() => {
        // Examples:
        // If a biome has a 1/3 chance of appearing (b[1] === 3), and you have 1 Compass, b[1] becomes 2, giving the biome a 1/2 chance of appearing
        biomes = (biomeLinks[currentBiome] as (Biome | [Biome, integer])[])
          .filter(b => !Array.isArray(b) || !Utils.randSeedInt(Math.max(1, b[1] - biomeBoost)))
          .map(b => !Array.isArray(b) ? b : b[0]);
      }, this.scene.currentBattle.waveIndex);
      if (biomes.length > 1 && this.scene.findModifier(m => m instanceof MapModifier)) {
        let biomeChoices: Biome[] = [];
        this.scene.executeWithSeedOffset(() => {
          biomeChoices = (!Array.isArray(biomeLinks[currentBiome])
            ? [biomeLinks[currentBiome] as Biome]
            : biomeLinks[currentBiome] as (Biome | [Biome, integer])[])
            // If the player has both a Map and a Compass, apply the Compass' boost to the chance of each biome being available to select
            .filter((b, i) => !Array.isArray(b) || !Utils.randSeedInt(Math.max(1, b[1] - biomeBoost)))
            .map(b => Array.isArray(b) ? b[0] : b);
        }, this.scene.currentBattle.waveIndex);
        const biomeSelectItems = biomeChoices.map(b => {
          const ret: OptionSelectItem = {
            label: getBiomeName(b),
            handler: () => {
              this.scene.ui.setMode(Mode.MESSAGE);
              setNextBiome(b);
              return true;
            }
          };
          return ret;
        });
        this.scene.ui.setMode(Mode.OPTION_SELECT, {
          options: biomeSelectItems,
          delay: 1000
        });
      } else {
        setNextBiome(biomes[Utils.randSeedInt(biomes.length)]);
      }
    } else if (biomeLinks.hasOwnProperty(currentBiome)) {
      setNextBiome(biomeLinks[currentBiome] as Biome);
    } else {
      setNextBiome(this.generateNextBiome());
    }
  }

  generateNextBiome(): Biome {
    if (!(this.scene.currentBattle.waveIndex % 50)) {
      return Biome.END;
    }
    return this.scene.generateRandomBiome(this.scene.currentBattle.waveIndex);
  }
}
