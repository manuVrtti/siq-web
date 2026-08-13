/**
 * /browser-required — Layer 3 of exam link enforcement (PLACEHOLDER).
 *
 * Final behaviour: auto-fire the `selectiq://` deep link to hand the exam off
 * to the Electron secure browser, and show a download fallback when it is not
 * installed. Neither is wired up yet — this is the Sprint 1 landing target for
 * the middleware redirect.
 */
export default function BrowserRequiredPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Secure browser required</h1>
      <p className="max-w-md text-sm text-gray-600 dark:text-gray-400">
        SelectIQ exams run inside the SelectIQ secure browser. Open this link in
        the SelectIQ app to continue.
      </p>
    </main>
  )
}
