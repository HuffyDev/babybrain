import type { TimelineStep } from "../../../shared/types";
import { emit } from "../events";

// Step-2 placeholder: real handlers arrive in step 4.
export async function runStepTask(step: TimelineStep) {
  await emit({ type: "SYSTEM", source: "SYSTEM", message: `task ${step.task} (no handler yet)` });
}
