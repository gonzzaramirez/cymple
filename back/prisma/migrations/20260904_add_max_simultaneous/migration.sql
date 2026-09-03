-- Config global por profesional: máximo de turnos en simultáneo.
-- null = sin límite (el profesional lo elige con 0 en Ajustes).
-- DEFAULT 1: cierra overbooking por defecto; filas existentes quedan en 1.
ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "maxSimultaneous" INTEGER DEFAULT 1;
