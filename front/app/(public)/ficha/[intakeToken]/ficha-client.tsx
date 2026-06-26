"use client";

import { useState, useEffect, useCallback } from "react";
import { getIntakeStatus, submitIntake, IntakePayload } from "@/lib/api/intake";
import { AlertCircle, CheckCircle2, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ──────────────────────────────────────────────────────────

type PageState =
  | { phase: "loading" }
  | { phase: "not-found" }
  | { phase: "form" }
  | { phase: "submitting" }
  | { phase: "submitted"; submittedAt?: string }
  | { phase: "error"; message: string };

// ── Reusable toggle group ──────────────────────────────────────────

function ToggleGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: Record<string, boolean>;
  onChange: (key: string, val: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value[opt.key] ?? false;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key, !active)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Section collapsible ────────────────────────────────────────────

function Section({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="rounded-2xl border border-border/50 bg-card/30">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-display text-base font-semibold">{title}</span>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && <div className="space-y-4 px-4 pb-4">{children}</div>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────

export default function FichaClient({
  intakeToken,
}: {
  intakeToken: string;
}) {
  const [state, setState] = useState<PageState>({ phase: "loading" });
  const [errorMsg, setErrorMsg] = useState<string | undefined>();

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [lastTreatmentDate, setLastTreatmentDate] = useState("");
  const [avoidAreas, setAvoidAreas] = useState("");

  const [habits, setHabits] = useState<Record<string, boolean>>({});
  const [homeCare, setHomeCare] = useState<Record<string, boolean>>({});
  const [visibleCapillaries, setVisibleCapillaries] = useState<
    Record<string, boolean>
  >({});
  const [sebaceousCondition, setSebaceousCondition] = useState<
    Record<string, boolean>
  >({});
  const [pigmentation, setPigmentation] = useState<Record<string, boolean>>(
    {},
  );

  const [nameError, setNameError] = useState("");
  const [birthDateError, setBirthDateError] = useState("");

  // Check intake status on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const status = await getIntakeStatus(intakeToken);
        if (cancelled) return;
        if (status.submitted) {
          setState({
            phase: "submitted",
            submittedAt: status.submittedAt,
          });
        } else {
          setState({ phase: "form" });
        }
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error && err.message === "NOT_FOUND"
            ? "not-found"
            : "error";
        if (msg === "not-found") {
          setState({
            phase: "error",
            message: "El link de la ficha no es válido o expiró.",
          });
        } else {
          setState({
            phase: "error",
            message: "Error al cargar la ficha. Intentá de nuevo.",
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [intakeToken]);

  const handleToggle = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
      key: string,
      val: boolean,
    ) => {
      setter((prev) => ({ ...prev, [key]: val }));
    },
    [],
  );

  function validate(): boolean {
    let valid = true;

    if (!firstName.trim() || !lastName.trim()) {
      setNameError("Completá nombre y apellido");
      valid = false;
    } else {
      setNameError("");
    }

    if (!birthDate) {
      setBirthDateError("Seleccioná tu fecha de nacimiento");
      valid = false;
    } else {
      const birth = new Date(birthDate);
      const today = new Date();
      if (birth > today) {
        setBirthDateError("La fecha de nacimiento no puede ser futura");
        valid = false;
      } else {
        setBirthDateError("");
      }
    }

    return valid;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setState({ phase: "submitting" });
    setErrorMsg(undefined);

    try {
      const payload: IntakePayload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        birthDate: new Date(birthDate).toISOString(),
        lastTreatmentDate: lastTreatmentDate
          ? new Date(lastTreatmentDate).toISOString()
          : undefined,
        avoidAreas: avoidAreas.trim() || undefined,
        habits: {
          alcohol: habits.alcohol ?? false,
          cigarettes: habits.cigarettes ?? false,
          drugs: habits.drugs ?? false,
          coffee: habits.coffee ?? false,
        },
        homeCare: {
          cleaning: homeCare.cleaning ?? false,
          exfoliation: homeCare.exfoliation ?? false,
          moisturizers: homeCare.moisturizers ?? false,
          hydratants: homeCare.hydratants ?? false,
          sunProtection: homeCare.sunProtection ?? false,
          none: homeCare.none ?? false,
        },
        visibleCapillaries: {
          nose: visibleCapillaries.nose ?? false,
          cheeks: visibleCapillaries.cheeks ?? false,
          forehead: visibleCapillaries.forehead ?? false,
          erythema: visibleCapillaries.erythema ?? false,
          irritation: visibleCapillaries.irritation ?? false,
          cuperosity: visibleCapillaries.cuperosity ?? false,
        },
        sebaceousCondition: {
          pustules: sebaceousCondition.pustules ?? false,
          papules: sebaceousCondition.papules ?? false,
          hyperplasia: sebaceousCondition.hyperplasia ?? false,
          comedones: sebaceousCondition.comedones ?? false,
          milium: sebaceousCondition.milium ?? false,
        },
        pigmentation: {
          hyperpigmentation: pigmentation.hyperpigmentation ?? false,
          hypopigmentation: pigmentation.hypopigmentation ?? false,
        },
      };

      await submitIntake(intakeToken, payload);
      setState({ phase: "submitted" });
    } catch (err) {
      const msg =
        err instanceof Error && err.message === "ALREADY_SUBMITTED"
          ? "Esta ficha ya fue completada anteriormente."
          : err instanceof Error
            ? err.message
            : "Error al enviar la ficha. Intentá de nuevo.";
      setErrorMsg(msg);
      setState({ phase: "form" });
    }
  }

  if (state.phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          Cargando ficha de ingreso...
        </p>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <AlertCircle className="size-12 text-destructive/50" />
        <div>
          <h1 className="font-display text-xl font-semibold">Error</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {state.message}
          </p>
        </div>
      </div>
    );
  }

  if (state.phase === "submitted") {
    return (
      <div className="flex flex-col items-center gap-5 py-12 text-center">
        <div className="inline-flex size-16 items-center justify-center rounded-full bg-[#34c759]/10">
          <CheckCircle2 className="size-8 text-[#34c759]" />
        </div>
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Ficha completada
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Gracias por completar tu ficha de ingreso.
            <br />
            Tu profesional la va a revisar antes del turno.
          </p>
          {state.submittedAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              Enviada el{" "}
              {new Date(state.submittedAt).toLocaleDateString("es-AR", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Ficha de ingreso
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Completá tus datos para que tu profesional conozca tu piel y hábitos.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── Personal data ─────────────────────────────────────── */}
        <Section title="Datos personales" defaultOpen>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nombre
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (nameError) setNameError("");
                }}
                placeholder="Nombre"
                className="flex h-10 w-full rounded-xl border border-border/60 bg-card px-3 text-sm outline-none transition-colors focus:border-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Apellido
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (nameError) setNameError("");
                }}
                placeholder="Apellido"
                className="flex h-10 w-full rounded-xl border border-border/60 bg-card px-3 text-sm outline-none transition-colors focus:border-primary"
              />
            </div>
          </div>
          {nameError && (
            <p className="text-xs text-destructive">{nameError}</p>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fecha de nacimiento
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => {
                setBirthDate(e.target.value);
                if (birthDateError) setBirthDateError("");
              }}
              max={new Date().toISOString().split("T")[0]}
              className="flex h-10 w-full rounded-xl border border-border/60 bg-card px-3 text-sm outline-none transition-colors focus:border-primary"
            />
            {birthDateError && (
              <p className="text-xs text-destructive">{birthDateError}</p>
            )}
          </div>

          {birthDate && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
              Edad:{" "}
              <span className="font-medium">
                {(() => {
                  const b = new Date(birthDate);
                  const t = new Date();
                  let age = t.getFullYear() - b.getFullYear();
                  const m = t.getMonth() - b.getMonth();
                  if (
                    m < 0 ||
                    (m === 0 && t.getDate() < b.getDate())
                  ) {
                    age--;
                  }
                  return `${age} años`;
                })()}
              </span>
            </div>
          )}
        </Section>

        {/* ── Habits ────────────────────────────────────────────── */}
        <Section title="Hábitos">
          <ToggleGroup
            label="¿Cuáles de estos hábitos tenés?"
            options={[
              { key: "alcohol", label: "Alcohol" },
              { key: "cigarettes", label: "Cigarrillo" },
              { key: "drugs", label: "Drogas" },
              { key: "coffee", label: "Café" },
            ]}
            value={habits}
            onChange={(key, val) => handleToggle(setHabits, key, val)}
          />
        </Section>

        {/* ── Home care ─────────────────────────────────────────── */}
        <Section title="Cuidados en casa">
          <ToggleGroup
            label="¿Qué cuidados de la piel realizás?"
            options={[
              { key: "cleaning", label: "Limpieza" },
              { key: "exfoliation", label: "Exfoliación" },
              { key: "moisturizers", label: "Hidratantes" },
              { key: "hydratants", label: "Hidratación facial" },
              { key: "sunProtection", label: "Protector solar" },
              { key: "none", label: "Ninguno" },
            ]}
            value={homeCare}
            onChange={(key, val) => handleToggle(setHomeCare, key, val)}
          />
        </Section>

        {/* ── Visible capillaries ───────────────────────────────── */}
        <Section title="Capilares visibles">
          <ToggleGroup
            label="¿Dónde se observan capilares visibles o rojeces?"
            options={[
              { key: "nose", label: "Nariz" },
              { key: "cheeks", label: "Mejillas" },
              { key: "forehead", label: "Frente" },
              { key: "erythema", label: "Eritema" },
              { key: "irritation", label: "Irritación" },
              { key: "cuperosity", label: "Cuperosis" },
            ]}
            value={visibleCapillaries}
            onChange={(key, val) =>
              handleToggle(setVisibleCapillaries, key, val)
            }
          />
        </Section>

        {/* ── Sebaceous condition ───────────────────────────────── */}
        <Section title="Glándulas sebáceas">
          <ToggleGroup
            label="¿Presentás alguna de estas condiciones?"
            options={[
              { key: "pustules", label: "Pústulas" },
              { key: "papules", label: "Pápulas" },
              { key: "hyperplasia", label: "Hiperplasia" },
              { key: "comedones", label: "Comedones" },
              { key: "milium", label: "Millium" },
            ]}
            value={sebaceousCondition}
            onChange={(key, val) =>
              handleToggle(setSebaceousCondition, key, val)
            }
          />
        </Section>

        {/* ── Pigmentation ──────────────────────────────────────── */}
        <Section title="Pigmentación">
          <ToggleGroup
            label="¿Tenés problemas de pigmentación?"
            options={[
              { key: "hyperpigmentation", label: "Hiperpigmentación" },
              { key: "hypopigmentation", label: "Hipopigmentación" },
            ]}
            value={pigmentation}
            onChange={(key, val) => handleToggle(setPigmentation, key, val)}
          />
        </Section>

        {/* ── Additional info ───────────────────────────────────── */}
        <Section title="Información adicional">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Último tratamiento (fecha)
            </label>
            <input
              type="date"
              value={lastTreatmentDate}
              onChange={(e) => setLastTreatmentDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="flex h-10 w-full rounded-xl border border-border/60 bg-card px-3 text-sm outline-none transition-colors focus:border-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Zonas a evitar
            </label>
            <textarea
              value={avoidAreas}
              onChange={(e) => setAvoidAreas(e.target.value)}
              placeholder="Ej: zona de lunar, cicatriz, etc."
              rows={2}
              className="flex w-full rounded-xl border border-border/60 bg-card px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
            />
          </div>
        </Section>

        {/* ── Error ─────────────────────────────────────────────── */}
        {errorMsg && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{errorMsg}</p>
          </div>
        )}

        {/* ── Submit ────────────────────────────────────────────── */}
        <Button
          type="submit"
          className="w-full"
          size="lg"
          style={{ backgroundColor: "#0071e3" }}
          disabled={state.phase === "submitting"}
        >
          {state.phase === "submitting" ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Enviando ficha...
            </>
          ) : (
            "Enviar ficha de ingreso"
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Tus datos se comparten solo con tu profesional
        </p>
      </form>
    </div>
  );
}
