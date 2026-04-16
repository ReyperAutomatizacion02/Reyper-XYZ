// Barrel re-export — all consumers keep their existing import paths unchanged.
// Implementation has been split into focused sub-modules under lib/scheduling/.
export * from "./scheduling/types";
export * from "./scheduling/work-shifts";
export * from "./scheduling/planner";
export * from "./scheduling/cascade";
