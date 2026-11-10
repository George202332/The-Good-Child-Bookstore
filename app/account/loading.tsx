import { AccountLoadingShell } from "@/components/AccountLoadingShell";

/** Shown at once while any account page is being prepared: the menu stays, the content area shows soft placeholders. */
export default function AccountLoading() {
  return (
    <div className="wrap" style={{ paddingTop: 26, paddingBottom: 80 }}>
      <div className="dashboard-layout">
        <AccountLoadingShell />
      </div>
    </div>
  );
}
