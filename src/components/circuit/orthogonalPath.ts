import { Position } from '@xyflow/react'

/** Orthogonal (Manhattan) wire: leaves each pin along its handle direction. */
export function orthogonalPath(sx: number, sy: number, tx: number, ty: number, sp: Position): string {
  if (Math.abs(sx - tx) < 0.5 || Math.abs(sy - ty) < 0.5) return `M ${sx} ${sy} L ${tx} ${ty}`
  const horizontalFirst = sp === Position.Left || sp === Position.Right
  return horizontalFirst ? `M ${sx} ${sy} L ${tx} ${sy} L ${tx} ${ty}` : `M ${sx} ${sy} L ${sx} ${ty} L ${tx} ${ty}`
}
