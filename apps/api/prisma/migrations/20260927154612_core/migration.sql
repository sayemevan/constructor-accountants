-- CreateTable
CREATE TABLE "number_sequences" (
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "sequence_key" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "next_value" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("tenant_id","sequence_key")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid,
    "event_type" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "correlation_id" TEXT,
    "actor_user_id" UUID,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_events_processed_at_occurred_at_idx" ON "outbox_events"("processed_at", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_tenant_id_id_key" ON "outbox_events"("tenant_id", "id");

-- AddForeignKey
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------------------------------
-- Hand-written (05 §9, 06 "RLS implementation", 25)
-- ---------------------------------------------------------------------------------------------------------------

ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_sequence_key_format_check"
  CHECK ("sequence_key" ~ '^[a-z][a-z0-9_.:-]{0,62}$');
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_next_value_check"
  CHECK ("next_value" >= 1);
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_event_type_format_check"
  CHECK ("event_type" ~ '^[A-Z][A-Za-z0-9]{1,99}$');
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_payload_object_check"
  CHECK (jsonb_typeof("payload") = 'object');
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_attempts_check"
  CHECK ("attempts" >= 0);

-- Both tables are tenant-owned: tenant_id defaults to the transaction's tenant and RLS enforces it.
ALTER TABLE "number_sequences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "number_sequences" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "number_sequences"
  USING (tenant_id = (NULLIF(current_setting('app.tenant_id', true), ''))::uuid)
  WITH CHECK (tenant_id = (NULLIF(current_setting('app.tenant_id', true), ''))::uuid);

ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "outbox_events"
  USING (tenant_id = (NULLIF(current_setting('app.tenant_id', true), ''))::uuid)
  WITH CHECK (tenant_id = (NULLIF(current_setting('app.tenant_id', true), ''))::uuid);

-- The worker's OutboxDispatcher must see pending events of every tenant (ADR-0005 "Outbox dispatcher").
-- It sets the transaction-local flag app.outbox_dispatcher = 'on' in its claim transaction only. The flag opens
-- SELECT and UPDATE (never INSERT), and UPDATE is limited to the dispatch columns by the grants below.
CREATE POLICY outbox_dispatcher_read ON "outbox_events" FOR SELECT
  USING (current_setting('app.outbox_dispatcher', true) = 'on');
CREATE POLICY outbox_dispatcher_mark ON "outbox_events" FOR UPDATE
  USING (current_setting('app.outbox_dispatcher', true) = 'on')
  WITH CHECK (current_setting('app.outbox_dispatcher', true) = 'on');

-- Deleting a sequence would restart its numbering; outbox rows are history. Retention/cleanup (future) runs as a
-- dedicated job with its own grant. Outbox rows are immutable except for their dispatch state.
REVOKE DELETE ON "number_sequences", "outbox_events" FROM app_user;
REVOKE UPDATE ON "outbox_events" FROM app_user;
GRANT UPDATE ("processed_at", "attempts", "last_error") ON "outbox_events" TO app_user;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_platform') THEN
    REVOKE DELETE ON "number_sequences", "outbox_events" FROM app_platform;
    REVOKE UPDATE ON "outbox_events" FROM app_platform;
  END IF;
END
$$;

-- Wake the dispatcher when events commit (NOTIFY is delivered on commit only); it also polls as a fallback.
CREATE FUNCTION "outbox_events_notify"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('outbox_events', '');
  RETURN NULL;
END
$$;
CREATE TRIGGER "outbox_events_notify" AFTER INSERT ON "outbox_events"
  FOR EACH STATEMENT EXECUTE FUNCTION "outbox_events_notify"();
