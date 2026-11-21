// @vitest-environment jsdom
// UI-level repro: Add provider flow (Add button -> spotlight -> AddProviderModal -> navigate)
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

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

const { navigateMock, InMemorySettingsStorageMod } = vi.hoisted(() => {
  class InMemorySettingsStorage {
    private value: unknown = null
    read() {
      return Promise.resolve(this.value)
    }
    write(v: unknown) {
      this.value = v
      return Promise.resolve()
    }
    remove() {
      this.value = null
      return Promise.resolve()
    }
  }
  return { navigateMock: vi.fn(), InMemorySettingsStorageMod: InMemorySettingsStorage }
})

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: Record<string, unknown>) => ({ ...config, useSearch: () => ({}) }),
  Outlet: () => <div data-testid="outlet" />,
  Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => navigateMock,
  useRouterState: () => ({ location: { pathname: '/settings/provider' } }),
}))
vi.mock('@/hooks/useScreenChange', () => ({ useIsSmallScreen: () => true }))
vi.mock('@/hooks/useVersion', () => ({ default: () => ({ isExceeded: false }) }))
vi.mock('@/hooks/useProviderImport', () => ({
  useProviderImport: () => ({
    importModalOpened: false,
    setImportModalOpened: vi.fn(),
    importedConfig: null,
    setImportedConfig: vi.fn(),
    importError: null,
    setImportError: vi.fn(),
    isImporting: false,
    existingProvider: null,
    checkExistingProvider: vi.fn(),
    handleClipboardImport: vi.fn(),
    handleCancelImport: vi.fn(),
  }),
}))
vi.mock('@/settings-runtime', async () => {
  const { createSettingsStore } = await import('@chatbox/react/stores')
  const { SettingsService } = await import('@chatbox/core')
  const { InMemorySettingsStorage } = await import('@chatbox/core/testing')
  const service = new SettingsService(new InMemorySettingsStorage(), { isDesktopLike: false })
  const store = createSettingsStore(service)
  return { settingsService: service, settingsStore: store }
})
vi.mock('@/utils/base64', () => ({ decodeBase64: () => '' }))
vi.mock('@/utils/provider-config', () => ({ parseProviderFromJson: () => null }))

import { RouteComponent } from '@/routes/settings/provider/route'
import { settingsStore } from '@/settings-runtime'

beforeEach(() => {
  navigateMock.mockClear()
})

describe('add provider UI flow (mobile)', () => {
  test('Add button -> spotlight -> Add Custom Provider -> modal -> submit', async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MantineProvider>
          <RouteComponent />
        </MantineProvider>
      </QueryClientProvider>
    )

    const addBtn = await screen.findByTestId('settings-add-provider')
    await user.click(addBtn)

    const addCustom = await screen.findByText('Add Custom Provider')
    await user.click(addCustom)

    const nameInput = await screen.findByTestId('settings-add-provider-name')
    await user.type(nameInput, 'My Provider')

    const submit = screen.getByTestId('settings-add-provider-submit')
    await user.click(submit)

    await waitFor(() => {
      const s = settingsStore.getState().getSettings()
      expect(s.customProviders?.length).toBe(1)
    })
    expect(navigateMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/settings/provider/$providerId' })
    )
  })
})
