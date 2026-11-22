import awardsData from "@/data/awards.json";
import { setBundledAwards } from "./awards-history";

// Desktop's boot decision: main.tsx asks for this module at its first line and
// waits for it before the root mounts, so the table is in place for the first
// card as it always was, but loads beside the launch script instead of inside
// it. Keeping the import in a module of its own is also what lets the
// television entry leave 4.2MB out of its graph entirely.
setBundledAwards(awardsData);
