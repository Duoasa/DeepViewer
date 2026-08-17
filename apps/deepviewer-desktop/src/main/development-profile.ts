import { join } from 'node:path'

export const DEEPVIEWER_DEVELOPMENT_PROFILE = 'development'
export const DEEPVIEWER_DEVELOPMENT_APP_NAME = 'DeepViewer Dev'

interface DevelopmentProfileApp {
  getName(): string
  getPath(name: 'appData'): string
  setPath(name: 'userData', path: string): void
}

export function shouldUseDevelopmentProfile(
  initialAppName: string,
  requestedProfile: string | undefined,
): boolean {
  return requestedProfile === DEEPVIEWER_DEVELOPMENT_PROFILE
    || initialAppName === DEEPVIEWER_DEVELOPMENT_APP_NAME
}

export function resolveDevelopmentUserDataPath(appDataPath: string): string {
  return join(appDataPath, DEEPVIEWER_DEVELOPMENT_APP_NAME)
}

export function configureDevelopmentProfile(
  electronApp: DevelopmentProfileApp,
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!shouldUseDevelopmentProfile(electronApp.getName(), environment.DEEPVIEWER_PROFILE)) {
    return false
  }
  electronApp.setPath(
    'userData',
    resolveDevelopmentUserDataPath(electronApp.getPath('appData')),
  )
  return true
}
