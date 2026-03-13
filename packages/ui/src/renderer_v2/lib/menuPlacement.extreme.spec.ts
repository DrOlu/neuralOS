import {
  resolveAnchoredBelowMenuMaxHeight,
  resolveFloatingMenuPlacement,
} from "./menuPlacement";

const assertEqual = <T>(actual: T, expected: T, message: string): void => {
  if (actual !== expected) {
    throw new Error(
      `${message}. expected=${String(expected)} actual=${String(actual)}`,
    );
  }
};

const runCase = (name: string, fn: () => void): void => {
  fn();
  console.log(`PASS ${name}`);
};

runCase("floating select keeps the menu below when enough space exists", () => {
  const placement = resolveFloatingMenuPlacement({
    anchorRect: { left: 120, top: 120, width: 140, height: 32 },
    menuWidth: 180,
    menuHeight: 160,
    viewportWidth: 900,
    viewportHeight: 700,
  });

  assertEqual(
    placement.direction,
    "below",
    "roomy layouts should keep the menu below the trigger",
  );
  assertEqual(
    placement.top,
    156,
    "below placement should align from the trigger bottom plus the gap",
  );
  assertEqual(
    placement.maxHeight,
    300,
    "below placement should keep the preferred max height when space allows",
  );
});

runCase(
  "floating select flips above when the lower viewport is tighter",
  () => {
    const placement = resolveFloatingMenuPlacement({
      anchorRect: { left: 160, top: 520, width: 160, height: 32 },
      menuWidth: 180,
      menuHeight: 220,
      viewportWidth: 900,
      viewportHeight: 700,
    });

    assertEqual(
      placement.direction,
      "above",
      "tight lower layouts should flip the menu upward",
    );
    assertEqual(
      placement.top,
      216,
      "upward placement should keep the menu bottom aligned above the trigger gap",
    );
    assertEqual(
      placement.maxHeight,
      300,
      "upward placement should still respect the preferred max height when space allows",
    );
  },
);

runCase("floating select clamps width and height inside tiny viewports", () => {
  const placement = resolveFloatingMenuPlacement({
    anchorRect: { left: 180, top: 180, width: 120, height: 28 },
    menuWidth: 260,
    menuHeight: 260,
    viewportWidth: 240,
    viewportHeight: 260,
  });

  assertEqual(
    placement.left,
    8,
    "oversized menus should clamp back to the viewport margin",
  );
  assertEqual(
    placement.maxWidth,
    224,
    "oversized menus should expose the shrunken viewport max width",
  );
  assertEqual(
    placement.maxHeight,
    168,
    "height should shrink to the larger available side when neither side fully fits",
  );
});

runCase(
  "anchored tab menus use only the remaining space below the header",
  () => {
    const maxHeight = resolveAnchoredBelowMenuMaxHeight({
      anchorRect: { top: 602, height: 28 },
      viewportHeight: 700,
    });

    assertEqual(
      maxHeight,
      61,
      "tab menus should stay attached below the header and scroll within the remaining viewport space",
    );
  },
);
