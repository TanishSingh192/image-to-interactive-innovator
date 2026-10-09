import { describe, expect, it } from "vitest";
import { evaluateHypothesis, missingIngredients } from "./agent";

describe("evaluateHypothesis", () => {
  it("supports an exact item prediction", () => {
    expect(evaluateHypothesis("tool", "tool")).toBe("supported");
  });

  it("refutes an exact item prediction when a different item is produced", () => {
    expect(evaluateHypothesis("spear", "tool")).toBe("refuted");
  });

  it("evaluates a broad new-item prediction by category", () => {
    expect(evaluateHypothesis("new item", "plank")).toBe("supported");
    expect(evaluateHypothesis("new item", "nothing")).toBe("refuted");
  });

  it("evaluates predictions that describe a full inventory delta", () => {
    expect(evaluateHypothesis("wood -1, stone -1, tool +1", "tool")).toBe("supported");
  });

  it("does not count an unknown prediction as a success or failure", () => {
    expect(evaluateHypothesis("unknown outcome", "tool")).toBe("inconclusive");
  });

  it("normalizes the no-result outcome", () => {
    expect(evaluateHypothesis("nothing happens", "nothing")).toBe("supported");
    expect(evaluateHypothesis("tool", "nothing")).toBe("refuted");
  });
});


describe("missingIngredients", () => {
  it("does not request wood again when the agent already has it", () => {
    expect(missingIngredients({ wood: 3 }, ["wood", "stone"])).toEqual(["stone"]);
  });

  it("accounts for duplicate inputs when planning planks", () => {
    expect(missingIngredients({ wood: 1 }, ["wood", "wood"])).toEqual(["wood"]);
    expect(missingIngredients({ wood: 2 }, ["wood", "wood"])).toEqual([]);
  });

  it("requests all missing materials when inventory is empty", () => {
    expect(missingIngredients({}, ["wood", "stone"])).toEqual(["wood", "stone"]);
  });

  it("uses available inventory without mutating it", () => {
    const inventory = { wood: 1, stone: 0 };
    expect(missingIngredients(inventory, ["wood", "stone"])).toEqual(["stone"]);
    expect(inventory).toEqual({ wood: 1, stone: 0 });
  });
});
