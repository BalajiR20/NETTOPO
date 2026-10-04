import { useState } from 'react'
import { ArrowLeftRight, Crosshair, MousePointer2, RotateCw, Trash2, Activity } from 'lucide-react'
import { ELEMENT_DESCRIPTORS, validateElementValue } from '@/domain/elements'
import { pinKey } from '@/domain/schematic/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState, KeyValue, SectionTitle } from '@/components/common'
import { formatSI, formatValue } from '@/engine/numerical'
import { useNetwork } from '@/hooks/useNetwork'
import { useResult } from '@/hooks/useResult'
import { useAnalysisStore } from '@/store/analysisStore'
import { useCircuitStore } from '@/store/circuitStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useUiStore } from '@/store/uiStore'
import { parseValue } from '@/lib/parseValue'

function ValueField({ id, kind, value }: { id: string; kind: keyof typeof ELEMENT_DESCRIPTORS; value: number }) {
  const [text, setText] = useState(String(value))
  const parsed = parseValue(text)
  const error = Number.isNaN(parsed) ? 'Enter a number, e.g. 10, 4.7k, 2.2m, −5.' : validateElementValue(kind, parsed)
  const desc = ELEMENT_DESCRIPTORS[kind]
  const commit = () => {
    if (!error && parsed !== value) useCircuitStore.getState().updateComponent(id, { value: parsed })
  }
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`val-${id}`} className="text-xs">
        {desc.quantity} ({desc.unit})
      </Label>
      <Input
        id={`val-${id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setText(String(value))
        }}
        aria-invalid={!!error}
        aria-describedby={`val-help-${id}`}
        className="h-8 font-mono"
        data-testid="value-input"
      />
      <p id={`val-help-${id}`} className={error ? 'text-[11px] text-fail' : 'text-[11px] text-muted-foreground'}>
        {error ?? `${formatValue(value, desc.unit)} · ${desc.polarityNote}`}
      </p>
    </div>
  )
}

function LabelField({ id, label, onCommit }: { id: string; label: string; onCommit: (l: string) => void }) {
  const [text, setText] = useState(label)
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`lbl-${id}`} className="text-xs">
        Label
      </Label>
      <Input
        id={`lbl-${id}`}
        value={text}
        maxLength={40}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text.trim() && text !== label && onCommit(text.trim())}
        onKeyDown={(e) => e.key === 'Enter' && text.trim() && onCommit(text.trim())}
        className="h-8"
      />
    </div>
  )
}

export function PropertiesPanel() {
  const selection = useUiStore((s) => s.selection)
  const schematic = useCircuitStore((s) => s.schematic)
  const net = useNetwork()
  const result = useResult()

  if (selection.length === 0) {
    return (
      <EmptyState title="Nothing selected" icon={<MousePointer2 className="size-6" />}>
        Select a component, node or wire to edit it. Drag components from the toolbox; connect terminals by dragging from one terminal dot to another.
      </EmptyState>
    )
  }
  if (selection.length > 1) {
    return (
      <div className="flex flex-col gap-2 p-3">
        <SectionTitle>{selection.length} items selected</SectionTitle>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => useCircuitStore.getState().rotate(selection)}>
            <RotateCw /> Rotate
          </Button>
          <Button size="sm" variant="destructive" onClick={() => {
            useCircuitStore.getState().deleteItems(selection)
            useUiStore.getState().select([])
          }}>
            <Trash2 /> Delete
          </Button>
        </div>
      </div>
    )
  }
  const id = selection[0]
  const comp = schematic.components.find((c) => c.id === id)
  const marker = schematic.markers.find((m) => m.id === id)
  const ground = schematic.grounds.find((g) => g.id === id)
  const wire = schematic.wires.find((w) => w.id === id)
  const del = () => {
    useCircuitStore.getState().deleteItems([id])
    useUiStore.getState().select([])
  }

  if (comp) {
    const b = net.branches.find((x) => x.id === comp.id)
    const desc = ELEMENT_DESCRIPTORS[comp.kind]
    const lbl = (nid?: string) => net.nodes.find((n) => n.id === nid)?.label ?? '—'
    const q = result?.branches.find((x) => x.branchId === comp.id)
    return (
      <div className="flex flex-col gap-3 p-3" data-testid="properties-component">
        <SectionTitle>
          {desc.name} · branch {b?.label}
        </SectionTitle>
        <LabelField key={`${comp.id}:${comp.label}`} id={comp.id} label={comp.label} onCommit={(l) => useCircuitStore.getState().updateComponent(comp.id, { label: l })} />
        <ValueField key={`${comp.id}:${comp.value}`} id={comp.id} kind={comp.kind} value={comp.value} />
        <div className="flex flex-col gap-1 rounded-md border p-2">
          <KeyValue k="Branch" v={b ? `${b.label} (k = ${b.index})` : '—'} />
          <KeyValue k="Orientation" v={b ? `${lbl(b.fromNode)} → ${lbl(b.toNode)}` : '—'} />
          <KeyValue k="Variables" v={b ? `i${b.index}, v${b.index} (+ at ${lbl(b.fromNode)})` : '—'} />
          {comp.kind !== 'resistor' && b && <KeyValue k="Polarity s" v={b.polarity > 0 ? '+1 (source agrees with branch)' : '−1 (source opposes branch)'} />}
          {q && (
            <>
              <KeyValue k="Current" v={<span className="text-amp">{formatSI(q.current, 'A', 4)}</span>} />
              <KeyValue k="Voltage" v={<span className="text-volt">{formatSI(q.voltage, 'V', 4)}</span>} />
              <KeyValue k="Power" v={<span className="text-watt">{formatSI(q.power, 'W', 4)} {q.power > 0 ? 'absorbed' : q.power < 0 ? 'delivered' : ''}</span>} />
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => useCircuitStore.getState().rotate([comp.id])} title="Rotate (R)">
            <RotateCw /> Rotate
          </Button>
          <Button size="sm" variant="outline" onClick={() => useCircuitStore.getState().reverseOrientation([comp.id])} title="Reverse branch orientation (O)" data-testid="reverse-orientation">
            <ArrowLeftRight /> Reverse orientation
          </Button>
          {q && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                useSimulationStore.getState().setChannel(1, { enabled: true, quantity: 'branch-current', targetId: comp.id, scale: 0 })
                useSimulationStore.getState().setChannel(2, { enabled: true, quantity: 'branch-voltage', targetId: comp.id, scale: 0 })
                useUiStore.getState().setBottomTab('oscilloscope')
              }}
            >
              <Activity /> Probe on scope
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={del} title="Delete (Del)">
            <Trash2 /> Delete
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Reversing the orientation changes only the reference direction of i{b?.index} and the polarity of v{b?.index}. The physical circuit, and every node voltage and power, stays the same.
        </p>
      </div>
    )
  }

  if (marker || ground) {
    const ownerId = (marker ?? ground)!.id
    const node = net.nodes.find((n) => n.pinKeys.includes(pinKey({ ownerId, pin: 'p' })))
    const deg = node ? net.branches.filter((b) => b.fromNode === node.id || b.toNode === node.id).length : 0
    return (
      <div className="flex flex-col gap-3 p-3">
        <SectionTitle>{marker ? (marker.kind === 'node' ? 'Node marker' : 'Junction') : 'Ground'}</SectionTitle>
        {marker && marker.kind === 'node' && <LabelField key={`${marker.id}:${marker.label}`} id={marker.id} label={marker.label} onCommit={(l) => useCircuitStore.getState().updateMarker(marker.id, { label: l })} />}
        <div className="flex flex-col gap-1 rounded-md border p-2">
          <KeyValue k="Network node" v={node?.label ?? '—'} />
          <KeyValue k="Incident branches" v={deg} />
          {result && node && <KeyValue k="Node voltage" v={<span className="text-volt">{formatSI(result.nodeVoltages[node.id] - result.nodeVoltages[result.potentialReferenceNodeId], 'V', 4)}</span>} />}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {node && (
            <Button size="sm" variant="outline" onClick={() => useAnalysisStore.getState().setReference(node.id)}>
              <Crosshair /> Use as reference
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={del}>
            <Trash2 /> Delete
          </Button>
        </div>
        {ground && <p className="text-[11px] text-muted-foreground">All ground symbols belong to one node (GND). A ground is a suggested reference node; you still choose the reference explicitly for nodal analysis.</p>}
      </div>
    )
  }

  if (wire) {
    const node = net.nodes.find((n) => n.pinKeys.includes(pinKey(wire.from)))
    return (
      <div className="flex flex-col gap-3 p-3">
        <SectionTitle>Wire</SectionTitle>
        <p className="text-xs text-muted-foreground">An ideal connection. Wires are not branches: every terminal joined by wires belongs to the same node.</p>
        <KeyValue k="Belongs to node" v={node?.label ?? '—'} />
        <Button size="sm" variant="destructive" onClick={del} className="self-start">
          <Trash2 /> Delete wire
        </Button>
      </div>
    )
  }
  return null
}
