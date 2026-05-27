import type { Prisma } from "../generated/prisma/client.js";

export interface CabangRoutingCandidate {
  id: string;
  name: string;
  wilayah: string;
  cityRegency: string | null;
  distanceKm: number | null;
  coverageRadiusKm: number | null;
}

export interface CabangRoutingResolution {
  assignedCabang: Prisma.MsCabangDinasGetPayload<{ include: { dinas: true } }> | null;
  routingStatus: "auto_assigned" | "manual_review" | "failed";
  routingSource: string;
  wilayah: string | null;
  wilayahMatched: string | null;
  distanceKm: number | null;
  reasoning: string;
  candidateCabang: CabangRoutingCandidate[];
}
