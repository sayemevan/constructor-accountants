// Architecture boundary rules (ai-context/03 layer rules, ai-context/23 module registry, ai-context/11 features).
// Run with `pnpm lint:deps` (CI runs it too). When a module or an allowed dependency changes, update
// ai-context/23-module-registry.md and MODULE_DEPS below in the same PR.

/** Core-kind modules: every business module may use them (23: "tenant, auth, … ◄── business modules"). */
const CORE_MODULES = ['tenant', 'auth', 'user', 'authorization', 'audit', 'files'];

/**
 * Extra allowed dependencies per module, beyond apps/api/src/core (always allowed) and, for business modules,
 * CORE_MODULES. Mirrors "Allowed dependencies" in ai-context/23-module-registry.md.
 */
const MODULE_DEPS = {
  // core-kind (may use each other; cycles are still rejected by no-circular)
  tenant: [],
  auth: [],
  user: [],
  authorization: [],
  audit: [],
  files: [],
  notification: ['project'],
  platform: [],
  // business
  party: [],
  project: ['party'],
  contract: ['project', 'party', 'finance'],
  document: [],
  finance: ['project', 'party'],
  employee: ['project'],
  attendance: ['employee', 'project'],
  payroll: ['employee', 'attendance', 'project', 'finance'],
  subcontractor: ['party', 'project', 'finance'],
  machinery: ['project', 'party', 'employee', 'finance'],
  'equipment-rental': ['project', 'party', 'finance'],
  reporting: ['project'],
};
const CORE_KIND = new Set([...CORE_MODULES, 'notification', 'platform']);

const API = '^apps/api/src';
const MOD = `${API}/modules`;
const ALL_MODULES = Object.keys(MODULE_DEPS);
const alt = (names) => names.map((n) => n.replace(/[-]/g, '\\-')).join('|');

const moduleDependencyRules = ALL_MODULES.map((name) => {
  const allowed = new Set([
    name,
    ...MODULE_DEPS[name],
    ...(CORE_KIND.has(name) ? [] : CORE_MODULES),
  ]);
  if (CORE_KIND.has(name)) CORE_MODULES.forEach((m) => allowed.add(m));
  return {
    name: `module-deps-${name}`,
    comment:
      `Module '${name}' may only depend on: ${[...allowed].filter((m) => m !== name).join(', ') || 'core'}. ` +
      'See "Allowed dependencies" in ai-context/23-module-registry.md.',
    severity: 'error',
    from: { path: `${MOD}/${name}/` },
    to: { path: `${MOD}/(?!(?:${alt([...allowed])})/)[^/]+/` },
  };
});

module.exports = {
  forbidden: [
    /* ---------- general ---------- */
    {
      name: 'no-circular',
      comment: 'No dependency cycles, within or between modules (23: "Forbidden: any cycle").',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-legacy',
      comment: 'legacy/ is a frozen prototype; nothing may import it (ADR-0016).',
      severity: 'error',
      from: {},
      to: { path: '^legacy/' },
    },
    {
      name: 'not-to-unresolvable',
      comment: 'Import cannot be resolved on disk — typo, missing dependency or missing build.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'no-non-package-json',
      comment: 'Imported npm package is not declared in the nearest package.json.',
      severity: 'error',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'not-to-dev-dep',
      comment: 'Runtime code must not import devDependencies (tests and tool config may).',
      severity: 'error',
      from: {
        path: '^(apps|packages)/[^/]+/src/',
        // src/testing/ holds integration-test harnesses (Testcontainers); excluded from the build.
        pathNot: ['/__tests__/', '\\.(test|spec)\\.tsx?$', '^apps/api/src/testing/'],
      },
      to: {
        dependencyTypes: ['npm-dev'],
        dependencyTypesNot: ['type-only'],
        pathNot: 'node_modules/@types/',
      },
    },
    {
      name: 'no-cross-app-imports',
      comment:
        'Apps share code only through packages/* (e.g. @repo/contracts), never by importing each other.',
      severity: 'error',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/([^/]+)/', pathNot: '^apps/$1/' },
    },
    {
      name: 'packages-not-to-apps',
      comment: 'Shared packages must not depend on apps.',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },

    /* ---------- API: module boundaries (23) ---------- */
    {
      name: 'module-unregistered',
      comment:
        'Every backend module must be registered in ai-context/23-module-registry.md and in MODULE_DEPS ' +
        'in .dependency-cruiser.cjs before code is added.',
      severity: 'error',
      from: { path: `${MOD}/(?!(?:${alt(ALL_MODULES)})/)[^/]+/` },
      to: {},
    },
    {
      name: 'module-unregistered-orphan',
      comment: 'Same as module-unregistered, for files with no imports at all.',
      severity: 'error',
      from: { path: `${MOD}/(?!(?:${alt(ALL_MODULES)})/)[^/]+/`, orphan: true },
      to: {},
    },
    {
      name: 'module-via-index-only',
      comment: 'Import another module only through its index.ts, never its internals (03).',
      severity: 'error',
      from: { path: `${MOD}/([^/]+)/` },
      to: { path: `${MOD}/([^/]+)/(?!index\\.ts$)`, pathNot: `${MOD}/$1/` },
    },
    {
      name: 'core-not-to-business-modules',
      comment: 'apps/api/src/core is below every module; it may only use core-kind modules (23).',
      severity: 'error',
      from: { path: `${API}/core/` },
      to: { path: `${MOD}/(?!(?:${alt([...CORE_KIND])})/)[^/]+/` },
    },
    ...moduleDependencyRules,

    /* ---------- API: layers inside a module (03) ---------- */
    {
      name: 'domain-is-pure',
      comment: 'domain/ is pure TypeScript: no Nest, Prisma client, HTTP or other layers (03).',
      severity: 'error',
      from: { path: `${MOD}/[^/]+/domain/` },
      to: {
        path: [
          'node_modules/(@nestjs|@prisma/client|@prisma/adapter-pg|express|pg|pino)/',
          `${API}/generated/`,
          `${MOD}/[^/]+/(api|application|infrastructure|events)/`,
          `${API}/core/database/`,
        ],
      },
    },
    {
      name: 'api-layer-not-to-infrastructure',
      comment:
        'Controllers call application services only; never repositories (03: api → application).',
      severity: 'error',
      from: { path: `${MOD}/([^/]+)/api/` },
      to: { path: `${MOD}/$1/infrastructure/` },
    },
    {
      name: 'application-not-to-api',
      comment: 'Layers point inward: application must not import controllers.',
      severity: 'error',
      from: { path: `${MOD}/([^/]+)/application/` },
      to: { path: `${MOD}/$1/api/` },
    },
    {
      name: 'infrastructure-not-upward',
      comment: 'Repositories must not import controllers or application services.',
      severity: 'error',
      from: { path: `${MOD}/([^/]+)/infrastructure/` },
      to: { path: `${MOD}/$1/(api|application)/` },
    },

    /* ---------- Web (11) ---------- */
    {
      name: 'web-feature-isolation',
      comment:
        "A feature must not import another feature's internals; share via components/common (11).",
      severity: 'error',
      from: { path: '^apps/web/src/features/([^/]+)/' },
      to: { path: '^apps/web/src/features/([^/]+)/', pathNot: '^apps/web/src/features/$1/' },
    },
    {
      name: 'web-shared-not-to-features',
      comment: 'components/ and lib/ are shared building blocks; they must not depend on features.',
      severity: 'error',
      from: { path: '^apps/web/src/(components|lib)/' },
      to: { path: '^apps/web/src/features/' },
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules', '^apps/api/src/generated/', '/__tests__/.*/generated/'] },
    exclude: { path: ['(^|/)dist/', '(^|/)\\.next/'] },
    tsPreCompilationDeps: true,
    combinedDependencies: false,
    // Resolves apps/web's `@/*` alias. Its tsconfig `paths` has no baseUrl (deprecated in TS 6), which
    // dependency-cruiser's tsconfig-paths support can only resolve relative to the cwd.
    webpackConfig: { fileName: 'infrastructure/dependency-cruiser/resolve.cjs' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.d.ts'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
