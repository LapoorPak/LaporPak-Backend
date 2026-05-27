import { prisma } from "../../config/db.js";
import { Stsrc } from "../../generated/prisma/client.js";
import type {
  CabangRoutingCandidate,
  CabangRoutingResolution,
} from "../../types/routing.js";
import { getWilayah } from "./geo.service.js";

export type {
  CabangRoutingCandidate,
  CabangRoutingResolution,
} from "../../types/routing.js";

const EARTH_RADIUS_KM = 6371;

function degreesToRadians(deg: number) {
  return deg * (Math.PI / 180);
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = degreesToRadians(lat2 - lat1);
  const dLng = degreesToRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function resolveCabangDinas(params: {
  dinasType: string;
  latitude: number;
  longitude: number;
}): Promise<CabangRoutingResolution> {
  const wilayah = getWilayah(params.latitude, params.longitude);
  const cabangList = await prisma.msCabangDinas.findMany({
    where: {
      isRoutingEnabled: true,
      stsrc: { not: Stsrc.D },
      OR: [
        { dinas: { type: params.dinasType } },
        { serviceTags: { has: params.dinasType } },
      ],
      dinas: {
        isActive: true,
        stsrc: { not: Stsrc.D },
      },
    },
    include: {
      dinas: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  if (cabangList.length === 0) {
    return {
      assignedCabang: null,
      routingStatus: "failed",
      routingSource: "no_active_branch",
      wilayah,
      wilayahMatched: null,
      distanceKm: null,
      reasoning: `Tidak ada cabang aktif untuk tipe dinas ${params.dinasType}.`,
      candidateCabang: [],
    };
  }

  const candidates = cabangList
    .map((cabang) => {
      const hasCoordinates =
        typeof cabang.latitude === "number" && typeof cabang.longitude === "number";
      const distanceKm = hasCoordinates
        ? haversineDistance(
            params.latitude,
            params.longitude,
            cabang.latitude as number,
            cabang.longitude as number,
          )
        : null;

      return {
        cabang,
        distanceKm,
      };
    })
    .sort((left, right) => {
      if (left.distanceKm == null && right.distanceKm == null) {
        return 0;
      }

      if (left.distanceKm == null) {
        return 1;
      }

      if (right.distanceKm == null) {
        return -1;
      }

      return left.distanceKm - right.distanceKm;
    });

  const candidateCabang = candidates.slice(0, 3).map((candidate) => ({
    id: candidate.cabang.id,
    name: candidate.cabang.name,
    wilayah: candidate.cabang.wilayah,
    cityRegency: candidate.cabang.cityRegency ?? null,
    distanceKm: candidate.distanceKm == null ? null : Number(candidate.distanceKm.toFixed(2)),
    coverageRadiusKm: candidate.cabang.coverageRadiusKm ?? null,
  }));

  if (wilayah) {
    const exactWilayahMatch = candidates.find((candidate) => candidate.cabang.wilayah === wilayah);

    if (exactWilayahMatch) {
      return {
        assignedCabang: exactWilayahMatch.cabang,
        routingStatus: "auto_assigned",
        routingSource: "wilayah_match",
        wilayah,
        wilayahMatched: wilayah,
        distanceKm:
          exactWilayahMatch.distanceKm == null
            ? null
            : Number(exactWilayahMatch.distanceKm.toFixed(2)),
        reasoning: `Cabang dipilih karena koordinat masuk ke wilayah ${wilayah}.`,
        candidateCabang,
      };
    }
  }

  const withinCoverage = candidates.find((candidate) => {
    if (candidate.distanceKm == null) {
      return false;
    }

    if (candidate.cabang.coverageRadiusKm == null) {
      return true;
    }

    return candidate.distanceKm <= candidate.cabang.coverageRadiusKm;
  });

  if (withinCoverage) {
    return {
      assignedCabang: withinCoverage.cabang,
      routingStatus: "auto_assigned",
      routingSource: "nearest_branch",
      wilayah,
      wilayahMatched: null,
      distanceKm: Number(withinCoverage.distanceKm!.toFixed(2)),
      reasoning: "Cabang terdekat dengan coverage aktif dipilih sebagai fallback routing.",
      candidateCabang,
    };
  }

  const nearestCandidate = candidates[0];
  if (nearestCandidate) {
    return {
      assignedCabang: nearestCandidate.cabang,
      routingStatus: "manual_review",
      routingSource: "nearest_outside_coverage",
      wilayah,
      wilayahMatched: null,
      distanceKm:
        nearestCandidate.distanceKm == null
          ? null
          : Number(nearestCandidate.distanceKm.toFixed(2)),
      reasoning:
        "Tidak ada cabang dalam coverage radius. Cabang terdekat dipilih dan laporan perlu review manual.",
      candidateCabang,
    };
  }

  return {
    assignedCabang: cabangList[0],
    routingStatus: "manual_review",
    routingSource: "first_available_branch",
    wilayah,
    wilayahMatched: null,
    distanceKm: null,
    reasoning: "Cabang pertama yang tersedia dipilih karena data koordinat cabang belum lengkap.",
    candidateCabang,
  };
}
