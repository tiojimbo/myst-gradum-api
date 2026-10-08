import { AiEngine, AiRunStatus } from '@prisma/client';
import { z } from 'zod';
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export interface AiOutputContract<TOutput> {
  schema: z.ZodType<TOutput>;
  jsonSchema: JsonObject;
}
export interface PromptReference {
  name: string;
  version: number;
}
export interface VersionedPrompt extends PromptReference {
  system: string;
}
export interface AiMessage {
  role: 'system' | 'user';
  content: string;
}
export interface CompletionParams {
  model: string;
  messages: AiMessage[];
  schema: JsonObject;
  schemaName: string;
  signal: AbortSignal;
}
export interface AiCompletion {
  content?: string;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
}
export interface CreateAiRun {
  engine: AiEngine;
  promptName: string;
  promptVersion: number;
  model: string;
  input: JsonValue;
  status: 'PENDING';
}
export interface UpdateAiRun {
  status: AiRunStatus;
  model?: string;
  output?: JsonValue;
  validationErrors?: JsonValue;
  tokensIn?: number | null;
  tokensOut?: number | null;
  costUsd?: number | null;
  latencyMs?: number;
  error?: string;
}
