import type { GameAction } from "../../model/actions";
import type { PlayerObservation } from "../../model/observation";

export function scoreTeamRocketNidokingAction(action: GameAction, observation: PlayerObservation): number {
  const text = action.description;
  if (action.type === "attack") { if (text.includes("Kingly Impact")) return 2_150; if (text.includes("Tainted Horn")) return 2_050; if (text.includes("Horn Rend")) return 1_750; if (text.includes("Cruel Arrow")) return 1_650; if (text.includes("Mind Bend")) return 1_450; return 1_250; }
  if (action.type === "evolve") return text.includes("Nidoking") ? 2_000 : text.includes("Nidorino") ? 1_800 : 1_300;
  if (action.type === "use-stadium") return text.includes("Factory") ? 1_950 : 1_300;
  if (action.type === "use-ability") { if (text.includes("Flip the Script")) return 1_850; if (text.includes("Adrena-Brain")) return 1_750; if (text.includes("Subjugating Chains")) return 1_600; }
  if (action.type === "play-trainer") {
    if (/Rare Candy/.test(text)) return 2_100;
    if (/Team Rocket's Proton/.test(text)) return observation.turn <= 2 ? 2_050 : 1_600;
    if (/Buddy-Buddy Poffin/.test(text)) return observation.self.bench.length < 2 ? 1_950 : 1_200;
    if (/Team Rocket's Factory/.test(text)) return 1_900;
    if (/Team Rocket's Transceiver|Team Rocket's Petrel/.test(text)) return 1_750;
    if (/Team Rocket's Ariana/.test(text)) return observation.self.hand instanceof Array && observation.self.hand.length <= 4 ? 1_700 : 800;
    if (/Team Rocket's Archer/.test(text)) return observation.self.hand instanceof Array && observation.self.hand.length <= 4 ? 1_650 : 900;
    if (/Team Rocket's Giovanni/.test(text)) return 1_550;
    if (/Earthen Vessel/.test(text)) return 1_500;
    if (/Nest Ball|Ultra Ball/.test(text)) return 1_450;
    if (/Super Rod|Night Stretcher/.test(text)) return observation.self.discard.length ? 1_300 : 100;
    return 1_000;
  }
  if (action.type === "attach-energy") { if (text.includes("Nidoking")) return 1_950; if (text.includes("Nidorino")) return 1_800; if (text.includes("Nidoran")) return 1_650; if (text.includes("Munkidori")) return 1_400; return 900; }
  if (action.type === "bench-basic") { if (text.includes("Nidoran")) return 1_900; if (text.includes("Fezandipiti")) return 1_450; if (text.includes("Munkidori")) return 1_350; return observation.self.bench.length < 3 ? 1_300 : 250; }
  if (action.type === "select-effect-mode") return Number(action.mode) === 3 ? 17_800 : 17_500;
  return 0;
}
