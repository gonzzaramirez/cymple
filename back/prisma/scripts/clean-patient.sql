-- ============================================================
-- Script: clean-patient.sql
-- Elimina TODO rastro de uno o más pacientes por teléfono.
-- ============================================================
-- USO:
--   1. PONÉ el teléfono del paciente(s) en la línea 13
--   2. Ejecutá desde back/:
--        npx prisma db execute --schema prisma/schema.prisma --file prisma/scripts/clean-patient.sql
-- ============================================================

DO $$
DECLARE
  v_phone TEXT := '5493775439981';  -- 👈 PONÉ ACÁ EL TELÉFONO DEL PACIENTE DE PRUEBA
  v_count INT;
BEGIN
  -- Cuenta pacientes a eliminar
  SELECT COUNT(*) INTO v_count FROM "Patient" WHERE phone = v_phone;
  IF v_count = 0 THEN
    RAISE NOTICE 'No se encontraron pacientes con teléfono %', v_phone;
    RETURN;
  END IF;

  RAISE NOTICE 'Eliminando % paciente(s) con teléfono % ...', v_count, v_phone;

  -- ClinicalRecord (onDelete: Restrict → va antes que Patient/Appointment)
  DELETE FROM "ClinicalRecord" WHERE "patientId" IN (SELECT id FROM "Patient" WHERE phone = v_phone);

  -- Notification (onDelete: SetNull, orden flexible)
  DELETE FROM "Notification" WHERE "patientId" IN (SELECT id FROM "Patient" WHERE phone = v_phone);

  -- MessageLog (onDelete: SetNull, orden flexible)
  DELETE FROM "MessageLog" WHERE "patientId" IN (SELECT id FROM "Patient" WHERE phone = v_phone);

  -- PublicBooking → liberar FK a Appointment antes de borrar
  UPDATE "PublicBooking" SET "appointmentId" = NULL WHERE "patientId" IN (SELECT id FROM "Patient" WHERE phone = v_phone);
  DELETE FROM "PublicBooking" WHERE "patientId" IN (SELECT id FROM "Patient" WHERE phone = v_phone);

  -- Revenue de los turnos del paciente (onDelete: SetNull, quedan huérfanos)
  DELETE FROM "Revenue" WHERE "appointmentId" IN (
    SELECT id FROM "Appointment" WHERE "patientId" IN (SELECT id FROM "Patient" WHERE phone = v_phone)
  );

  -- Appointment (onDelete: Restrict sobre Patient → va antes que Patient)
  DELETE FROM "Appointment" WHERE "patientId" IN (SELECT id FROM "Patient" WHERE phone = v_phone);

  -- Patient
  DELETE FROM "Patient" WHERE phone = v_phone;

  RAISE NOTICE '✅ % paciente(s) con teléfono % eliminado(s) completamente.', v_count, v_phone;
END;
$$;
