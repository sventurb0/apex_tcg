import type { GameAction } from "../../model/actions";
import type { PlayerObservation } from "../../model/observation";

// Scores only information present in the public player observation. The
// deterministic generic chooser still owns pending-choice selection.
export function scoreOkidogiAction(action: GameAction, observation: PlayerObservation): number {
  const text = action.description;
  if (action.type === "attack") {
    if (text.includes("Chain-Crazed")) return 2_000;
    if (text.includes("Cruel Arrow")) return 1_900;
    if (text.includes("Poisonous Musculature")) return 1_700;
    if (text.includes("Itchy Pollen")) return observation.turn <= 4 ? 1_650 : 1_050;
    if (text.includes("Mind Bend") || text.includes("Poison Chain")) return 1_450;
    return 1_200;
  }
  if (action.type === "use-ability") {
    if (text.includes("Subjugating Chains")) return 1_900;
    if (text.includes("Flip the Script")) return 1_850;
    if (text.includes("Adrena-Brain")) return 1_800;
    if (text.includes("Attract Customers")) return 1_600;
  }
  if (action.type === "play-trainer") {
    if (/Janine's Secret Art/.test(text)) return 1_850;
    if (/Binding Mochi/.test(text)) return 1_800;
    if (/Gravity Mountain/.test(text)) return 1_700;
    if (/Ultra Ball|Master Ball|Poké Pad|Pokégear|Cyrano/.test(text)) return 1_450;
    if (/Lillie's Determination/.test(text) && observation.self.hand instanceof Array && observation.self.hand.length <= 4) return 1_400;
    if (/Boss's Orders/.test(text)) return 1_350;
    if (/Energy Switch/.test(text)) return 1_250;
    if (/Night Stretcher/.test(text)) return observation.self.discard.length ? 1_200 : 100;
    return 1_000;
  }
  if (action.type === "attach-energy") {
    if (text.includes("Okidogi ex")) return 1_700;
    if (text.includes("Munkidori")) return 1_500;
    return 1_100;
  }
  if (action.type === "bench-basic") {
    if (/Okidogi ex|Pecharunt ex/.test(text)) return 1_550;
    if (/Munkidori|Fezandipiti ex/.test(text)) return 1_450;
    if (/Tatsugiri|Budew/.test(text) && observation.turn <= 3) return 1_400;
    return observation.self.bench.length < 3 ? 1_250 : 300;
  }
  return 0;
}
