/**
 * App shell — global providers + a full-bleed surface.
 *
 * No global top bar: each surface (lobby, room) renders its own minimal,
 * contextual chrome. Generouted renders this around all routes.
 */

import { Suspense, type ReactNode } from 'react'
import { Outlet, useRouteError } from 'react-router-dom'
import { DeepSpaceAuthProvider, useAuthStatus } from 'deepspace'
import { RecordProvider, RecordScope } from 'deepspace'
import { ErrorScreen, ToastProvider } from '../components/ui'
import { APP_NAME, SCOPE_ID } from '../constants'
import { appSchemas } from '../schemas'

export default function App() {
  return (
    <ToastProvider>
      <DeepSpaceAuthProvider>
        <AuthBoot>
          {/* data-testid="app-root" is the canonical "app shell mounted" hook. */}
          <div data-testid="app-root" className="h-screen overflow-hidden bg-background text-foreground antialiased">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Loading…
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </AuthBoot>
      </DeepSpaceAuthProvider>
    </ToastProvider>
  )
}

export function Catch() {
  const error = useRouteError()
  return <ErrorScreen error={error} />
}

/** Waits for auth to resolve, then mounts the data layer. */
function AuthBoot({ children }: { children: ReactNode }) {
  const { isLoaded } = useAuthStatus()

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  return (
    <RecordProvider allowAnonymous>
      <RecordScope roomId={SCOPE_ID} schemas={appSchemas} appId={APP_NAME}>
        {children}
      </RecordScope>
    </RecordProvider>
  )
}
