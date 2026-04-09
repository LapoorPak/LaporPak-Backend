export const CITIZEN_PORTAL = "citizen";
export const AGENCY_PORTAL = "agency";
export const ADMIN_PORTAL = "admin";

export type AuthPortal =
  | typeof CITIZEN_PORTAL
  | typeof AGENCY_PORTAL
  | typeof ADMIN_PORTAL;

export function isAdminRole(role: string | null | undefined) {
  return role === "admin";
}

export function isCitizenRole(role: string | null | undefined) {
  return typeof role !== "string" || !role.trim() || role === "warga";
}

export function isAgencyRole(role: string | null | undefined) {
  return (
    typeof role === "string" &&
    role.trim().length > 0 &&
    role !== "warga" &&
    role !== "admin"
  );
}

export function isStaffRole(role: string | null | undefined) {
  return isAgencyRole(role) || isAdminRole(role);
}

export function getPortalForRole(role: string | null | undefined): AuthPortal {
  if (isAdminRole(role)) {
    return ADMIN_PORTAL;
  }

  if (isAgencyRole(role)) {
    return AGENCY_PORTAL;
  }

  return CITIZEN_PORTAL;
}
