import type { EmployeeId } from "./types";

/**
 * Simli's ready-made faces (docs.simli.com/api-reference/preset-faces), not faces
 * created on this account. Override any of them with an env var.
 * experienced Victor, new Sara, challenging Lukas, custom Daniel.
 */
const DEFAULTS: Record<EmployeeId, string> = {
  experienced: "3bad681f-1b4a-4507-bc54-fbc675c191b7",
  new: "f735e62c-dce7-4c0b-8e85-1c7e21774c45",
  challenging: "a36d66df-a23d-4569-996b-d0e990019857",
  custom: "03ce3ee8-db97-4150-a333-8f643d48fee9"
};

const ENV: Record<EmployeeId, string> = {
  experienced: "SIMLI_FACE_EXPERIENCED",
  new: "SIMLI_FACE_NEW",
  challenging: "SIMLI_FACE_CHALLENGING",
  custom: "SIMLI_FACE_CUSTOM"
};

export function faceFor(id: EmployeeId): string {
  return (process.env[ENV[id]] || DEFAULTS[id]).trim();
}

/** Claire, a ready-made female face, so she matches the coach voice. */
const COACH = "5a83913c-411b-4afd-8432-b7d685e2aee6";

export function coachFace(): string {
  return (process.env.SIMLI_FACE_COACH || COACH).trim();
}
