import { describe, it, expect } from "vitest";
import { discriminateRoute } from "../src/route.js";

describe("discriminateRoute", () => {
  describe("Trend", () => {
    it("returns 'Trend' when directional_agreement is +3", () => {
      expect(
        discriminateRoute(3, "up_weak", "up_medium", 0.347, 0.445),
      ).toBe("Trend");
    });

    it("returns 'Trend' when directional_agreement is -3", () => {
      expect(
        discriminateRoute(-3, "down_strong", "down_weak", -0.9, -0.4),
      ).toBe("Trend");
    });

    it("returns 'Trend' regardless of momentum scores when agreement is ±3", () => {
      // Even if c3 outperforms c1, ±3 means Trend — no routing to Reversal
      expect(
        discriminateRoute(3, "up_weak", "up_strong", 0.1, 1.5),
      ).toBe("Trend");
    });
  });

  describe("Reversal", () => {
    it("returns 'Reversal' when agreement=±1, sign flip, and c3 outperforms c1", () => {
      // c1=down(-1), c3=up(+1), c3_momentum > c1_momentum in abs
      expect(
        discriminateRoute(1, "down_weak", "up_strong", -0.2, 0.9),
      ).toBe("Reversal");
    });

    it("returns 'Reversal' for bearish reversal: c1=up, c3=down, c3 outperforms", () => {
      expect(
        discriminateRoute(-1, "up_weak", "down_strong", 0.15, -0.95),
      ).toBe("Reversal");
    });

    it("prioritises Reversal over Pullback when sign flip AND c3 outperforms (acceptance criteria)", () => {
      // agreement=±1, c1 and c3 have opposite signs, c3 abs(momentum) > c1 abs(momentum)
      // This is the critical case where both ±1 conditions could apply
      const result = discriminateRoute(1, "down_medium", "up_strong", -0.3, 0.8);
      expect(result).toBe("Reversal");
      expect(result).not.toBe("Pullback");
    });
  });

  describe("Pullback", () => {
    it("returns 'Pullback' when agreement=±1 and both c1 and c3 are same direction", () => {
      // c1=up(+1), c3=up(+1), one candle disagrees (agreement=1)
      expect(
        discriminateRoute(1, "up_weak", "up_medium", 0.2, 0.35),
      ).toBe("Pullback");
    });

    it("returns 'Pullback' when agreement=-1 and both c1 and c3 are bearish", () => {
      expect(
        discriminateRoute(-1, "down_weak", "down_medium", -0.2, -0.35),
      ).toBe("Pullback");
    });

    it("returns 'Pullback' when sign flip but c3 does NOT outperform c1 (failed reversal)", () => {
      // c1=down(-1), c3=up(+1), but abs(c3_momentum) <= abs(c1_momentum)
      expect(
        discriminateRoute(1, "down_strong", "up_weak", -0.9, 0.15),
      ).toBe("Pullback");
    });

    it("returns 'Pullback' when sign flip and momentum is exactly equal (not strictly greater)", () => {
      expect(
        discriminateRoute(1, "down_medium", "up_medium", -0.5, 0.5),
      ).toBe("Pullback");
    });
  });

  describe("route discrimination order", () => {
    it("never returns Reversal when directional_agreement is ±3", () => {
      const result = discriminateRoute(3, "up_weak", "up_strong", 0.1, 2.0);
      expect(result).toBe("Trend");
      expect(result).not.toBe("Reversal");
    });
  });
});
