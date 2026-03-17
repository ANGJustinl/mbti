import type { DebateTopic } from "@dual-core/domain";

import { loadTopics } from "../loaders";

interface RemoteTopic {
  id: string;
  title: string;
  sourceUrl?: string;
  prompt?: string;
  riskTags?: string[];
}

function normalizeTopic(topic: RemoteTopic): DebateTopic {
  return {
    id: topic.id,
    title: topic.title,
    sourceUrl: topic.sourceUrl ?? "https://www.zhihu.com/",
    prompt: topic.prompt ?? `${topic.title}，你会如何处理？`,
    riskTags: topic.riskTags ?? [],
  };
}

export async function getZhihuTopics(): Promise<DebateTopic[]> {
  const baseUrl = process.env.ZHIHU_API_BASE_URL;
  const apiKey = process.env.ZHIHU_API_KEY;

  if (!baseUrl) {
    return loadTopics();
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/topics`, {
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Zhihu topic request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { topics?: RemoteTopic[] };
  if (!payload.topics?.length) {
    return loadTopics();
  }

  return payload.topics.map(normalizeTopic);
}

