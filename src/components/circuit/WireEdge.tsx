import { memo } from 'react'
import { BaseEdge, type EdgeProps } from '@xyflow/react'
import { orthogonalPath } from './orthogonalPath'
import type { WireFlowEdge } from './flowTypes'

function WireEdgeImpl({ id, sourceX, sourceY, targetX, targetY, sourcePosition, data, selected }: EdgeProps<WireFlowEdge>) {
  const path = orthogonalPath(sourceX, sourceY, targetX, targetY, sourcePosition)
  const hl = data?.highlight && data.highlight !== 'none'
  const color = data?.isReference ? 'var(--nt-ref)' : hl ? 'var(--nt-highlight)' : selected ? 'var(--nt-highlight)' : 'var(--nt-wire)'
  return (
    <>
      {hl && <path d={path} stroke="var(--nt-highlight)" strokeOpacity={0.22} strokeWidth={9} fill="none" />}
      <BaseEdge id={id} path={path} interactionWidth={14} style={{ stroke: color, strokeWidth: hl || selected ? 2.5 : 1.75, strokeDasharray: selected ? '5 3' : undefined }} />
    </>
  )
}

export const WireEdge = memo(WireEdgeImpl)
