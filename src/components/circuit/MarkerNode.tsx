import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { formatSI } from '@/engine/numerical'
import { cn } from '@/lib/utils'
import { GROUND_PATH } from '@/lib/symbols'
import type { GroundFlowNode, MarkerFlowNode } from './flowTypes'

const centredHandle = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' } as const

function MarkerNodeImpl({ data, selected }: NodeProps<MarkerFlowNode>) {
  const { marker, isReference, highlight } = data
  const isNode = marker.kind === 'node'
  const size = isNode ? 16 : 10
  const hl = highlight !== 'none'
  const color = isReference ? 'var(--nt-ref)' : hl ? 'var(--nt-highlight)' : data.floating ? 'var(--nt-fail)' : 'var(--nt-wire)'
  const sideTint = highlight === 'side-from' ? 'var(--nt-twig)' : highlight === 'side-to' ? 'var(--nt-link)' : null
  return (
    <div
      className={cn('relative', data.mode === 'reference' && 'cursor-crosshair')}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${isNode ? 'Node' : 'Junction'} ${data.netLabel}${isReference ? ', reference node' : ''}${data.voltage !== null ? `, ${formatSI(data.voltage, 'V', 4)}` : ''}`}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: isNode ? 'var(--nt-canvas)' : color,
          border: isNode ? `2.5px solid ${color}` : undefined,
          boxShadow: sideTint ? `0 0 0 5px color-mix(in oklch, ${sideTint} 35%, transparent)` : hl || selected ? `0 0 0 4px color-mix(in oklch, var(--nt-highlight) 30%, transparent)` : undefined,
        }}
      />
      {isReference && isNode && <div className="absolute -inset-1.5 rounded-full border-2 border-dashed border-refnode" />}
      <Handle id="p" type="source" position={Position.Top} style={{ ...centredHandle, width: isNode ? 8 : 6, height: isNode ? 8 : 6 }} aria-label={`${data.netLabel} connection point`} />
      {isNode && (
        <div className="pointer-events-none absolute left-full top-full ml-0.5 flex flex-col whitespace-nowrap font-mono leading-tight">
          <span className={cn('text-[11px] font-semibold', isReference ? 'text-refnode' : 'text-foreground')}>
            {data.netLabel}
            {isReference && <span className="ml-1 text-[9px] font-normal uppercase">ref</span>}
          </span>
          {data.showVoltage && data.voltage !== null && <span className="text-[10px] text-volt">{formatSI(data.voltage, 'V', data.precision - 1)}</span>}
        </div>
      )}
    </div>
  )
}

export const MarkerNode = memo(MarkerNodeImpl)

function GroundNodeImpl({ data, selected }: NodeProps<GroundFlowNode>) {
  const color = data.isReference ? 'var(--nt-ref)' : data.highlight !== 'none' ? 'var(--nt-highlight)' : 'var(--nt-symbol)'
  return (
    <div className="relative" style={{ width: 40, height: 40 }} role="img" aria-label={`Ground${data.isReference ? ', reference node' : ''}`}>
      <svg className="absolute overflow-visible" style={{ left: 20, top: 20, width: 1, height: 1 }} aria-hidden>
        {selected && <rect x={-20} y={-22} width={40} height={40} rx={4} fill="none" stroke="var(--nt-highlight)" strokeDasharray="3 3" />}
        <path d={GROUND_PATH} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
      </svg>
      <Handle id="p" type="source" position={Position.Top} style={{ left: '50%', top: 0, transform: 'translate(-50%, -50%)' }} aria-label="Ground connection point" />
    </div>
  )
}

export const GroundNode = memo(GroundNodeImpl)
