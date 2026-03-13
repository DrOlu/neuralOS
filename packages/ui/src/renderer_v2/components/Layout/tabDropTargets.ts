import type { LayoutRect } from '../../layout'

export interface MeasuredTabAnchor {
  tabId: string
  rect: Pick<LayoutRect, 'left' | 'top' | 'width' | 'height'>
}

export interface ResolvedTabDropHint {
  anchorTabId: string | null
  position: 'before' | 'after'
  indicatorRect: LayoutRect
}

const TAB_BAR_INDICATOR_INSET_Y = 4
const TAB_BAR_INDICATOR_MIN_HEIGHT = 16
const COMPACT_MENU_INDICATOR_INSET_X = 8
const COMPACT_MENU_INDICATOR_HEIGHT = 2

export const resolveHorizontalTabBarReorderHint = (
  tabBarRect: Pick<LayoutRect, 'left' | 'top' | 'width' | 'height'>,
  tabAnchors: MeasuredTabAnchor[],
  draggingTabId: string,
  clientX: number,
): ResolvedTabDropHint | null => {
  const orderedAnchors = tabAnchors
    .filter((anchor) => anchor.tabId !== draggingTabId)
    .sort((a, b) => a.rect.left - b.rect.left)

  const indicatorTop = tabBarRect.top + TAB_BAR_INDICATOR_INSET_Y
  const indicatorHeight = Math.max(
    TAB_BAR_INDICATOR_MIN_HEIGHT,
    tabBarRect.height - TAB_BAR_INDICATOR_INSET_Y * 2,
  )
  const buildIndicatorRect = (left: number): LayoutRect => ({
    left: Math.round(left - 1),
    top: Math.round(indicatorTop),
    width: 2,
    height: Math.round(indicatorHeight),
  })

  if (orderedAnchors.length === 0) {
    return {
      anchorTabId: null,
      position: 'after',
      indicatorRect: buildIndicatorRect(tabBarRect.left + 8),
    }
  }

  const firstTab = orderedAnchors[0]
  const firstTabMidX = firstTab.rect.left + firstTab.rect.width / 2
  if (clientX <= firstTabMidX) {
    return {
      anchorTabId: firstTab.tabId,
      position: 'before',
      indicatorRect: buildIndicatorRect(firstTab.rect.left),
    }
  }

  const lastTab = orderedAnchors[orderedAnchors.length - 1]
  const lastTabMidX = lastTab.rect.left + lastTab.rect.width / 2
  if (clientX >= lastTabMidX) {
    return {
      anchorTabId: lastTab.tabId,
      position: 'after',
      indicatorRect: buildIndicatorRect(lastTab.rect.left + lastTab.rect.width),
    }
  }

  const beforeTarget = orderedAnchors.find(
    (anchor) => clientX < anchor.rect.left + anchor.rect.width / 2,
  )
  if (!beforeTarget) {
    return {
      anchorTabId: lastTab.tabId,
      position: 'after',
      indicatorRect: buildIndicatorRect(lastTab.rect.left + lastTab.rect.width),
    }
  }

  return {
    anchorTabId: beforeTarget.tabId,
    position: 'before',
    indicatorRect: buildIndicatorRect(beforeTarget.rect.left),
  }
}

export const resolveCompactMenuTabReorderHint = (
  menuTabAnchor: MeasuredTabAnchor,
  draggingTabId: string,
  clientY: number,
): ResolvedTabDropHint | null => {
  if (menuTabAnchor.tabId === draggingTabId) {
    return null
  }

  const { rect } = menuTabAnchor
  const position = clientY < rect.top + rect.height / 2 ? 'before' : 'after'
  const indicatorLeft = rect.left + COMPACT_MENU_INDICATOR_INSET_X
  const indicatorWidth = Math.max(
    16,
    rect.width - COMPACT_MENU_INDICATOR_INSET_X * 2,
  )
  const indicatorTop =
    position === 'before'
      ? rect.top
      : rect.top + rect.height - COMPACT_MENU_INDICATOR_HEIGHT

  return {
    anchorTabId: menuTabAnchor.tabId,
    position,
    indicatorRect: {
      left: Math.round(indicatorLeft),
      top: Math.round(indicatorTop),
      width: Math.round(indicatorWidth),
      height: COMPACT_MENU_INDICATOR_HEIGHT,
    },
  }
}
