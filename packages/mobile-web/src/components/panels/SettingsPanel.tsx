import React from "react";
import { LoaderCircle } from "lucide-react";
import type { MobileLocale } from "../../i18n/types";
import { useMobileI18n } from "../../i18n/provider";

interface SettingsPanelProps {
  gatewayInput: string;
  accessTokenInput: string;
  connectionStatus: "connecting" | "connected" | "disconnected";
  actionPending: boolean;
  connectionError: string;
  onGatewayInputChange: (value: string) => void;
  onAccessTokenInputChange: (value: string) => void;
  locale: MobileLocale;
  onLocaleChange: (locale: MobileLocale) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  memoryEnabled: boolean;
  memoryFilePath: string;
  memoryContent: string;
  onReloadMemory: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  gatewayInput,
  accessTokenInput,
  connectionStatus,
  actionPending,
  connectionError,
  onGatewayInputChange,
  onAccessTokenInputChange,
  locale,
  onLocaleChange,
  onConnect,
  onDisconnect,
  memoryEnabled,
  memoryFilePath,
  memoryContent,
  onReloadMemory,
}) => {
  const { t } = useMobileI18n();
  const connected = connectionStatus === "connected";
  const connecting = connectionStatus === "connecting" || actionPending;
  const connectionStatusLabel =
    connectionStatus === "connected"
      ? t.common.connect
      : connectionStatus === "connecting"
        ? t.common.connecting
        : t.common.notConnected;

  return (
    <section className="panel-scroll settings-panel">
      <div className="settings-list-flat">
        <section className="settings-item-flat">
          <header className="settings-head-flat">
            <h3>{t.settings.language}</h3>
          </header>
          <p className="settings-hint-flat">{t.settings.languageHint}</p>
          <div className="settings-input-row settings-select-row">
            <select
              value={locale}
              onChange={(event) =>
                onLocaleChange(event.target.value as MobileLocale)
              }
            >
              <option value="en">{t.settings.english}</option>
              <option value="zh-CN">{t.settings.chinese}</option>
            </select>
          </div>
        </section>

        <section className="settings-item-flat">
          <header className="settings-head-flat">
            <h3>{t.settings.gateway}</h3>
            <span className={`conn-status-label-flat ${connectionStatus}`}>
              {connectionStatusLabel}
            </span>
          </header>
          <p className="settings-hint-flat">{t.settings.gatewayHint}</p>
          <div className="settings-input-row">
            <input
              value={gatewayInput}
              onChange={(event) => onGatewayInputChange(event.target.value)}
              placeholder={t.settings.gatewayPlaceholder}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div className="settings-input-row">
            <input
              type="password"
              value={accessTokenInput}
              onChange={(event) => onAccessTokenInputChange(event.target.value)}
              placeholder={t.settings.tokenPlaceholder}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div className="settings-actions-flat">
            {connected ? (
              <button
                type="button"
                className="danger-btn-flat"
                onClick={onDisconnect}
              >
                {t.common.disconnect}
              </button>
            ) : (
              <button
                type="button"
                className="accent-btn-flat"
                onClick={onConnect}
                disabled={connecting}
              >
                {connecting ? (
                  <>
                    <LoaderCircle size={14} className="spin" />
                    {t.common.connecting}
                  </>
                ) : (
                  t.common.connect
                )}
              </button>
            )}
          </div>
          {connectionError ? (
            <p className="settings-error-flat">{connectionError}</p>
          ) : null}
        </section>

        <section className="settings-item-flat">
          <header className="settings-head-flat">
            <h3>{t.settings.memory}</h3>
            <span className="conn-status-label-flat">
              {memoryEnabled ? t.settings.memoryEnabled : t.settings.memoryDisabled}
            </span>
          </header>
          <p className="settings-hint-flat">{t.settings.memoryHint}</p>
          <div className="settings-actions-flat">
            <button
              type="button"
              className="accent-btn-flat"
              onClick={onReloadMemory}
              disabled={!connected}
            >
              {t.settings.memoryReload}
            </button>
          </div>
          <div className="settings-memory-box-flat">
            <div className="settings-memory-label-flat">{t.settings.memoryPathLabel}</div>
            <div className="settings-memory-path-flat">
              {memoryFilePath || t.common.notConnected}
            </div>
            <div className="settings-memory-label-flat">
              {t.settings.memoryContentLabel}
            </div>
            <textarea
              className="settings-memory-content-flat"
              value={memoryContent}
              readOnly
              spellCheck={false}
            />
            <p className="settings-hint-flat">{t.settings.memoryReadOnlyHint}</p>
          </div>
        </section>
      </div>
    </section>
  );
};
