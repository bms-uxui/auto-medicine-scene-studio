import { Component, type ReactNode } from 'react'
import { useStudio } from './store'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  label?: string
}

interface State {
  error: Error | null
}

/**
 * Keeps one broken actor from taking the whole WebGL scene down. Anything thrown
 * below this boundary is reported to the studio status bar and replaced by `fallback`.
 */
export class ActorErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(`[studio] ${this.props.label ?? 'actor'} failed:`, error)
    useStudio.getState().set('lastError', `${this.props.label ?? 'actor'}: ${error.message}`)
  }

  render() {
    if (this.state.error) return this.props.fallback ?? null
    return this.props.children
  }
}
