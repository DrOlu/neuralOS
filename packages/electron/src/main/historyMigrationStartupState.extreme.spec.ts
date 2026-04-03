import type { HistoryMigrationState } from "../../../backend/src/services/history/HistoryStorageMigration";
import {
  buildHistoryStartupErrorState,
  buildReadyHistoryStartupState,
  INITIAL_HISTORY_STARTUP_STATE,
  normalizeHistoryMigrationStateForStartupBarrier,
} from "./historyMigrationStartupState";

const assertEqual = <T>(actual: T, expected: T, message: string): void => {
  if (actual !== expected) {
    throw new Error(
      `${message}. expected=${String(expected)} actual=${String(actual)}`,
    );
  }
};

const assertCondition = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const runCase = (name: string, fn: () => void): void => {
  fn();
  console.log(`PASS ${name}`);
};

const createState = (
  overrides?: Partial<HistoryMigrationState>,
): HistoryMigrationState => ({
  status: "running",
  ready: false,
  active: true,
  blocking: false,
  detectedLegacy: false,
  phase: "detecting",
  title: "Preparing history storage",
  message: "Checking stored conversations.",
  completedUnits: 0,
  totalUnits: 0,
  percent: 0,
  ...overrides,
});

runCase(
  "initial startup state keeps the blocker active before migration begins",
  () => {
    assertEqual(
      INITIAL_HISTORY_STARTUP_STATE.blocking,
      true,
      "startup barrier should be active before initialization settles",
    );
    assertEqual(
      INITIAL_HISTORY_STARTUP_STATE.ready,
      false,
      "startup barrier should not report ready before initialization settles",
    );
  },
);

runCase(
  "completed migration stays blocking until the rest of startup finishes",
  () => {
    const normalized = normalizeHistoryMigrationStateForStartupBarrier(
      createState({
        status: "done",
        ready: true,
        active: false,
        blocking: false,
        phase: "done",
        completedUnits: 0,
        totalUnits: 0,
        percent: 100,
      }),
    );

    assertEqual(
      normalized.status,
      "running",
      "successful migration should stay in a running startup phase until startup settles",
    );
    assertEqual(
      normalized.phase,
      "finalizing",
      "successful migration should transition into startup finalization",
    );
    assertEqual(
      normalized.blocking,
      true,
      "startup blocker should remain active until initialization settles",
    );
    assertEqual(
      normalized.ready,
      false,
      "ready should remain false until the full startup barrier completes",
    );
    assertCondition(
      normalized.message.includes("Finishing application startup."),
      "finalizing message should explain why the blocker remains visible",
    );
  },
);

runCase(
  "startup ready state clears the blocker and publishes a done state",
  () => {
    const readyState = buildReadyHistoryStartupState(
      createState({
        status: "running",
        ready: false,
        active: false,
        blocking: true,
        detectedLegacy: true,
        phase: "finalizing",
        completedUnits: 1,
        totalUnits: 1,
        percent: 100,
      }),
    );

    assertEqual(readyState.status, "done", "ready state should be done");
    assertEqual(readyState.ready, true, "ready state should report readiness");
    assertEqual(
      readyState.blocking,
      false,
      "startup blocker should clear once startup is complete",
    );
    assertEqual(
      readyState.message,
      "Conversation history migration finished.",
      "ready message should retain legacy migration context",
    );
  },
);

runCase("startup failure forces a blocking error state", () => {
  const errorState = buildHistoryStartupErrorState(
    createState({
      detectedLegacy: true,
      phase: "finalizing",
    }),
    new Error("sqlite open failed"),
    {
      title: "Application startup failed",
      message:
        "GyShell could not finish startup after preparing history storage.",
    },
  );

  assertEqual(
    errorState.status,
    "error",
    "startup failure should produce an error state",
  );
  assertEqual(
    errorState.blocking,
    true,
    "error state should keep the blocker visible",
  );
  assertEqual(
    errorState.ready,
    false,
    "error state should not report readiness",
  );
  assertEqual(
    errorState.error,
    "sqlite open failed",
    "error state should surface the underlying startup failure",
  );
  assertEqual(
    errorState.message,
    "GyShell could not finish startup after preparing history storage.",
    "error message should reflect the mapped startup failure",
  );
});

console.log("All history migration startup state extreme tests passed.");
