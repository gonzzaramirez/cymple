-- ============================================================
-- Script: reset-all-data.sql
-- Elimina TODOS los pacientes, turnos, agendas, mensajes,
-- notificaciones, fichas clínicas y reservas online.
-- ============================================================
-- USO desde el container:
--   cd /app
--   npx prisma db execute --schema prisma/schema.prisma --file prisma/scripts/reset-all-data.sql
--
-- ⚠️  PROFESIONALES y ORGANIZACIONES se conservan.
-- ⚠️  Plantillas de mensajes, gastos y configs se conservan.
-- ============================================================

DO $$
DECLARE
  v_count INT;
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE '  RESET TOTAL DE DATOS OPERATIVOS';
  RAISE NOTICE '============================================';

  -- 1. ClinicalRecord
  SELECT COUNT(*) INTO v_count FROM "ClinicalRecord";
  DELETE FROM "ClinicalRecord";
  RAISE NOTICE '1/8 ClinicalRecords: % eliminados', v_count;

  -- 2. Notification
  SELECT COUNT(*) INTO v_count FROM "Notification";
  DELETE FROM "Notification";
  RAISE NOTICE '2/8 Notifications: % eliminadas', v_count;

  -- 3. MessageLog
  SELECT COUNT(*) INTO v_count FROM "MessageLog";
  DELETE FROM "MessageLog";
  RAISE NOTICE '3/8 MessageLogs: % eliminados', v_count;

  -- 4. PublicBooking (primero liberar appointmentId FK)
  UPDATE "PublicBooking" SET "appointmentId" = NULL;
  SELECT COUNT(*) INTO v_count FROM "PublicBooking";
  DELETE FROM "PublicBooking";
  RAISE NOTICE '4/8 PublicBookings: % eliminadas', v_count;

  -- 5. Revenue (atado a Appointment)
  SELECT COUNT(*) INTO v_count FROM "Revenue";
  DELETE FROM "Revenue";
  RAISE NOTICE '5/8 Revenues: % eliminados', v_count;

  -- 6. Appointment (ON DELETE RESTRICT sobre Patient, va antes)
  SELECT COUNT(*) INTO v_count FROM "Appointment";
  DELETE FROM "Appointment";
  RAISE NOTICE '6/8 Appointments: % eliminados', v_count;

  -- 7. Availability (agendas)
  DELETE FROM "AvailabilitySlotCapacity";
  DELETE FROM "AvailabilityRange";
  DELETE FROM "SpecificDateAvailability";
  DELETE FROM "WeeklyAvailability";
  RAISE NOTICE '7/8 Availability: limpiada';

  -- 8. Patient
  SELECT COUNT(*) INTO v_count FROM "Patient";
  DELETE FROM "Patient";
  RAISE NOTICE '8/8 Patients: % eliminados', v_count;

  RAISE NOTICE '============================================';
  RAISE NOTICE '  ✅ RESET COMPLETADO';
  RAISE NOTICE '============================================';
END;
$$;
