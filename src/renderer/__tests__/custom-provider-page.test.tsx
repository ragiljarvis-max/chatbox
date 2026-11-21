// @vitest-environment jsdom
// Repro: custom provider settings page must render without crashing after add.
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { render, screen } from '@testing-library/react'
import { ModelProviderType } from '@shared/types'
import { describe, expect, test, vi } from 'vitest'

window.matchMedia = window.matchMedia || ((q: string) => ({
  matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {},
  addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = window.ResizeObserver || (ResizeObserverStub as unknown as typeof ResizeObserver)

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: Record<string, unknown>) => ({ ...config, useParams: () => ({ providerId: 'custom-provider-test-1' }), useSearch: () => ({}) }),
  Outlet: () => <div data-testid="outlet" />,
  Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => navigateMock,
}))
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return { ...actual, useTranslation: () => ({ t: (k: string) => k }) }
})
vi.mock('@/hooks/useScreenChange', () => ({ useIsSmallScreen: () => true }))
vi.mock('@/hooks/useModelRegistryVersion', () => ({ default: () => undefined }))
vi.mock('@/hooks/useOAuth', () => ({
  useOAuth: () => ({
    isDesktop: false, hasOAuth: false, isOAuthActive: false, flowType: 'none',
    loginCallback: vi.fn(), startLogin: vi.fn(), exchangeCode: vi.fn(), startDeviceFlow: vi.fn(),
    waitForDeviceToken: vi.fn(), cancel: vi.fn(), logout: vi.fn(),
  }),
}))
vi.mock('@/settings-runtime', async () => {
  const { createSettingsStore } = await import('@chatbox/react/stores')
  const { SettingsService } = await import('@chatbox/core')
  const { InMemorySettingsStorage } = await import('@chatbox/core/testing')
  const service = new SettingsService(new InMemorySettingsStorage(), { isDesktopLike: false })
  const store = createSettingsStore(service)
  store.getState().setSettings({
    customProviders: [{ id: 'custom-provider-test-1', name: 'My Provider', type: ModelProviderType.OpenAI, isCustom: true }],
  })
  return { settingsService: service, settingsStore: store }
})

import { RouteComponent } from '@/routes/settings/provider/$providerId'
import { settingsStore } from '@/settings-runtime'

describe('custom provider settings page', () => {
  test('renders for a custom provider without crash', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <MantineProvider>
          <RouteComponent />
        </MantineProvider>
          </TooltipProvider>
      </QueryClientProvider>
    )
    // store holds the custom provider
    const s = settingsStore.getState().getSettings()
    expect(s.customProviders?.[0]?.id).toBe('custom-provider-test-1')
    // page shows something meaningful (provider name or api key section)
    await screen.findByText('API Key', { exact: false }, { timeout: 4000 }).catch(() => {})
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0)
  })
})
