import type { CSSProperties, ReactNode } from "react";
import { getAppearanceForUser } from "@/actions/appearance";
import { fontStack, sizeOption } from "@/lib/account-fonts";
import "./AccountFontFaces";

/**
 * Wraps everything inside the account area (and the backend) with the signed-in
 * user's chosen font and size. Rendered only by app/account/layout.tsx and
 * app/admin/layout.tsx, so the public site is never affected. With both choices
 * on "Default" it adds no styling at all.
 */
export async function AccountFontScope({ userId, children }: { userId?: string; children: ReactNode }) {
  const a = userId ? await getAppearanceForUser(userId) : { fontFamily: "default", fontSize: "default" };
  const stack = fontStack(a.fontFamily);
  const size = sizeOption(a.fontSize);
  const style = {
    "--acct-zoom": size.zoom,
    "--acct-zoom-small": size.zoomSmall,
    ...(stack ? { "--acct-font": stack } : {}),
  } as CSSProperties;
  return (
    <div className="acct-font-scope" data-font={a.fontFamily} data-size={a.fontSize} style={style}>
      {children}
    </div>
  );
}
