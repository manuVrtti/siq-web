/** Re-mounts on every navigation, so each page fades up once (the shell stays put). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="siq-page">{children}</div>
}
