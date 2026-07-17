import { prisma } from "@/lib/db";

export async function getConversation(userId: string, conversationId: string) {
  const conv = await prisma.aIConversation.findFirst({
    where: { id: conversationId, userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          toolCalls: true,
          recommendation: true,
          financialSnapshot: true,
        },
      },
      financialSnapshot: true,
    },
  });

  if (!conv) return null;

  const latestSnapshot = await prisma.financialStateSnapshot.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const snapshotStale =
    !!conv.financialSnapshotId &&
    !!latestSnapshot &&
    conv.financialSnapshotId !== latestSnapshot.id;

  return { ...conv, snapshotStale };
}

export async function submitFeedback(
  userId: string,
  messageId: string,
  feedback: "positive" | "negative",
  note?: string
) {
  const message = await prisma.aIMessage.findFirst({
    where: { id: messageId, conversation: { userId } },
  });
  if (!message) throw new Error("Message not found");

  return prisma.aIMessage.update({
    where: { id: messageId },
    data: { feedback, feedbackNote: note },
  });
}

export async function listConversations(userId: string) {
  return prisma.aIConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}
