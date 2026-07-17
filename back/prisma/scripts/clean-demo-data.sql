-- ============================================================
-- Script: clean-demo-data.sql
-- Elimina pacientes, turnos y datos asociados EXCLUSIVAMENTE
-- del profesional con slug 'demo' y organización 'demo'.
--
-- SEGURO para multi-tenant: NO toca datos de otros slugs
-- (ej: marielgaleano, centro, etc.)
-- ============================================================
-- USO:
--   npx prisma db execute --schema prisma/schema.prisma \
--     --file prisma/scripts/clean-demo-data.sql
-- ============================================================

DO $$
DECLARE
  v_prof_id TEXT;
  v_org_id  TEXT;
BEGIN
  -- IDs objetivo
  SELECT id INTO v_prof_id FROM "Professional" WHERE slug = 'demo';
  SELECT id INTO v_org_id  FROM "Organization" WHERE slug = 'demo';

  IF v_prof_id IS NULL AND v_org_id IS NULL THEN
    RAISE NOTICE 'No se encontró profesional ni organización con slug = demo';
    RETURN;
  END IF;

  RAISE NOTICE 'Limpiando datos de prof=%, org=% ...', v_prof_id, v_org_id;

  -- ClinicalRecord (FK Restrict → va primero)
  DELETE FROM "ClinicalRecord"
  WHERE "patientId" IN (
    SELECT DISTINCT "patientId" FROM "Appointment"
    WHERE (v_prof_id IS NOT NULL AND "professionalId" = v_prof_id)
       OR (v_org_id IS NOT NULL AND "organizationId" = v_org_id)
  );

  -- Notification
  DELETE FROM "Notification"
  WHERE "patientId" IN (
    SELECT DISTINCT "patientId" FROM "Appointment"
    WHERE (v_prof_id IS NOT NULL AND "professionalId" = v_prof_id)
       OR (v_org_id IS NOT NULL AND "organizationId" = v_org_id)
  );

  -- MessageLog
  DELETE FROM "MessageLog"
  WHERE "patientId" IN (
    SELECT DISTINCT "patientId" FROM "Appointment"
    WHERE (v_prof_id IS NOT NULL AND "professionalId" = v_prof_id)
       OR (v_org_id IS NOT NULL AND "organizationId" = v_org_id)
  );

  -- PublicBooking: liberar FK antes
  UPDATE "PublicBooking" SET "appointmentId" = NULL
  WHERE "appointmentId" IN (
    SELECT id FROM "Appointment"
    WHERE (v_prof_id IS NOT NULL AND "professionalId" = v_prof_id)
       OR (v_org_id IS NOT NULL AND "organizationId" = v_org_id)
  );

  DELETE FROM "PublicBooking"
  WHERE "patientId" IN (
    SELECT DISTINCT "patientId" FROM "Appointment"
    WHERE (v_prof_id IS NOT NULL AND "professionalId" = v_prof_id)
       OR (v_org_id IS NOT NULL AND "organizationId" = v_org_id)
  );

  -- Revenue de los appointments target
  DELETE FROM "Revenue"
  WHERE "appointmentId" IN (
    SELECT id FROM "Appointment"
    WHERE (v_prof_id IS NOT NULL AND "professionalId" = v_prof_id)
       OR (v_org_id IS NOT NULL AND "organizationId" = v_org_id)
  );

  -- Appointments
  DELETE FROM "Appointment"
  WHERE (v_prof_id IS NOT NULL AND "professionalId" = v_prof_id)
     OR (v_org_id IS NOT NULL AND "organizationId" = v_org_id);

  -- Patients que ya no tienen appointments
  DELETE FROM "Patient" p
  WHERE NOT EXISTS (SELECT 1 FROM "Appointment" a WHERE a."patientId" = p.id);

  RAISE NOTICE '✅ Datos de demo eliminados. Otros profesionales intactos.';
END;
$$;
