/**
 * Automated affiliate/outbound link handling — any external marketplace
 * or affiliate link rendered through this component automatically gets
 * rel="nofollow sponsored" and target="_blank", per Google's own
 * guidance for paid/affiliate links (prevents passing page rank to
 * commercial destinations and avoids a manual-action penalty for
 * undisclosed sponsored links). Used for the "Also available on"
 * marketplace links on book pages (see BookDetailClient.tsx) and
 * anywhere else an outbound affiliate-style link needs to render.
 */
export function OutboundLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="nofollow sponsored noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
