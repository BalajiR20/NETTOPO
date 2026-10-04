import type { Edge, Node } from '@xyflow/react'
import type { SchematicComponent, SchematicMarker } from '@/domain/schematic/types'
import type { DisplayOptions, InteractionMode } from '@/store/uiStore'

export type HighlightRole = 'none' | 'primary' | 'agree' | 'oppose' | 'side-from' | 'side-to'

export interface ComponentNodeData extends Record<string, unknown> {
  comp: SchematicComponent
  branchIndex: number
  fromLabel: string
  toLabel: string
  quantities: { i: number; v: number; p: number; relI: number } | null
  highlight: HighlightRole
  treeRole: 'twig' | 'link' | null
  cycle: boolean
  hasError: boolean
  display: DisplayOptions
  mode: InteractionMode
  precision: number
}

export interface MarkerNodeData extends Record<string, unknown> {
  marker: SchematicMarker
  netLabel: string
  isReference: boolean
  highlight: HighlightRole
  voltage: number | null
  showVoltage: boolean
  mode: InteractionMode
  floating: boolean
  precision: number
}

export interface GroundNodeData extends Record<string, unknown> {
  isReference: boolean
  highlight: HighlightRole
  mode: InteractionMode
}

export interface WireEdgeData extends Record<string, unknown> {
  highlight: HighlightRole
  isReference: boolean
}

export type ComponentFlowNode = Node<ComponentNodeData, 'component'>
export type MarkerFlowNode = Node<MarkerNodeData, 'marker'>
export type GroundFlowNode = Node<GroundNodeData, 'ground'>
export type FlowNode = ComponentFlowNode | MarkerFlowNode | GroundFlowNode
export type WireFlowEdge = Edge<WireEdgeData, 'wire'>
