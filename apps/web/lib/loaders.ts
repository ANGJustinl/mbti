import { readFile } from "node:fs/promises";
import path from "node:path";

import type { DebateTopic, WmtiQuestion } from "@dual-core/domain";

interface QuestionsPayload {
  questions: WmtiQuestion[];
}

interface TopicsPayload {
  topics: DebateTopic[];
}

export interface CandidateSeed {
  userId: string;
  name: string;
  roleTag: string;
  letters: string;
  lifeModeTitle: string;
  workModeTitle: string;
  strengths: string[];
  risks: string[];
  collaborationStyle: string[];
}

interface CandidatePayload {
  candidates: CandidateSeed[];
}

async function readJson<T>(subpath: string): Promise<T> {
  const roots = [
    path.resolve(process.cwd(), "data", subpath),
    path.resolve(process.cwd(), "..", "..", "data", subpath),
  ];

  for (const filePath of roots) {
    try {
      const content = await readFile(filePath, "utf8");
      return JSON.parse(content) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  throw new Error(`Unable to locate data file: ${subpath}`);
}

export async function loadQuestions() {
  const payload = await readJson<QuestionsPayload>("wmti/questions.v1.json");
  return payload.questions;
}

export async function loadTopics() {
  const payload = await readJson<TopicsPayload>("zhihu/topics.seed.json");
  return payload.topics;
}

export async function loadCandidates() {
  const payload = await readJson<CandidatePayload>("demo/candidates.seed.json");
  return payload.candidates;
}

