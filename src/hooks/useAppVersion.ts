import { useQuery } from '@tanstack/react-query'

export const CURRENT_BUILD = __BUILD__

/**
 * The build that's live on GitHub Pages, read from version.json (never cached), so the app can say when
 * it's running an older one. Only in production builds: the dev server has no version.json.
 */
export function useAppVersion() {
  const { data: latest } = useQuery({
    queryKey: ['app-version'],
    queryFn: async (): Promise<typeof CURRENT_BUILD> => {
      const res = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`version.json: ${res.status}`)
      return res.json()
    },
    enabled: import.meta.env.PROD,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  })
  return { current: CURRENT_BUILD, latest, outdated: latest != null && latest.id !== CURRENT_BUILD.id }
}

/** Picks up the newest deploy: asks the service worker to fetch it, then reloads onto it. */
export async function updateApp() {
  try {
    await (await navigator.serviceWorker?.getRegistration())?.update()
  } finally {
    window.location.reload()
  }
}
