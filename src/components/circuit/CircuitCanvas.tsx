import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  ReactFlow,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type FinalConnectionState,
  type NodeChange,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import { toast } from 'sonner'
import { componentSize, GRID, snap } from '@/domain/schematic/geometry'
import { pinKey, type PinId } from '@/domain/schematic/types'
import { validateTree } from '@/engine/topology'
import { useNetwork } from '@/hooks/useNetwork'
import { useResolvedHighlight } from '@/hooks/useHighlight'
import { useResult } from '@/hooks/useResult'
import { branchToken, nodeToken } from '@/lib/highlight'
import { uid } from '@/lib/id'
import { cn } from '@/lib/utils'
import { useAnalysisStore } from '@/store/analysisStore'
import { useCircuitStore } from '@/store/circuitStore'
import { useUiStore } from '@/store/uiStore'
import { addItem } from './addItem'
import { canvasApi, DRAG_MIME } from './canvasApi'
import { ComponentNode } from './ComponentNode'
import type { FlowNode, HighlightRole, WireFlowEdge } from './flowTypes'
import { GroundNode, MarkerNode } from './MarkerNode'
import { WireEdge } from './WireEdge'

const nodeTypes: NodeTypes = { component: ComponentNode, marker: MarkerNode, ground: GroundNode } as unknown as NodeTypes
const edgeTypes: EdgeTypes = { wire: WireEdge } as unknown as EdgeTypes

export function CircuitCanvas({ wireTool }: { wireTool: boolean }) {
  const schematic = useCircuitStore((s) => s.schematic)
  const net = useNetwork()
  const result = useResult()
  const hl = useResolvedHighlight()
  const mode = useUiStore((s) => s.mode)
  const selection = useUiStore((s) => s.selection)
  const display = useUiStore((s) => s.display)
  const snapToGrid = useUiStore((s) => s.snapToGrid)
  const showGrid = useUiStore((s) => s.showGrid)
  const precision = useUiStore((s) => s.precision)
  const fitNonce = useUiStore((s) => s.fitViewNonce)
  const method = useAnalysisStore((s) => s.method)
  const referenceNodeId = useAnalysisStore((s) => s.referenceNodeId)
  const treeBranchIds = useAnalysisStore((s) => s.treeBranchIds)
  const rf = useReactFlow()
  const wrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    canvasApi.center = () => {
      const el = wrapper.current
      if (!el) return { x: 0, y: 0 }
      const r = el.getBoundingClientRect()
      return rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
    }
    canvasApi.fitView = () => void rf.fitView({ padding: { top: '90px', bottom: '40px', left: '60px', right: '60px' }, duration: 200 })
    canvasApi.zoomIn = () => void rf.zoomIn({ duration: 150 })
    canvasApi.zoomOut = () => void rf.zoomOut({ duration: 150 })
    canvasApi.element = () => wrapper.current
  }, [rf])

  useEffect(() => {
    if (fitNonce > 0) {
      const t = setTimeout(() => void rf.fitView({ padding: { top: '90px', bottom: '40px', left: '60px', right: '60px' }, duration: 250 }), 30)
      return () => clearTimeout(t)
    }
  }, [fitNonce, rf])

  const pinToNode = useMemo(() => {
    const m = new Map<string, string>()
    for (const n of net.nodes) for (const k of n.pinKeys) m.set(k, n.id)
    return m
  }, [net])

  const showTree = mode === 'tree' || ((method === 'fcircuit' || method === 'loop' || method === 'fcutset' || method === 'nodePair') && treeBranchIds.length > 0)
  const treeSet = useMemo(() => new Set(treeBranchIds), [treeBranchIds])
  const cycleSet = useMemo(() => (mode === 'tree' ? new Set(validateTree(net, treeBranchIds).cycleBranchIds) : new Set<string>()), [mode, net, treeBranchIds])
  const errorComponents = useMemo(() => new Set(net.issues.filter((i) => i.severity === 'error').flatMap((i) => i.componentIds ?? [])), [net])
  const floatingNodes = useMemo(() => new Set(net.issues.filter((i) => i.code === 'floating-node').flatMap((i) => i.nodeIds ?? [])), [net])
  const maxI = useMemo(() => (result ? Math.max(1e-15, ...result.branches.map((q) => Math.abs(q.current))) : 1), [result])
  const selectedSet = useMemo(() => new Set(selection), [selection])

  const nodeRole = useCallback(
    (nodeId: string | undefined): HighlightRole => {
      if (!hl || !nodeId) return 'none'
      if (hl.kind === 'fcutset') return hl.sideFrom?.has(nodeId) ? 'side-from' : hl.sideTo?.has(nodeId) ? 'side-to' : 'none'
      return hl.nodeIds.has(nodeId) ? 'primary' : 'none'
    },
    [hl],
  )

  const nodes: FlowNode[] = useMemo(() => {
    const out: FlowNode[] = []
    const nodeLabel = (id: string | undefined) => net.nodes.find((n) => n.id === id)?.label ?? '?'
    for (const c of schematic.components) {
      const b = net.branches.find((x) => x.id === c.id)
      const q = result?.branches.find((x) => x.branchId === c.id)
      const sign = hl?.signs.get(c.id)
      const role: HighlightRole = !hl || !hl.branchIds.has(c.id) ? 'none' : sign === -1 ? 'oppose' : sign === 1 ? 'agree' : 'primary'
      const size = componentSize(c.rotation)
      out.push({
        id: c.id,
        type: 'component',
        position: c.position,
        width: size.width,
        height: size.height,
        measured: size,
        selected: selectedSet.has(c.id),
        data: {
          comp: c,
          branchIndex: b?.index ?? 0,
          fromLabel: nodeLabel(b?.fromNode),
          toLabel: nodeLabel(b?.toNode),
          quantities: q ? { i: q.current, v: q.voltage, p: q.power, relI: Math.abs(q.current) / maxI } : null,
          highlight: role,
          treeRole: showTree ? (treeSet.has(c.id) ? 'twig' : 'link') : null,
          cycle: cycleSet.has(c.id),
          hasError: errorComponents.has(c.id),
          display,
          mode,
          precision,
        },
      })
    }
    for (const m of schematic.markers) {
      const nid = pinToNode.get(pinKey({ ownerId: m.id, pin: 'p' }))
      const size = m.kind === 'node' ? 16 : 10
      out.push({
        id: m.id,
        type: 'marker',
        position: m.position,
        width: size,
        height: size,
        measured: { width: size, height: size },
        selected: selectedSet.has(m.id),
        data: {
          marker: m,
          netLabel: nodeLabel(nid),
          isReference: !!nid && nid === referenceNodeId,
          highlight: nodeRole(nid),
          voltage: result && nid !== undefined && result.nodeVoltages[nid] !== undefined ? result.nodeVoltages[nid] - (result.nodeVoltages[result.potentialReferenceNodeId] ?? 0) : null,
          showVoltage: display.voltages,
          mode,
          floating: !!nid && floatingNodes.has(nid),
          precision,
        },
      })
    }
    for (const g of schematic.grounds) {
      const nid = pinToNode.get(pinKey({ ownerId: g.id, pin: 'p' }))
      out.push({
        id: g.id,
        type: 'ground',
        position: g.position,
        width: 40,
        height: 40,
        measured: { width: 40, height: 40 },
        selected: selectedSet.has(g.id),
        data: { isReference: !!nid && nid === referenceNodeId, highlight: nodeRole(nid), mode },
      })
    }
    return out
  }, [schematic, net, result, hl, showTree, treeSet, cycleSet, errorComponents, floatingNodes, display, mode, precision, pinToNode, referenceNodeId, nodeRole, maxI, selectedSet])

  const edges: WireFlowEdge[] = useMemo(
    () =>
      schematic.wires.map((w) => {
        const nid = pinToNode.get(pinKey(w.from))
        return {
          id: w.id,
          type: 'wire',
          source: w.from.ownerId,
          sourceHandle: w.from.pin,
          target: w.to.ownerId,
          targetHandle: w.to.pin,
          selected: selectedSet.has(w.id),
          data: { highlight: hl?.kind === 'node' && nid && hl.nodeIds.has(nid) ? 'primary' : 'none', isReference: !!nid && nid === referenceNodeId },
        }
      }),
    [schematic.wires, pinToNode, hl, referenceNodeId, selectedSet],
  )

  /* ------------------------------ changes ------------------------------ */

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    const positions = new Map<string, { x: number; y: number }>()
    let selectionChanged = false
    const sel = new Set(useUiStore.getState().selection)
    for (const ch of changes) {
      if (ch.type === 'position' && ch.position) positions.set(ch.id, ch.position)
      if (ch.type === 'select') {
        selectionChanged = true
        if (ch.selected) sel.add(ch.id)
        else sel.delete(ch.id)
      }
    }
    if (positions.size) {
      useCircuitStore.getState().setLive((s) => ({
        components: s.components.map((c) => (positions.has(c.id) ? { ...c, position: positions.get(c.id)! } : c)),
        markers: s.markers.map((m) => (positions.has(m.id) ? { ...m, position: positions.get(m.id)! } : m)),
        grounds: s.grounds.map((g) => (positions.has(g.id) ? { ...g, position: positions.get(g.id)! } : g)),
        wires: s.wires,
      }))
    }
    if (selectionChanged) useUiStore.getState().select([...sel])
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange<WireFlowEdge>[]) => {
    const sel = new Set(useUiStore.getState().selection)
    let changed = false
    for (const ch of changes) {
      if (ch.type === 'select') {
        changed = true
        if (ch.selected) sel.add(ch.id)
        else sel.delete(ch.id)
      }
    }
    if (changed) useUiStore.getState().select([...sel])
  }, [])

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target) return
    const id = useCircuitStore.getState().addWire({ ownerId: c.source, pin: (c.sourceHandle ?? 'p') as PinId }, { ownerId: c.target, pin: (c.targetHandle ?? 'p') as PinId })
    if (!id) toast.info('Those terminals are already wired.')
  }, [])

  /** Dropping a wire on empty canvas creates a junction there (to route wires). */
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      if (state.isValid || !state.fromHandle || !state.fromNode) return
      const pt = 'changedTouches' in event ? event.changedTouches[0] : (event as MouseEvent)
      const pos = rf.screenToFlowPosition({ x: pt.clientX, y: pt.clientY })
      const from = { ownerId: state.fromNode.id, pin: (state.fromHandle.id ?? 'p') as PinId }
      const jid = uid('j')
      useCircuitStore.getState().commit((s) => ({
        ...s,
        markers: [...s.markers, { id: jid, kind: 'junction', label: '', position: { x: snap(pos.x), y: snap(pos.y) }, order: Math.max(0, ...s.components.map((c) => c.order), ...s.markers.map((m) => m.order), ...s.grounds.map((g) => g.order)) + 1 }],
        wires: [...s.wires, { id: uid('w'), from, to: { ownerId: jid, pin: 'p' } }],
      }))
    },
    [rf],
  )

  /* ------------------------------ clicks ------------------------------ */

  const pickReference = useCallback(
    (ownerId: string) => {
      const nid = pinToNode.get(pinKey({ ownerId, pin: 'p' }))
      if (!nid) return
      useAnalysisStore.getState().setReference(nid)
      useUiStore.getState().setMode('edit')
      toast.success(`Reference node set to ${net.nodes.find((n) => n.id === nid)?.label}.`)
    },
    [pinToNode, net],
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: FlowNode) => {
      const ui = useUiStore.getState()
      if (ui.mode === 'tree') {
        if (node.type === 'component') useAnalysisStore.getState().toggleTwig(node.id)
        else toast.info('In tree-selection mode, click branches (components) to toggle them as twigs.')
        return
      }
      if (ui.mode === 'reference') {
        if (node.type === 'component') toast.info('Click a node dot, ground or wire to choose the reference node.')
        else pickReference(node.id)
        return
      }
      if (node.type === 'component') {
        const t = branchToken(net, node.id)
        if (t) ui.setHighlight({ token: t, source: 'canvas' })
      } else {
        const nid = pinToNode.get(pinKey({ ownerId: node.id, pin: 'p' }))
        const t = nid ? nodeToken(net, nid) : null
        if (t) ui.setHighlight({ token: t, source: 'canvas' })
      }
    },
    [net, pinToNode, pickReference],
  )

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: WireFlowEdge) => {
      const ui = useUiStore.getState()
      const w = schematic.wires.find((x) => x.id === edge.id)
      if (!w) return
      const nid = pinToNode.get(pinKey(w.from))
      if (ui.mode === 'reference' && nid) {
        useAnalysisStore.getState().setReference(nid)
        ui.setMode('edit')
        toast.success(`Reference node set to ${net.nodes.find((n) => n.id === nid)?.label}.`)
        return
      }
      const t = nid ? nodeToken(net, nid) : null
      if (t) ui.setHighlight({ token: t, source: 'canvas' })
    },
    [schematic.wires, pinToNode, net],
  )

  /* ------------------------------ drag & drop ------------------------------ */

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const kind = e.dataTransfer.getData(DRAG_MIME)
      if (!kind) return
      e.preventDefault()
      const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      addItem(kind, pos)
    },
    [rf],
  )

  return (
    <div
      ref={wrapper}
      className={cn('h-full w-full bg-canvas', wireTool && 'nt-wire-tool', mode !== 'edit' && 'ring-2 ring-inset', mode === 'tree' && 'ring-twig/60', mode === 'reference' && 'ring-refnode/60')}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DRAG_MIME)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDrop={onDrop}
      data-testid="circuit-canvas"
    >
      <ReactFlow<FlowNode, WireFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodeOrigin={[0.5, 0.5]}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onNodeDragStart={() => useCircuitStore.getState().beginGesture()}
        onNodeDragStop={() => useCircuitStore.getState().endGesture()}
        onSelectionDragStart={() => useCircuitStore.getState().beginGesture()}
        onSelectionDragStop={() => useCircuitStore.getState().endGesture()}
        onPaneClick={() => {
          useUiStore.getState().setHighlight(null)
          useUiStore.getState().select([])
        }}
        connectionMode={ConnectionMode.Loose}
        connectOnClick
        snapToGrid={snapToGrid}
        snapGrid={[GRID, GRID]}
        deleteKeyCode={null}
        selectionKeyCode="Shift"
        multiSelectionKeyCode={['Meta', 'Control']}
        nodesDraggable={mode === 'edit'}
        nodesConnectable={mode === 'edit'}
        elementsSelectable={mode === 'edit'}
        minZoom={0.2}
        maxZoom={3}
        fitView
        fitViewOptions={{ padding: { top: '90px', bottom: '40px', left: '60px', right: '60px' } }}
        connectionLineStyle={{ stroke: 'var(--nt-highlight)', strokeWidth: 2 }}
        aria-label="Circuit canvas"
      >
        {showGrid && <Background variant={BackgroundVariant.Dots} gap={GRID} size={1.4} color="var(--nt-grid)" />}
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </div>
  )
}

