#!/usr/bin/env node
/**
 * Build both halves of the plugin with esbuild.
 *
 *   lib/index.js   host half — ESM, `@deepseek-ai/*` and node builtins external
 *   lib/client.js  client half — one `window.__ModuleLoader__.load({ id, factory })`
 *                  unit whose factory receives the platform `require`; CSS modules
 *                  are hashed, inlined and injected once per document.
 *
 * The DSH client loader resolves only `react`, `react/jsx-runtime` and the
 * platform packages named in `dsh.client.inject`; everything else must be
 * bundled. esbuild is resolved from the nearest node_modules, or from the
 * directory named by $DSH_TOOLCHAIN (a dsh installation works).
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

function loadEsbuild() {
  const anchors = [join(root, 'package.json'), ...(process.env.DSH_TOOLCHAIN ? [join(process.env.DSH_TOOLCHAIN, 'package.json')] : [])]
  for (const anchor of anchors) {
    try {
      return import(pathToFileURL(createRequire(anchor).resolve('esbuild')).href)
    } catch {
      // try the next anchor
    }
  }
  throw new Error('esbuild not found: run `npm install` or set DSH_TOOLCHAIN to a directory whose node_modules holds esbuild')
}
const esbuild = await loadEsbuild()

const outDir = join(root, 'lib')
mkdirSync(outDir, { recursive: true })

// ---------------------------------------------------------------- host half
await esbuild.build({
  entryPoints: [join(root, 'src/index.mjs')],
  outfile: join(outDir, 'index.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  // Everything that is not our own source stays external: the DSH installation supplies
  // `@deepseek-ai/*`, and an accidentally inlined schemastery would not share the host's
  // Schema identity. Node built-ins are external through `platform: node`.
  packages: 'external',
  external: ['@deepseek-ai/*', '@earendil-works/*', 'node:*'],
  sourcemap: true,
  legalComments: 'none',
  banner: { js: `// ${pkg.name} ${pkg.version} — host half` },
})

// -------------------------------------------------------------- client half
/** CSS-modules-lite: hash class names, emit a JS module that injects the sheet once. */
const cssModulesPlugin = {
  name: 'css-modules-lite',
  setup(build) {
    build.onLoad({ filter: /\.module\.css$/ }, (args) => {
      const source = readFileSync(args.path, 'utf8')
      const tag = `${pkg.name}/${relative(root, args.path)}`
      const hash = createHash('sha256').update(tag).digest('base64url').slice(0, 6)
      const names = {}
      const css = source.replace(/\.([A-Za-z_][\w-]*)/gu, (match, name, offset) => {
        // Skip decimals such as `0.5` and property-ish contexts inside braces.
        const before = source.slice(0, offset)
        const depth = (before.match(/\{/gu)?.length ?? 0) - (before.match(/\}/gu)?.length ?? 0)
        if (depth > 0 || /\d$/u.test(before)) return match
        names[name] = `mc${hash}_${name}`
        return `.${names[name]}`
      })
      const contents = `
        const css = ${JSON.stringify(css)};
        const tagId = ${JSON.stringify(tag)};
        if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {
          const tag = document.createElement('style');
          tag.dataset.plugin = ${JSON.stringify(pkg.name)};
          tag.dataset.pluginCss = tagId;
          tag.textContent = css;
          document.head.appendChild(tag);
        }
        export default ${JSON.stringify(names)};
      `
      return { contents, loader: 'js' }
    })
  },
}

const clientInject = pkg.dsh?.client?.inject ?? []
const clientExternals = ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/cordis', ...clientInject.flatMap((name) => [name, `${name}/client`])]

const client = await esbuild.build({
  entryPoints: [join(root, 'src/client/index.ts')],
  outfile: join(outDir, 'client.js'),
  write: false,
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: clientExternals,
  sourcemap: 'external',
  legalComments: 'none',
  plugins: [cssModulesPlugin],
})

const js = client.outputFiles.find((file) => file.path.endsWith('.js'))
const map = client.outputFiles.find((file) => file.path.endsWith('.map'))
const wrapped = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(pkg.name)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
${js.text}
\t\treturn module.exports;
\t}
});

//# sourceMappingURL=client.js.map
`
writeFileSync(join(outDir, 'client.js'), wrapped)
if (map) writeFileSync(join(outDir, 'client.js.map'), JSON.stringify({ version: 3, file: 'client.js', sections: [{ offset: { line: 5, column: 0 }, map: JSON.parse(map.text) }] }))

// ------------------------------------------------------------ sanity checks
const builtClient = readFileSync(join(outDir, 'client.js'), 'utf8')
const requires = [...builtClient.matchAll(/require\("([^"]+)"\)/gu)].map((match) => match[1])
const unresolvable = requires.filter((specifier) => !clientExternals.includes(specifier))
if (unresolvable.length) throw new Error(`client bundle requires modules the DSH loader cannot serve: ${unresolvable.join(', ')}`)
for (const file of ['lib/index.js', 'lib/client.js', 'cordis.patch.yml', 'LICENSE']) if (!existsSync(join(root, file))) throw new Error(`missing ${file}`)
const builtHost = readFileSync(join(outDir, 'index.js'), 'utf8')
if (/\/\/ node_modules\//u.test(builtHost)) throw new Error('host bundle inlined a dependency; every package must stay external')
console.log(`built ${pkg.name}@${pkg.version}: lib/index.js, lib/client.js (client requires: ${[...new Set(requires)].join(', ')})`)
