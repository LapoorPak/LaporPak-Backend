import { prisma } from "../../config/db.js";

export type ReportFeedback = {
  upvotes: number;
  downvotes: number;
  voteScore: number;
  myVote: number | null;
  rating: {
    id: string;
    score: number;
    note: string | null;
    userId: string;
    dinasId: string | null;
    cabangDinasId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
};

export function emptyReportFeedback(): ReportFeedback {
  return {
    upvotes: 0,
    downvotes: 0,
    voteScore: 0,
    myVote: null,
    rating: null,
  };
}

export async function getReportFeedbackByIds(laporanIds: string[], userId?: string | null) {
  const uniqueIds = [...new Set(laporanIds)].filter(Boolean);
  const feedbackMap = new Map<string, ReportFeedback>();

  for (const id of uniqueIds) {
    feedbackMap.set(id, emptyReportFeedback());
  }

  if (uniqueIds.length === 0) {
    return feedbackMap;
  }

  const [voteGroups, myVotes, ratings] = await Promise.all([
    prisma.trLaporanVote.groupBy({
      by: ["laporanId", "value"],
      where: { laporanId: { in: uniqueIds } },
      _count: { _all: true },
    }),
    userId
      ? prisma.trLaporanVote.findMany({
          where: { laporanId: { in: uniqueIds }, userId },
          select: { laporanId: true, value: true },
        })
      : Promise.resolve([]),
    prisma.trLaporanRating.findMany({
      where: { laporanId: { in: uniqueIds } },
      select: {
        laporanId: true,
        id: true,
        score: true,
        note: true,
        userId: true,
        dinasId: true,
        cabangDinasId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  for (const group of voteGroups) {
    const feedback = feedbackMap.get(group.laporanId) ?? emptyReportFeedback();
    if (group.value > 0) {
      feedback.upvotes += group._count._all;
    } else if (group.value < 0) {
      feedback.downvotes += group._count._all;
    }
    feedback.voteScore = feedback.upvotes - feedback.downvotes;
    feedbackMap.set(group.laporanId, feedback);
  }

  for (const vote of myVotes) {
    const feedback = feedbackMap.get(vote.laporanId) ?? emptyReportFeedback();
    feedback.myVote = vote.value;
    feedbackMap.set(vote.laporanId, feedback);
  }

  for (const rating of ratings) {
    const feedback = feedbackMap.get(rating.laporanId) ?? emptyReportFeedback();
    feedback.rating = {
      id: rating.id,
      score: rating.score,
      note: rating.note,
      userId: rating.userId,
      dinasId: rating.dinasId,
      cabangDinasId: rating.cabangDinasId,
      createdAt: rating.createdAt,
      updatedAt: rating.updatedAt,
    };
    feedbackMap.set(rating.laporanId, feedback);
  }

  return feedbackMap;
}

export function getReportFeedback(feedbackMap: Map<string, ReportFeedback>, laporanId: string) {
  return feedbackMap.get(laporanId) ?? emptyReportFeedback();
}
