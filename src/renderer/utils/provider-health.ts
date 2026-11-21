import { getModel } from '@shared/models'
import type { Config, Settings } from '@shared/types'
import type { ModelDependencies } from '@shared/types/adapters'
import { createModelDependencies } from '@/adapters'
import platform from '@/platform'
import { settingsStore } from '@/settings-runtime'

export type HealthStatus = 'alive' | 'dead'

export interface ProviderHealthResult {
  providerId: string
  modelId: string
  status: HealthStatus
  /** Time to first streamed token, in milliseconds. */
  latencyMs?: number
  /** Throughput in tokens per second (estimated chars/4 from the stream). */
  tokensPerSecond?: number
  error?: string
  checkedAt: number
}

export interface PingTarget {
  providerId: string
  modelId: string
}

const PING_PROMPT = 'Reply with the single word: pong'

/**
 * Ping a single provider/model: one short streaming completion.
 * Measures latency (time to first streamed token, ms) and throughput
 * (tokens/second, estimated from streamed characters / 4).
 */
export async function pingProvider(
  target: PingTarget,
  context: { settings: Settings; configs: Config; dependencies: ModelDependencies }
): Promise<ProviderHealthResult> {
  const { providerId, modelId } = target
  const checkedAt = Date.now()
  try {
    const modelInstance = getModel(
      { provider: providerId, modelId },
      context.settings,
      context.configs,
      context.dependencies
    )

    let firstTokenAt: number | null = null
    let lastTokenAt: number | null = null
    let chars = 0
    const start = performance.now()

    for await (const part of modelInstance.chatStream([{ role: 'user', content: PING_PROMPT }], {})) {
      if (part.type === 'text-delta') {
        if (firstTokenAt === null) {
          firstTokenAt = performance.now()
        }
        lastTokenAt = performance.now()
        chars += part.text.length
      }
    }

    if (firstTokenAt === null) {
      throw new Error('No response from provider')
    }
    // Throughput uses the full streaming window (first token -> last token),
    // excluding the time-to-first-token wait, so slow handshakes don't tank it.
    const streamMs = (lastTokenAt ?? firstTokenAt) - firstTokenAt
    const tokens = Math.max(1, Math.round(chars / 4))
    const tokensPerSecond =
      streamMs > 0 ? Number(((tokens / streamMs) * 1000).toFixed(1)) : Number(tokens.toFixed(1))
    return {
      providerId,
      modelId,
      status: 'alive',
      latencyMs: Math.round(firstTokenAt - start),
      tokensPerSecond,
      checkedAt,
    }
  } catch (e: unknown) {
    const err = e as { responseBody?: string; message?: string }
    return {
      providerId,
      modelId,
      status: 'dead',
      error: err?.responseBody || err?.message || String(e),
      checkedAt,
    }
  }
}

/** Run selected test kinds for ONE model from the renderer, using live settings/config/deps. */
export async function runSingleModelTests(
  target: PingTarget,
  kinds: TestKind[],
  onResult: (result: ProviderTestResult) => void,
  isCancelled: () => boolean = () => false
): Promise<void> {
  const settings = settingsStore.getState()
  const configs = await platform.getConfig()
  const dependencies = await createModelDependencies()
  await runModelTestKinds(target, kinds, { settings, configs, dependencies }, onResult, isCancelled)
}

export type ModelResultFilter = 'all' | 'alive' | 'dead'

export type TestKind = 'ping' | 'vision' | 'context'

export interface ProviderTestResult extends ProviderHealthResult {
  kind: TestKind
}
type TestContext = { settings: Settings; configs: Config; dependencies: ModelDependencies }

const VISION_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='

// ~24k chars ≈ ~6k tokens of filler to probe long-context acceptance.
const CONTEXT_FILLER =
  'The quick brown fox jumps over the lazy dog while counting stars in the midnight sky. '
const CONTEXT_PROMPT = CONTEXT_FILLER.repeat(340) + '\n\nIgnore all text above and reply with the single word: ok'

/**
 * Vision test: send a tiny base64 image and check the model accepts and responds to it.
 * Latency = full request duration (non-streaming chat call).
 */
export async function testVisionProvider(
  target: PingTarget,
  context: { settings: Settings; configs: Config; dependencies: ModelDependencies }
): Promise<ProviderTestResult> {
  const { providerId, modelId } = target
  const checkedAt = Date.now()
  try {
    const modelInstance = getModel(
      { provider: providerId, modelId },
      context.settings,
      context.configs,
      context.dependencies
    )
    const start = performance.now()
    await modelInstance.chat(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Reply with the single word: seen' },
            { type: 'image', image: `data:image/png;base64,${VISION_IMAGE_BASE64}` },
          ],
        },
      ],
      { onResultChange: () => {} }
    )
    return { providerId, modelId, kind: 'vision', status: 'alive', latencyMs: Math.round(performance.now() - start), checkedAt }
  } catch (e: unknown) {
    const err = e as { responseBody?: string; message?: string }
    return {
      providerId,
      modelId,
      kind: 'vision',
      status: 'dead',
      error: err?.responseBody || err?.message || String(e),
      checkedAt,
    }
  }
}

/**
 * Context test: send a long prompt (~6k tokens) and check the model accepts it.
 * Latency = time to first token; tok/s from the streaming window.
 */
export async function testContextProvider(
  target: PingTarget,
  context: { settings: Settings; configs: Config; dependencies: ModelDependencies }
): Promise<ProviderTestResult> {
  const { providerId, modelId } = target
  const checkedAt = Date.now()
  try {
    const modelInstance = getModel(
      { provider: providerId, modelId },
      context.settings,
      context.configs,
      context.dependencies
    )
    let firstTokenAt: number | null = null
    let lastTokenAt: number | null = null
    let chars = 0
    const start = performance.now()
    for await (const part of modelInstance.chatStream([{ role: 'user', content: CONTEXT_PROMPT }], {})) {
      if (part.type === 'text-delta') {
        if (firstTokenAt === null) firstTokenAt = performance.now()
        lastTokenAt = performance.now()
        chars += part.text.length
      }
    }
    if (firstTokenAt === null) throw new Error('No response from provider')
    const streamMs = (lastTokenAt ?? firstTokenAt) - firstTokenAt
    const tokens = Math.max(1, Math.round(chars / 4))
    const tokensPerSecond =
      streamMs > 0 ? Number(((tokens / streamMs) * 1000).toFixed(1)) : Number(tokens.toFixed(1))
    return {
      providerId,
      modelId,
      kind: 'context',
      status: 'alive',
      latencyMs: Math.round(firstTokenAt - start),
      tokensPerSecond,
      checkedAt,
    }
  } catch (e: unknown) {
    const err = e as { responseBody?: string; message?: string }
    return {
      providerId,
      modelId,
      kind: 'context',
      status: 'dead',
      error: err?.responseBody || err?.message || String(e),
      checkedAt,
    }
  }
}

/** Run one test of the given kind against a single model. */
export async function runModelTest(target: PingTarget, kind: TestKind, context: TestContext): Promise<ProviderTestResult> {
  if (kind === 'vision') return testVisionProvider(target, context)
  if (kind === 'context') return testContextProvider(target, context)
  const result = await pingProvider(target, context)
  return { ...result, kind: 'ping' }
}

/** Run every selected kind for one model, sequentially, reporting each result. */
export async function runModelTestKinds(
  target: PingTarget,
  kinds: TestKind[],
  context: TestContext,
  onResult: (result: ProviderTestResult) => void,
  isCancelled: () => boolean
): Promise<void> {
  for (const kind of kinds) {
    if (isCancelled()) return
    onResult(await runModelTest(target, kind, context))
  }
}

/**
 * Apply the popup filter and sort: dead first (worst news up top),
 * then by latency ascending so fast models lead within each group.
 */
export function filterAndSortResults<T extends ProviderHealthResult>(
  results: T[],
  filter: ModelResultFilter
): T[] {
  const filtered = results.filter((r) => filter === 'all' || r.status === filter)
  return filtered.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'dead' ? -1 : 1
    return (a.latencyMs ?? Number.POSITIVE_INFINITY) - (b.latencyMs ?? Number.POSITIVE_INFINITY)
  })
}

/**
 * Rate-limited mass-ping scheduler. Pings targets sequentially while
 * enforcing a minimum interval of 60000 / maxRpm ms between requests.
 */
export async function pingProvidersBatch(
  targets: PingTarget[],
  maxRpm: number,
  onResult: (result: ProviderTestResult) => void,
  isCancelled: () => boolean
): Promise<void> {
  const interval = Math.max(0, 60000 / Math.max(1, maxRpm))
  const settings = settingsStore.getState()
  const configs = await platform.getConfig()
  const dependencies = await createModelDependencies()
  const context = { settings, configs, dependencies }

  for (let i = 0; i < targets.length; i++) {
    if (isCancelled()) return
    if (i > 0 && interval > 0) {
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
    if (isCancelled()) return
    const result = await pingProvider(targets[i], context)
    onResult({ ...result, kind: 'ping' })
  }
}
