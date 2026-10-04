import { z } from 'zod'
import { METHOD_IDS, type MethodId } from '@/domain/analysis/types'
import { schematicSchema, type Schematic } from '@/domain/schematic/types'

/**
 * Native project file (.nettopo). Versioned; `migrateProject()` upgrades older
 * versions before validation. The `network` key stores the editable circuit
 * (schematic); the oriented graph is always re-derived from it.
 */
export const CURRENT_SCHEMA_VERSION = 1
export const FILE_EXTENSION = '.nettopo'

export const projectMetaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(4000).default(''),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const analysisConfigSchema = z.object({
  method: z.enum(METHOD_IDS).nullable(),
  referenceNodeId: z.string().nullable(),
  treeBranchIds: z.array(z.string()),
})

export const projectFileSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  app: z.literal('nettopo'),
  project: projectMetaSchema,
  network: schematicSchema,
  analysis: analysisConfigSchema,
})

export type ProjectMeta = z.infer<typeof projectMetaSchema>
export type ProjectFile = z.infer<typeof projectFileSchema>

export function serializeProject(meta: ProjectMeta, schematic: Schematic, analysis: { method: MethodId | null; referenceNodeId: string | null; treeBranchIds: string[] }): ProjectFile {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, app: 'nettopo', project: meta, network: schematic, analysis }
}

/** Upgrades older file versions. Version 1 is current; future versions add cases here. */
export function migrateProject(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const v = (raw as { schemaVersion?: unknown }).schemaVersion
  if (v === CURRENT_SCHEMA_VERSION) return raw
  return raw
}

export type ParseResult = { ok: true; file: ProjectFile } | { ok: false; errors: string[] }

export function parseProjectFile(input: unknown): ParseResult {
  let data = input
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input)
    } catch (e) {
      return { ok: false, errors: [`The file is not valid JSON: ${(e as Error).message}`] }
    }
  }
  const version = (data as { schemaVersion?: unknown } | null)?.schemaVersion
  if (typeof version === 'number' && version > CURRENT_SCHEMA_VERSION) {
    return { ok: false, errors: [`This file was written by a newer NETTOPO (schema ${version}); this version reads schema ${CURRENT_SCHEMA_VERSION}.`] }
  }
  const parsed = projectFileSchema.safeParse(migrateProject(data))
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, 8).map((i) => `${i.path.length ? i.path.join('.') + ': ' : ''}${i.message}`),
    }
  }
  return { ok: true, file: parsed.data }
}
