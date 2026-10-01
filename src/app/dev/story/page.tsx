import { notFound } from 'next/navigation'

import {
  SceneAssigned,
  SceneBuild,
  SceneDepartments,
  SceneHodTeam,
  SceneImport,
  SceneInsights,
  SceneResult,
  SceneSecureBrowser,
} from '@/components/story/scenes'
import { devBypassEnabled } from '@/lib/auth/dev-bypass'

/** LOCAL DEV ONLY — every story scene side by side, for design review. */
export default function DevStoryPreview() {
  if (!devBypassEnabled()) notFound()
  const scenes = [SceneAssigned, SceneSecureBrowser, SceneResult, SceneInsights, SceneDepartments, SceneImport, SceneBuild, SceneHodTeam]
  return (
    <main className="grid grid-cols-4 gap-4 p-4">
      {scenes.map((S) => (
        <div key={S.name} className="bg-primary rounded-2xl p-5 text-white">
          <p className="mb-3 text-xs text-white/70">{S.name}</p>
          <S />
        </div>
      ))}
    </main>
  )
}
