-- Le journal d'audit ne peut pas non plus être vidé en bloc.
CREATE TRIGGER audit_event_no_truncate
  BEFORE TRUNCATE ON "audit_event"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_event_immutable();
