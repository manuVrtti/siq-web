import Image from 'next/image'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

/**
 * Plan 018 — admin review timeline for one ProctoringSession.
 *
 * Server component. Consumes the shape returned by
 * `services/proctoring.getSessionForAdmin` — reference photo + each flag
 * with a short-lived signed URL (already minted by the service).
 */

type Flag = {
  id: string
  type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  similarity: number | null
  metadata: unknown
  occurredAt: Date | string
  snapshotSignedUrl: string | null
}

const SEVERITY_LABEL: Record<'LOW' | 'MEDIUM' | 'HIGH', string> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
}
const SEVERITY_VARIANT: Record<'LOW' | 'MEDIUM' | 'HIGH', 'outline' | 'secondary'> = {
  LOW: 'outline',
  MEDIUM: 'secondary',
  HIGH: 'secondary',
}

const TYPE_LABEL: Record<string, string> = {
  NO_FACE: 'no face',
  MULTIPLE_FACES: 'multiple faces',
  FACE_MISMATCH: 'face mismatch',
  TAB_SWITCH: 'tab switch',
  FOCUS_LOSS: 'focus loss',
  FULLSCREEN_EXIT: 'exited fullscreen',
  WINDOW_BLUR: 'window blurred',
  WEBCAM_DENIED: 'webcam denied',
}

export function ProctoringReview({
  referenceSignedUrl,
  flags,
  flagCount,
  snapshotCount,
}: {
  referenceSignedUrl: string | null
  flags: Flag[]
  flagCount: number
  snapshotCount: number
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline">{flagCount} flag{flagCount === 1 ? '' : 's'}</Badge>
        <Badge variant="outline">{snapshotCount} snapshot{snapshotCount === 1 ? '' : 's'}</Badge>
      </div>

      {referenceSignedUrl ? (
        <Card>
          <CardHeader className="gap-1 pb-2">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              Reference photo (captured at exam start)
            </p>
          </CardHeader>
          <CardContent>
            {/*
              Signed URL from a private Supabase bucket — the URL expires in
              5 minutes, so no danger of leaking. `unoptimized` because
              next/image can't re-sign an expired URL if it tries to cache.
            */}
            <Image
              src={referenceSignedUrl}
              alt="Candidate reference photo"
              width={160}
              height={120}
              className="rounded border object-cover"
              unoptimized
            />
          </CardContent>
        </Card>
      ) : null}

      {flags.length === 0 ? (
        <p className="text-muted-foreground text-sm">No proctoring flags recorded.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {flags.map((f, i) => (
            <Card key={f.id}>
              <CardHeader className="gap-1 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground text-xs">#{i + 1}</span>
                  <Badge variant={SEVERITY_VARIANT[f.severity]}>
                    {SEVERITY_LABEL[f.severity]}
                  </Badge>
                  <CardTitle className="text-sm font-medium">
                    {TYPE_LABEL[f.type] ?? f.type.toLowerCase()}
                  </CardTitle>
                  <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                    {new Date(f.occurredAt).toLocaleTimeString()}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-xs">
                {f.similarity !== null ? (
                  <p className="text-muted-foreground">
                    Face similarity{' '}
                    <span className="text-foreground tabular-nums">
                      {f.similarity.toFixed(3)}
                    </span>
                  </p>
                ) : null}
                {f.metadata && typeof f.metadata === 'object' ? (
                  <pre className="text-muted-foreground overflow-auto rounded bg-muted/40 p-2 font-mono text-[11px]">
                    {JSON.stringify(f.metadata, null, 2)}
                  </pre>
                ) : null}
                {f.snapshotSignedUrl ? (
                  <Image
                    src={f.snapshotSignedUrl}
                    alt={`Snapshot for ${f.type}`}
                    width={200}
                    height={150}
                    className="rounded border object-cover"
                    unoptimized
                  />
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
