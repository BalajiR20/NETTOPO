import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ELEMENT_DESCRIPTORS } from '@/domain/elements'
import { pinADirection } from '@/domain/schematic/geometry'
import type { Rotation } from '@/domain/schematic/types'
import { formatSI, formatValue } from '@/engine/numerical'
import { ORIENTATION_ARROW, SYMBOL_PATHS } from '@/lib/symbols'
import { cn } from '@/lib/utils'
import { subscript as sub } from '@/engine/solvers/common/model'
import type { ComponentFlowNode } from './flowTypes'


function pinPositions(rot: Rotation): { a: Position; b: Position } {
  switch (rot) {
    case 0:
      return { a: Position.Left, b: Position.Right }
    case 90:
      return { a: Position.Top, b: Position.Bottom }
    case 180:
      return { a: Position.Right, b: Position.Left }
    case 270:
      return { a: Position.Bottom, b: Position.Top }
  }
}

/** Screen arrow for a direction vector. */
const arrowFor = (x: number, y: number) => (x > 0 ? '→' : x < 0 ? '←' : y > 0 ? '↓' : '↑')

function ComponentNodeImpl({ data, selected }: NodeProps<ComponentFlowNode>) {
  const { comp, quantities, display, highlight, treeRole } = data
  const rot = comp.rotation
  const horizontal = rot === 0 || rot === 180
  const pins = pinPositions(rot)
  const desc = ELEMENT_DESCRIPTORS[comp.kind]
  const sym = SYMBOL_PATHS[comp.kind]
  // Reference direction on screen: pin a → pin b unless reversed.
  const dA = pinADirection(rot)
  const ref = comp.reversed ? dA : { x: -dA.x, y: -dA.y }
  const k = data.branchIndex
  const strokeVar =
    highlight !== 'none'
      ? 'var(--nt-highlight)'
      : treeRole === 'twig'
          ? 'var(--nt-twig)'
          : treeRole === 'link'
            ? 'var(--nt-link)'
            : 'var(--nt-symbol)'
  const strokeWidth = highlight !== 'none' || treeRole === 'twig' ? 3 : 2
  const dashed = treeRole === 'link' && highlight === 'none'

  const flowDir = quantities && quantities.i !== 0 ? (quantities.i > 0 ? 1 : -1) * (comp.reversed ? -1 : 1) : 0
  const flowDuration = quantities ? 2.4 - 1.8 * Math.min(1, quantities.relI) : 2

  const iText = quantities ? `i${sub(k)} = ${formatSI(quantities.i, 'A', data.precision - 1)}` : null
  const vText = quantities ? `v${sub(k)} = ${formatSI(quantities.v, 'V', data.precision - 1)}` : null
  const pText = quantities ? `P = ${formatSI(Math.abs(quantities.p), 'W', data.precision - 1)} ${quantities.p > 0 ? 'abs.' : quantities.p < 0 ? 'del.' : ''}` : null
  const actual = quantities && quantities.i < 0 ? arrowFor(-ref.x, -ref.y) : null

  // Label placement: above/below for horizontal, left/right for vertical.
  const topLabel = horizontal ? 'left-1/2 -translate-x-1/2 bottom-full mb-1 items-center' : 'right-full mr-2 top-1/2 -translate-y-1/2 items-end'
  const bottomLabel = horizontal ? 'left-1/2 -translate-x-1/2 top-full mt-1 items-center' : 'left-full ml-2 top-1/2 -translate-y-1/2 items-start'

  return (
    <div
      className={cn('relative', data.mode === 'tree' && 'cursor-pointer')}
      style={{ width: horizontal ? 80 : 40, height: horizontal ? 40 : 80 }}
      role="img"
      aria-label={`${desc.name} ${comp.label}, branch b${k} from node ${data.fromLabel} to node ${data.toLabel}, value ${formatValue(comp.value, desc.unit)}${treeRole ? `, ${treeRole}` : ''}${quantities ? `, current ${formatSI(quantities.i, 'A', 4)}, voltage ${formatSI(quantities.v, 'V', 4)}` : ''}`}
    >
      <svg
        className="absolute overflow-visible"
        style={{ left: horizontal ? 40 : 20, top: horizontal ? 20 : 40, width: 1, height: 1 }}
        aria-hidden
      >
        <g transform={`rotate(${rot})`}>
          {(selected || data.hasError || data.cycle) && (
            <rect
              x={-46}
              y={-24}
              width={92}
              height={48}
              rx={6}
              fill="none"
              stroke={data.hasError || data.cycle ? 'var(--nt-fail)' : 'var(--nt-highlight)'}
              strokeDasharray="3 3"
              strokeWidth={1.25}
            />
          )}
          {highlight !== 'none' && <path d={sym.stroke} stroke="var(--nt-highlight)" strokeOpacity={0.25} strokeWidth={10} fill="none" strokeLinecap="round" />}
          {sym.circle && <circle r={sym.circle.r} fill="var(--nt-canvas)" stroke={strokeVar} strokeWidth={strokeWidth} />}
          <path d={sym.stroke} stroke={strokeVar} strokeWidth={strokeWidth} fill="none" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={dashed ? '6 4' : undefined} />
          {sym.fill && <path d={sym.fill} fill={strokeVar} />}
          {display.flow && flowDir !== 0 && (
            <path
              d={flowDir > 0 ? 'M -40 0 L 40 0' : 'M 40 0 L -40 0'}
              className="nt-flow"
              stroke="var(--nt-current)"
              strokeWidth={3.5}
              strokeLinecap="round"
              fill="none"
              opacity={0.35 + 0.65 * Math.min(1, quantities?.relI ?? 0)}
              style={{ ['--nt-flow-duration' as string]: `${flowDuration}s` }}
            />
          )}
          {display.orientation && (
            <g transform={`translate(0 ${comp.kind === 'resistor' ? -15 : -22}) ${comp.reversed ? 'rotate(180)' : ''}`}>
              <path d={ORIENTATION_ARROW.line} stroke="var(--nt-voltage)" strokeWidth={1.25} />
              <path d={ORIENTATION_ARROW.head} fill="var(--nt-voltage)" />
            </g>
          )}
          {display.voltages && quantities && (
            <g fontSize={11} fill="var(--nt-voltage)" fontFamily="var(--font-mono)">
              <text x={comp.reversed ? 30 : -30} y={14} textAnchor="middle" transform={`rotate(${-rot} ${comp.reversed ? 30 : -30} 10)`}>
                +
              </text>
              <text x={comp.reversed ? -30 : 30} y={14} textAnchor="middle" transform={`rotate(${-rot} ${comp.reversed ? -30 : 30} 10)`}>
                −
              </text>
            </g>
          )}
        </g>
      </svg>

      {(highlight === 'agree' || highlight === 'oppose') && (
        <span
          className="pointer-events-none absolute -right-3 -top-3 z-10 rounded-full bg-accent-hl px-1.5 font-mono text-[10px] font-semibold text-white shadow"
          title={highlight === 'agree' ? 'Orientation agrees with the loop / cut-set (+1)' : 'Orientation opposes the loop / cut-set (−1)'}
        >
          {highlight === 'agree' ? '+1' : '−1'}
        </span>
      )}
      <Handle id="a" type="source" position={pins.a} aria-label={`${comp.label} terminal a`} />
      <Handle id="b" type="source" position={pins.b} aria-label={`${comp.label} terminal b`} />

      {display.values && (
        <div className={cn('pointer-events-none absolute flex flex-col leading-tight whitespace-nowrap', topLabel)}>
          <span className="font-mono text-[11px] text-foreground">
            <span className="font-semibold">{comp.label}</span>
            <span className="text-muted-foreground"> · b{k}</span>
            {treeRole && <span className={cn('ml-1 rounded px-1 text-[9px] uppercase', treeRole === 'twig' ? 'bg-twig/15 text-twig' : 'bg-link/15 text-link')}>{treeRole}</span>}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">{formatValue(comp.value, desc.unit)}</span>
        </div>
      )}
      {quantities && (display.currents || display.voltages || display.power) && (
        <div className={cn('pointer-events-none absolute flex flex-col leading-tight whitespace-nowrap font-mono text-[10.5px]', bottomLabel)}>
          {display.currents && (
            <span className="text-amp">
              {arrowFor(ref.x, ref.y)} {iText}
              {actual && (
                <span className="ml-0.5 rounded bg-amp/15 px-0.5 text-[9.5px]" title={`Negative: the actual current flows ${actual}, opposite to the reference arrow`}>
                  {actual}
                </span>
              )}
            </span>
          )}
          {display.voltages && <span className="text-volt">{vText}</span>}
          {display.power && <span className="text-watt">{pText}</span>}
        </div>
      )}
    </div>
  )
}

export const ComponentNode = memo(ComponentNodeImpl)
