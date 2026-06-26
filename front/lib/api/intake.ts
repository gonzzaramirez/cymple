const BASE = "/api/backend/public/intake";

export type IntakeStatusResponse = {
  submitted: boolean;
  submittedAt?: string;
};

export type IntakePayload = {
  firstName: string;
  lastName: string;
  birthDate: string;
  lastTreatmentDate?: string;
  avoidAreas?: string;
  habits: {
    alcohol: boolean;
    cigarettes: boolean;
    drugs: boolean;
    coffee: boolean;
  };
  homeCare: {
    cleaning: boolean;
    exfoliation: boolean;
    moisturizers: boolean;
    hydratants: boolean;
    sunProtection: boolean;
    none: boolean;
  };
  visibleCapillaries: {
    nose: boolean;
    cheeks: boolean;
    forehead: boolean;
    erythema: boolean;
    irritation: boolean;
    cuperosity: boolean;
  };
  sebaceousCondition: {
    pustules: boolean;
    papules: boolean;
    hyperplasia: boolean;
    comedones: boolean;
    milium: boolean;
  };
  pigmentation: {
    hyperpigmentation: boolean;
    hypopigmentation: boolean;
  };
};

export async function getIntakeStatus(
  intakeToken: string,
): Promise<IntakeStatusResponse> {
  const res = await fetch(`${BASE}/${encodeURIComponent(intakeToken)}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("NOT_FOUND");
    throw new Error("Error al obtener estado de la ficha");
  }
  return res.json();
}

export async function submitIntake(
  intakeToken: string,
  payload: IntakePayload,
): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/${encodeURIComponent(intakeToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 404) throw new Error("NOT_FOUND");
    if (res.status === 409) throw new Error("ALREADY_SUBMITTED");
    throw new Error(text || "Error al enviar la ficha");
  }
  return res.json();
}
