import { Component, type ErrorInfo, type ReactNode } from 'react'
import i18n from '@/i18n'

interface Props {
  children: ReactNode
  /** Where the boundary sits, so a report says which surface broke. */
  scope?: string
}

interface State {
  error: Error | null
}

/**
 * App-level render-error boundary (D-102).
 *
 * Before this existed, any throw during render — a missing field on a migrated
 * map, a lazy chunk that failed to load — unmounted the whole tree and left a
 * white page with nothing in the UI to say so. That is the same defect class as
 * a button that does nothing: the user cannot tell "broken" from "empty".
 *
 * It reports rather than swallows: the error and component stack go to the
 * console (where support and the browser-pane checks can read them) and the
 * user gets a stated reason plus two ways out.
 *
 * i18n comes from the imported instance, not `useTranslation` — a class
 * component cannot use hooks, and wrapping it in an HOC would put a function
 * component inside the boundary that the boundary itself cannot protect.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console -- reporting is the point (D-102)
    console.error(
      `[ErrorBoundary${this.props.scope ? `:${this.props.scope}` : ''}]`,
      error,
      info.componentStack,
    )
  }

  private handleRetry = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    // A failed dynamic import() is not a code bug — it is a network or
    // deploy-skew problem, and reloading actually fixes it. Say so.
    const isChunkLoad = /dynamically imported module|Loading chunk|Failed to fetch/i.test(
      error.message,
    )

    return (
      <div
        role="alert"
        data-testid="error-boundary"
        className="mx-auto flex max-w-lg flex-col gap-4 p-8 text-center"
      >
        <h2 className="text-xl font-semibold">
          {i18n.t(isChunkLoad ? 'errors:boundary.chunkTitle' : 'errors:boundary.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {i18n.t(
            isChunkLoad ? 'errors:boundary.chunkDescription' : 'errors:boundary.description',
          )}
        </p>
        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
          {error.message}
        </pre>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
          >
            {i18n.t('common:actions.retry')}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {i18n.t('errors:boundary.reload')}
          </button>
        </div>
      </div>
    )
  }
}
