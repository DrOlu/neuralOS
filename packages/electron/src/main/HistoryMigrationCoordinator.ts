import { BrowserWindow, ipcMain } from "electron";
import type { HistoryMigrationState } from "../../../backend/src/services/history/HistoryStorageMigration";
import {
  buildHistoryStartupErrorState,
  buildReadyHistoryStartupState,
  INITIAL_HISTORY_STARTUP_STATE,
  normalizeHistoryMigrationStateForStartupBarrier,
} from "./historyMigrationStartupState";

export class HistoryMigrationCoordinator {
  private state: HistoryMigrationState = INITIAL_HISTORY_STARTUP_STATE;
  private startupSettled = false;
  private readonly startupPromise: Promise<HistoryMigrationState>;
  private resolveStartup!: (state: HistoryMigrationState) => void;
  private handlersRegistered = false;
  private started = false;

  constructor() {
    this.startupPromise = new Promise((resolve) => {
      this.resolveStartup = resolve;
    });
  }

  registerHandlers(): void {
    if (this.handlersRegistered) {
      return;
    }
    this.handlersRegistered = true;
    ipcMain.handle("historyMigration:getState", () => this.getState());
    ipcMain.handle("historyMigration:waitUntilSettled", async () => {
      return await this.startupPromise;
    });
  }

  getState(): HistoryMigrationState {
    return { ...this.state };
  }

  updateProgressState(state: HistoryMigrationState): void {
    this.state = normalizeHistoryMigrationStateForStartupBarrier(state);
    this.broadcast();
  }

  markReady(): void {
    this.state = buildReadyHistoryStartupState(this.state);
    this.broadcast();
  }

  markError(
    error: unknown,
    options?: {
      title?: string;
      message?: string;
    },
  ): void {
    this.state = buildHistoryStartupErrorState(this.state, error, options);
    this.broadcast();
  }

  run(task: () => Promise<void>): void {
    if (this.started) {
      return;
    }
    this.started = true;
    void (async () => {
      try {
        await task();
      } catch (error) {
        if (this.state.status !== "error") {
          this.markError(error);
        }
        console.error("[Main] Startup initialization failed:", error);
      } finally {
        this.settle();
      }
    })();
  }

  private settle(): void {
    if (this.startupSettled) {
      return;
    }
    this.startupSettled = true;
    this.resolveStartup(this.getState());
  }

  private broadcast(): void {
    BrowserWindow.getAllWindows().forEach((window) => {
      if (window.isDestroyed() || window.webContents.isDestroyed()) {
        return;
      }
      window.webContents.send("historyMigration:state", this.getState());
    });
  }
}
