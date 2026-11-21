// @vitest-environment jsdom
// Repro test: add custom provider flow end-to-end at store level.
import { describe, expect, test } from 'vitest'
import { createSettingsStore } from '@chatbox/react/stores'
import { InMemorySettingsStorage } from '@chatbox/core/testing'
import { ModelProviderType } from '@shared/types'
import { mergeProviderSettings } from './providerSettings'

describe('add custom provider flow', () => {
  test('setSettings + setProviderSettings persists custom provider', async () => {
    const repo = new InMemorySettingsStorage()
    const service = new (await import('@chatbox/core')).SettingsService(repo, { isDesktopLike: false })
    const store = createSettingsStore(service)
    await store.getState().hydrate()

    const pid = 'custom-provider-test-1'
    store.getState().setSettings({
      customProviders: [
        { id: pid, name: 'Test Provider', type: ModelProviderType.OpenAI, isCustom: true },
      ],
    })

    const afterAdd = store.getState().getSettings()
    expect(afterAdd.customProviders?.some((p) => p.id === pid)).toBe(true)

    store.setState((current) =>
      mergeProviderSettings(current, pid, {
        apiKey: 'sk-test',
        apiHost: 'https://example.com/v1',
        models: [{ modelId: 'm1' }],
      })
    )

    await new Promise((r) => setTimeout(r, 100))
    const persisted = (await repo.read()) as Record<string, unknown>
    const rec = { ...(persisted as Record<string, unknown>) } as {
      customProviders?: { id: string }[]
      providers?: Record<string, Record<string, any>>
    }
    expect(rec.customProviders?.some((p) => p.id === pid)).toBe(true)
    expect(rec.providers?.[pid]?.apiKey).toBe('sk-test')
    expect(rec.providers?.[pid]?.models?.length).toBe(1)
  })
})
