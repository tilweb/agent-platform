import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../../db';
import { extractionEvaluations } from '../../db/schema/extraction';
import type { EvalOutcome } from './eval';
import type { ExtractionSnapshot } from './snapshot';
import type { TrainingExample } from './types';

export interface EvaluationArtifact {
  score: EvalOutcome;
  snapshot: ExtractionSnapshot;
  tests: TrainingExample[];
}

export async function saveEvaluation(projectId: string, artifact: EvaluationArtifact): Promise<string> {
  const id = randomUUID();
  await getDb().insert(extractionEvaluations).values({ id, projectId, artifact: artifact as never });
  return id;
}

export async function getEvaluation(projectId: string, id: string): Promise<EvaluationArtifact | null> {
  const [row] = await getDb().select().from(extractionEvaluations)
    .where(and(eq(extractionEvaluations.id, id), eq(extractionEvaluations.projectId, projectId)));
  return row ? row.artifact as EvaluationArtifact : null;
}
