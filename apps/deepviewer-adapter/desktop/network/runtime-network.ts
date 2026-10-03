interface RuntimeLaunchSpec { cwd: string; env: NodeJS.ProcessEnv; fallback?: RuntimeLaunchSpec }
import { proxyEnvironment, hasExplicitProxy } from './policy.js'
import { startNetworkBridge, type BridgeOptions, type NetworkBridge } from './bridge.js'

/** Configure all fallback launches identically without persisting credentials or altering process.env. */
export async function configureRuntimeNetwork(spec: RuntimeLaunchSpec, options: Omit<BridgeOptions, 'proxyEnv'>): Promise<NetworkBridge> {
  const settings = proxyEnvironment(spec.env, spec.cwd, spec.env.DSH_HOME ?? spec.cwd)
  const explicit = hasExplicitProxy(settings)
  const bridge = await startNetworkBridge({ ...options, proxyEnv: settings })
  for (let launch: RuntimeLaunchSpec | undefined = spec; launch; launch = launch.fallback) {
    launch.env = { ...launch.env, DEEPVIEWER_WEB_BRIDGE: bridge.webUrl }
    launch.env.HTTP_PROXY = bridge.proxyUrl
    launch.env.HTTPS_PROXY = bridge.httpsProxyUrl
    launch.env.http_proxy = bridge.proxyUrl
    launch.env.https_proxy = bridge.httpsProxyUrl
  }
  options.log(`NETWORK_READY source=${explicit ? 'explicit' : 'system'} web=desktop-authorized`)
  return bridge
}
