import { describe, expect, it } from "vitest";
import { bonusCardsCatalog, speciesCards } from "./cards";

/**
 * Aves cuyo poder es BLANCO ("al jugar") en la lista oficial de cartas del juego base
 * (hoja "wingspan-card-lists" de Stonemaier Games; 36 de las 170 aves). El resto son pardos
 * ("al activar") o rosas ("entre turnos"); las 6 aves sin poder no aparecen.
 */
const WHITE_POWER_BIRDS = [
  "americanGoldfinch", "americanOystercatcher", "ashThroatedFlycatcher", "atlanticPuffin", "baldEagle",
  "bellsVireo", "blackNeckedStilt", "bobolink", "brownPelican", "californiaCondor", "carolinaWren",
  "cassinsFinch", "ceruleanWarbler", "chestnutCollaredLongspur", "downyWoodpecker", "easternBluebird",
  "greatBlueHeron", "greatEgret", "greaterPrairieChicken", "houseWren", "incaDove", "kingRail",
  "mountainBluebird", "northernFlicker", "paintedBunting", "redCockadedWoodpecker", "redEyedVireo",
  "roseateSpoonbill", "rubyCrownedKinglet", "savannahSparrow", "saysPhoebe", "spottedOwl",
  "spraguesPipit", "tuftedTitmouse", "whoopingCrane", "woodStork",
];

describe("catálogo de cartas frente a la lista oficial", () => {
  it("las 170 aves del juego base están", () => {
    expect(Object.keys(speciesCards)).toHaveLength(170);
  });

  it("los poderes blancos se resuelven al jugar el ave (onPlay), una sola vez", () => {
    const wrong = WHITE_POWER_BIRDS.filter((id) => speciesCards[id].powers.some((power) => power.timing !== "onPlay"));
    expect(wrong).toEqual([]);
    for (const id of WHITE_POWER_BIRDS) expect(speciesCards[id].powers.length, id).toBeGreaterThan(0);
  });

  it("ninguna otra ave tiene poderes al jugar", () => {
    const unexpected = Object.values(speciesCards)
      .filter((card) => !WHITE_POWER_BIRDS.includes(card.id) && card.powers.some((power) => power.timing === "onPlay"))
      .map((card) => card.id);
    expect(unexpected).toEqual([]);
  });

  it("el Vireo Ojirrojo cuesta 1 insecto O 1 fruta, no las dos", () => {
    expect(speciesCards.redEyedVireo.cost).toEqual({});
    expect(speciesCards.redEyedVireo.costAnyOf).toEqual(["insect", "fruit"]);
  });

  it("están las 26 cartas de bonificación del juego base, con puntuación definida", () => {
    expect(Object.keys(bonusCardsCatalog)).toHaveLength(26);
    for (const bonus of Object.values(bonusCardsCatalog)) {
      const scored = bonus.scoringMode === "perBird" ? (bonus.pointsPerBird ?? 0) > 0 : (bonus.tiers?.length ?? 0) > 0;
      expect(scored, bonus.id).toBe(true);
    }
  });
});
