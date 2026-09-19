import { Logo } from "./Logo";
import { TimeBasedGreeting } from "./TimeBasedGreeting";

/** Authors don't see the full public site header (see SiteChrome), but
 * the logo still shows in exactly the same position a normal header
 * would put it, with the welcome greeting where navigation would
 * otherwise sit. */
export function AuthorMinimalHeader({ logoImageUrl, name }: { logoImageUrl?: string; name: string }) {
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Logo logoImageUrl={logoImageUrl} />
        <TimeBasedGreeting name={name} />
      </div>
    </header>
  );
}
