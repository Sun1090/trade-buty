# Supabase rollback scripts

Supabase migrations are forward-only. Each destructive or constraint-adding
migration may have a matching rollback script in this directory, named after the
forward migration.

Rollback scripts are for incident recovery after an authorized operator has
confirmed that reverting the schema change is safe. They intentionally do not
try to reconstruct business data that a forward migration normalized or
deleted; that requires a separate, reviewed data-recovery plan.
