import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

/**
 * FASE 8: hidden feature pages (Web Search, MCP, Skills, Agent & Memory) render this instead of
 * their normal content, so direct URL access redirects back to Settings.
 */
export function FeatureDisabledRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    void navigate({ to: '/settings', replace: true })
  }, [navigate])
  return null
}
