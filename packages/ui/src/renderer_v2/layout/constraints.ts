import {
  CHAT_GRID_TOTAL_ROWS,
  CHAT_MIN_GRID_ROWS,
  MAX_LAYOUT_PANELS,
  MAX_LAYOUT_SPLIT_CHILDREN,
  TECHNICAL_MIN_PANEL_SIZE_PX,
  type DropDirection,
  type LayoutNode,
  type LayoutRect,
  type LayoutSplitNode,
  type LayoutTree,
  type LayoutViewport,
  type NodeMinSize,
  type PanelKind
} from './types'
import { getPanelCount, normalizeSizes } from './tree'

export interface LayoutGeometry {
  nodeRects: Record<string, LayoutRect>
  panelRects: Record<string, LayoutRect>
}

const cloneRect = (rect: LayoutRect): LayoutRect => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height
})

export const getChatMinHeightPx = (viewportHeight: number): number => {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return TECHNICAL_MIN_PANEL_SIZE_PX
  }
  const gridBased = Math.floor((viewportHeight * CHAT_MIN_GRID_ROWS) / CHAT_GRID_TOTAL_ROWS)
  return Math.max(TECHNICAL_MIN_PANEL_SIZE_PX, gridBased)
}

export const getPanelMinHeightPx = (kind: PanelKind, viewportHeight: number): number => {
  if (kind === 'chat') {
    return getChatMinHeightPx(viewportHeight)
  }
  return TECHNICAL_MIN_PANEL_SIZE_PX
}

export const computeNodeMinSize = (node: LayoutNode, viewportHeight: number): NodeMinSize => {
  if (node.type === 'panel') {
    return {
      minWidthPx: TECHNICAL_MIN_PANEL_SIZE_PX,
      minHeightPx: getPanelMinHeightPx(node.panel.kind, viewportHeight)
    }
  }

  const childrenMin = node.children.map((child) => computeNodeMinSize(child, viewportHeight))
  if (node.direction === 'horizontal') {
    return {
      minWidthPx: childrenMin.reduce((sum, child) => sum + child.minWidthPx, 0),
      minHeightPx: childrenMin.reduce((max, child) => Math.max(max, child.minHeightPx), 0)
    }
  }

  return {
    minWidthPx: childrenMin.reduce((max, child) => Math.max(max, child.minWidthPx), 0),
    minHeightPx: childrenMin.reduce((sum, child) => sum + child.minHeightPx, 0)
  }
}

const computeNodeRectsInner = (
  node: LayoutNode,
  rect: LayoutRect,
  nodeRects: Record<string, LayoutRect>,
  panelRects: Record<string, LayoutRect>
): void => {
  nodeRects[node.id] = cloneRect(rect)

  if (node.type === 'panel') {
    panelRects[node.panel.id] = cloneRect(rect)
    return
  }

  const sizes = normalizeSizes(node.sizes, node.children.length)
  const horizontal = node.direction === 'horizontal'
  let cursor = horizontal ? rect.left : rect.top

  node.children.forEach((child, index) => {
    const percentage = sizes[index] ?? 0
    const span = ((horizontal ? rect.width : rect.height) * percentage) / 100
    const childRect: LayoutRect = horizontal
      ? {
          left: cursor,
          top: rect.top,
          width: span,
          height: rect.height
        }
      : {
          left: rect.left,
          top: cursor,
          width: rect.width,
          height: span
        }

    computeNodeRectsInner(child, childRect, nodeRects, panelRects)
    cursor += span
  })
}

export const computeLayoutGeometry = (tree: LayoutTree, viewport: LayoutViewport): LayoutGeometry => {
  const nodeRects: Record<string, LayoutRect> = {}
  const panelRects: Record<string, LayoutRect> = {}
  if (viewport.width <= 0 || viewport.height <= 0) {
    return { nodeRects, panelRects }
  }

  computeNodeRectsInner(
    tree.root,
    {
      left: 0,
      top: 0,
      width: viewport.width,
      height: viewport.height
    },
    nodeRects,
    panelRects
  )

  return {
    nodeRects,
    panelRects
  }
}

export interface LayoutValidationResult {
  valid: boolean
  reason?: string
}

export const validateLayoutTree = (tree: LayoutTree, viewport: LayoutViewport): LayoutValidationResult => {
  if (getPanelCount(tree) > MAX_LAYOUT_PANELS) {
    return {
      valid: false,
      reason: 'panel-count-limit'
    }
  }

  const splitOverflow = (() => {
    const stack: LayoutNode[] = [tree.root]
    while (stack.length > 0) {
      const current = stack.pop()
      if (!current || current.type !== 'split') continue
      if (current.children.length > MAX_LAYOUT_SPLIT_CHILDREN) {
        return current.id
      }
      current.children.forEach((child) => stack.push(child))
    }
    return null
  })()
  if (splitOverflow) {
    return {
      valid: false,
      reason: `split-children-limit:${splitOverflow}`
    }
  }

  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.width <= 0 || viewport.height <= 0) {
    return { valid: true }
  }

  const { panelRects } = computeLayoutGeometry(tree, viewport)
  const panels = Object.values(panelRects)
  if (panels.length === 0) {
    return {
      valid: false,
      reason: 'empty-layout'
    }
  }

  const panelNodes = new Map<string, PanelKind>()
  const collect = (node: LayoutNode): void => {
    if (node.type === 'panel') {
      panelNodes.set(node.panel.id, node.panel.kind)
      return
    }
    node.children.forEach((child) => collect(child))
  }
  collect(tree.root)

  for (const [panelId, rect] of Object.entries(panelRects)) {
    if (rect.width < TECHNICAL_MIN_PANEL_SIZE_PX || rect.height < TECHNICAL_MIN_PANEL_SIZE_PX) {
      return {
        valid: false,
        reason: `panel-too-small:${panelId}`
      }
    }

    const kind = panelNodes.get(panelId)
    if (kind === 'chat') {
      const chatMinHeight = getChatMinHeightPx(viewport.height)
      if (rect.height < chatMinHeight) {
        return {
          valid: false,
          reason: `chat-height-limit:${panelId}`
        }
      }
    }
  }

  return { valid: true }
}

export const computeChildMinSizePercentages = (
  splitNode: LayoutSplitNode,
  parentRect: LayoutRect,
  viewportHeight: number
): number[] => {
  if (splitNode.children.length === 0) return []

  const horizontal = splitNode.direction === 'horizontal'
  const axisSize = horizontal ? parentRect.width : parentRect.height
  if (axisSize <= 0) {
    return Array.from({ length: splitNode.children.length }, () => 0)
  }

  return splitNode.children.map((child) => {
    const childMin = computeNodeMinSize(child, viewportHeight)
    const minPx = horizontal ? childMin.minWidthPx : childMin.minHeightPx
    return Math.max(0, (minPx / axisSize) * 100)
  })
}

export const determineDropDirection = (rect: LayoutRect, clientX: number, clientY: number): DropDirection | null => {
  const x = clientX - rect.left
  const y = clientY - rect.top
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null

  const centerX1 = rect.width * 0.35
  const centerX2 = rect.width * 0.65
  const centerY1 = rect.height * 0.35
  const centerY2 = rect.height * 0.65
  if (x >= centerX1 && x <= centerX2 && y >= centerY1 && y <= centerY2) {
    return 'center'
  }

  const topWeight = y / rect.height
  const bottomWeight = 1 - topWeight
  const leftWeight = x / rect.width
  const rightWeight = 1 - leftWeight

  const min = Math.min(topWeight, bottomWeight, leftWeight, rightWeight)
  if (min === topWeight) return 'top'
  if (min === bottomWeight) return 'bottom'
  if (min === leftWeight) return 'left'
  return 'right'
}
