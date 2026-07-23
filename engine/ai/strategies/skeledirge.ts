import type { GameAction } from "../../model/actions";
import type { PlayerObservation } from "../../model/observation";

export function scoreSkeledirgeAction(action: GameAction, observation: PlayerObservation): number {
  const text = action.description;
  if (action.type === "attack") { if (text.includes("Burning Voice")) return 1_850; if (text.includes("Vitality Song")) return 1_500; if (text.includes("Fiery Fighting Spirit") || text.includes("Colorful Palette")) return 1_350; return 1_200; }
  if (action.type === "evolve") return text.includes("Skeledirge") ? 1_750 : text.includes("Crocalor") || text.includes("Armarouge") ? 1_600 : 1_300;
  if (action.type === "use-stadium") return 1_550;
  if (action.type === "use-ability") return text.includes("Elegant Heal") ? 1_450 : text.includes("Fire Off") ? 1_400 : 800;
  if (action.type === "play-trainer") { if (/Nest Ball|Great Ball|Ultra Ball|Jacq/.test(text)) return 1_300; if (/Professor's Research|Youngster|Iono/.test(text) && observation.self.hand instanceof Array && observation.self.hand.length <= 3) return 1_150; if (/Energy Retrieval|Klara/.test(text)) return observation.self.discard.length ? 1_100 : 100; if (/Magma Basin/.test(text)) return 1_500; return 900; }
  if (action.type === "attach-energy") return text.includes("Skeledirge") ? 1_500 : text.includes("Fuecoco") || text.includes("Charcadet") ? 1_250 : 900;
  if (action.type === "bench-basic") return observation.self.bench.length < 3 ? 1_200 : 250;
  return 0;
}
