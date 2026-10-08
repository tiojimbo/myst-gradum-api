import { Injectable } from '@nestjs/common';
import { VersionedPrompt } from './ai.params';
import { BASE_SYSTEM_V1 } from './prompts/base.system.v1';
@Injectable()
export class PromptRegistry {
  private readonly prompts = new Map<string, Readonly<VersionedPrompt>>();
  constructor() {
    this.register(BASE_SYSTEM_V1);
  }
  get(name: string, version: number): Readonly<VersionedPrompt> {
    const prompt = this.prompts.get(`${name}:${version}`);
    if (!prompt) throw new Error('PROMPT_NOT_REGISTERED');
    return prompt;
  }
  register(prompt: VersionedPrompt): void {
    if (
      !/^[a-z][a-z0-9.-]*$/.test(prompt.name) ||
      !Number.isInteger(prompt.version) ||
      prompt.version < 1 ||
      !prompt.system.trim()
    )
      throw new Error('PROMPT_INVALID');
    const key = `${prompt.name}:${prompt.version}`;
    if (this.prompts.has(key)) throw new Error('PROMPT_VERSION_EXISTS');
    this.prompts.set(key, Object.freeze({ ...prompt }));
  }
}
