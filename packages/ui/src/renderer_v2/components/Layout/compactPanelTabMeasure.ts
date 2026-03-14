import type { PanelKind } from "../../layout";

export interface CompactPanelTabMeasureEntry {
  value: string;
  label: string;
  measureKey?: string;
  leadingMeasureKey?: string;
  trailingMeasureKey?: string;
  hasLeading: boolean;
  hasTrailing: boolean;
  hasClose: boolean;
}

interface CompactPanelTabMeasureSignatureInput {
  panelKind: PanelKind;
  resolvedValue: string;
  activeLabel: string;
  activeMeasureKey?: string;
  activeLeadingMeasureKey?: string;
  activeTrailingMeasureKey?: string;
  hasActiveLeading: boolean;
  hasActiveTrailing: boolean;
  hasTrailingActionRail: boolean;
  entries: CompactPanelTabMeasureEntry[];
}

interface CompactPanelTabMenuScrollbarCompensationInput {
  clientWidth: number;
  offsetWidth: number;
  clientHeight: number;
  scrollHeight: number;
  borderLeftWidth?: number;
  borderRightWidth?: number;
}

const normalizeMeasureToken = (
  explicitKey: string | undefined,
  fallbackToken: string,
): string => explicitKey ?? fallbackToken;

const normalizeFiniteNumber = (
  value: number | undefined,
  fallback = 0,
): number => (Number.isFinite(value) ? Number(value) : fallback);

export const buildCompactPanelTabMeasureSignature = ({
  panelKind,
  resolvedValue,
  activeLabel,
  activeMeasureKey,
  activeLeadingMeasureKey,
  activeTrailingMeasureKey,
  hasActiveLeading,
  hasActiveTrailing,
  hasTrailingActionRail,
  entries,
}: CompactPanelTabMeasureSignatureInput): string => {
  const activeToken = [
    resolvedValue,
    normalizeMeasureToken(activeMeasureKey, activeLabel),
    normalizeMeasureToken(
      activeLeadingMeasureKey,
      hasActiveLeading ? "leading" : "no-leading",
    ),
    normalizeMeasureToken(
      activeTrailingMeasureKey,
      hasActiveTrailing ? "trailing" : "no-trailing",
    ),
    hasTrailingActionRail ? "actions" : "no-actions",
  ].join("\u001f");

  const entryToken = entries
    .map((entry) =>
      [
        entry.value,
        normalizeMeasureToken(entry.measureKey, entry.label),
        normalizeMeasureToken(
          entry.leadingMeasureKey,
          entry.hasLeading ? "leading" : "no-leading",
        ),
        normalizeMeasureToken(
          entry.trailingMeasureKey,
          entry.hasTrailing ? "trailing" : "no-trailing",
        ),
        entry.hasClose ? "close" : "no-close",
      ].join("\u001f"),
    )
    .join("\u001e");

  return [panelKind, activeToken, entryToken].join("\u001d");
};

export const resolveCompactPanelTabMenuScrollbarCompensation = ({
  clientWidth,
  offsetWidth,
  clientHeight,
  scrollHeight,
  borderLeftWidth = 0,
  borderRightWidth = 0,
}: CompactPanelTabMenuScrollbarCompensationInput): number => {
  const resolvedClientHeight = Math.max(0, normalizeFiniteNumber(clientHeight));
  const resolvedScrollHeight = Math.max(0, normalizeFiniteNumber(scrollHeight));

  if (resolvedScrollHeight <= resolvedClientHeight + 1) {
    return 0;
  }

  const resolvedClientWidth = Math.max(0, normalizeFiniteNumber(clientWidth));
  const resolvedOffsetWidth = Math.max(0, normalizeFiniteNumber(offsetWidth));
  const resolvedBorderInlineWidth =
    Math.max(0, normalizeFiniteNumber(borderLeftWidth)) +
    Math.max(0, normalizeFiniteNumber(borderRightWidth));

  return Math.max(
    0,
    Math.ceil(
      resolvedOffsetWidth - resolvedClientWidth - resolvedBorderInlineWidth,
    ),
  );
};
