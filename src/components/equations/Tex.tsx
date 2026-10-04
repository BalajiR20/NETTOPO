import { memo, useMemo } from 'react'
import katex from 'katex'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/uiStore'

interface TexProps {
  latex: string
  display?: boolean
  className?: string
  /** Accessible text alternative. */
  label?: string
  /** When false, variable clicks do nothing. */
  interactive?: boolean
}

function render(latex: string, display: boolean): { html: string; error: string | null } {
  try {
    return {
      html: katex.renderToString(latex, {
        displayMode: display,
        throwOnError: true,
        strict: false,
        trust: (ctx) => ctx.command === '\\htmlData',
        output: 'htmlAndMathml',
      }),
      error: null,
    }
  } catch (e) {
    return { html: '', error: (e as Error).message }
  }
}

/**
 * KaTeX renderer. Variables emitted as \htmlData{ref=b3}{i_{3}} become
 * clickable: a click highlights the referenced branch/node/loop everywhere.
 */
function TexImpl({ latex, display = false, className, label, interactive = true }: TexProps) {
  const { html, error } = useMemo(() => render(latex, display), [latex, display])
  if (error) {
    return (
      <code className="text-xs text-fail" title={error}>
        {latex}
      </code>
    )
  }
  return (
    <span
      className={cn('nt-tex', display ? 'block overflow-x-auto overflow-y-hidden' : 'inline-block', className)}
      aria-label={label}
      onClick={
        interactive
          ? (e) => {
              const el = (e.target as HTMLElement).closest('[data-ref]') as HTMLElement | null
              const token = el?.dataset.ref
              if (token) {
                e.stopPropagation()
                useUiStore.getState().toggleHighlight({ token, source: 'equation' })
              }
            }
          : undefined
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export const Tex = memo(TexImpl)

/** Injects CSS that highlights every rendered variable referring to the active token. */
export function TexHighlightStyle() {
  const token = useUiStore((s) => s.highlight?.token)
  if (!token || !/^[bnlt]\d+$/.test(token)) return null
  return (
    <style>{`.nt-tex [data-ref="${token}"]{background:color-mix(in oklch,var(--nt-highlight) 32%,transparent);outline:1.5px solid var(--nt-highlight);}`}</style>
  )
}
