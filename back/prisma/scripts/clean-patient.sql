-- ============================================================
-- Script: clean-patient.sql
-- Elimina TODO rastro de un paciente por teléfono.
-- ============================================================
-- USO: Reemplazá el teléfono abajo y correlo con:
--   npx prisma db execute --schema prisma\schema.prisma --file prisma\scripts\clean-patient.sql
-- ============================================================

DO $$
DECLARE
  v_patient_id TEXT;
  v_phone TEXT := '5493775439981';  -- 👈 CAMBIÁ ESTE NÚMERO
BEGIN
  SELECT id INTO v_patient_id FROM "Patient" WHERE phone = v_phone LIMIT 1;

  IF v_patient_id IS NULL THEN
    RAISE NOTICE 'No se encontró paciente con teléfono %', v_phone;
    RETURN;
  END IF;

  RAISE NOTICE 'Eliminando paciente % ...', v_patient_id;

  DELETE FROM "ClinicalRecord" WHERE "patientId" = v_patient_id;
  DELETE FROM "Notification"  WHERE "patientId" = v_patient_id;
  DELETE FROM "MessageLog"    WHERE "patientId" = v_patient_id;
  UPDATE "PublicBooking" SET "appointmentId" = NULL WHERE "patientId" = v_patient_id;
  DELETE FROM "PublicBooking" WHERE "patientId" = v_patient_id;
  DELETE FROM "Appointment"   WHERE "patientId" = v_patient_id;
  DELETE FROM "Patient"       WHERE id = v_patient_id;

  RAISE NOTICE '✅ Paciente % eliminado completamente.', v_phone;
END;
$$;
