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
    let chars = 0
    const start = performance.now()

    for await (const part of modelInstance.chatStream([{ role: 'user', content: PING_PROMPT }], {})) {
      if (part.type === 'text-delta') {
        if (firstTokenAt === null) {
          firstTokenAt = performance.now()
        }
        chars += part.text.length
      }
    }

    const elapsedMs = performance.now() - start
    if (firstTokenAt === null) {
      throw new Error('No response from provider')
    }
    const tokens = Math.max(1, Math.round(chars / 4))
    return {
      providerId,
      modelId,
      status: 'alive',
      latencyMs: Math.round(firstTokenAt - start),
      tokensPerSecond: Number(((tokens / elapsedMs) * 1000).toFixed(1)),
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

/**
 * Rate-limited mass-ping scheduler. Pings targets sequentially while
 * enforcing a minimum interval of 60000 / maxRpm ms between requests.
 */
export async function pingProvidersBatch(
  targets: PingTarget[],
  maxRpm: number,
  onResult: (result: ProviderHealthResult) => void,
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
    onResult(result)
  }
}
