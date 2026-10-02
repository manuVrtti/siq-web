'use client'

import { useState } from 'react'

import ExamEntryStart from '@/components/exam/exam-entry-start'
import IdentityGate from '@/components/exam/identity-gate'

/**
 * Plan 018b — inside the exam browser: identity step first (proctored tests
 * whose check isn't done yet), then the Start button. The server refuses to
 * start a proctored test without the check either way.
 */
export default function ExamEntryGatedStart({
  token,
  started,
  needsIdentity,
}: {
  token: string
  started: boolean
  needsIdentity: boolean
}) {
  const [verified, setVerified] = useState(!needsIdentity)
  if (!verified) return <IdentityGate token={token} onDone={() => setVerified(true)} />
  return <ExamEntryStart token={token} started={started} />
}
