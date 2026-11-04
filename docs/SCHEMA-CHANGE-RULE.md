# The rule for every update that changes the database ("schema change")

Whenever an update comes with a new folder under `prisma/migrations`, the code and the database must be updated TOGETHER, in this order:

1. **Staging first.** Push the code to the `staging` branch. Then apply the database updates to the STAGING database
   (`powershell -ExecutionPolicy Bypass -File scripts\migrate-staging.ps1`). Redeploy staging without the build cache. Test.
2. **Look for the red line.** If the staging banner (or Admin -> Site Health -> "Database updates") says the database is BEHIND, the
   migration has not been applied yet. Apply it, then the warning disappears within a minute.
3. **Production only after staging works.** Take a Neon backup branch of production. Run `npx prisma migrate deploy` against the
   PRODUCTION database. Only then merge `staging` into `main`.
4. Never use `prisma migrate reset`. It erases data. The only command you ever use is `prisma migrate deploy`.

Why this order: the code expects the new column the moment it is deployed. If the database does not have it yet, pages that use it
fail (for example checkout error P2022). Migrating the database first (it only ADDS things, so the old code keeps working) and
deploying the code second means customers never see the gap.
