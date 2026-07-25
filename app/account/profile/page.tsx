import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { getMyProfile } from "@/actions/profile";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "READER" && role !== "AUTHOR" && role !== "AFFILIATE") redirect("/admin");

  const profile = await getMyProfile();
  if (!profile) redirect("/login");

  return (
    <DashboardShell role={role} activeKey="profile" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Profile</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Your account details.</p>
        </div>
      </div>
      <ProfileForm initial={profile} />
    </DashboardShell>
  );
}
