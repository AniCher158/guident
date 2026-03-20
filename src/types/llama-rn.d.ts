declare module 'llama.rn' {
  export function initLlama(options: Record<string, unknown>): Promise<{
    completion(options: Record<string, unknown>): Promise<unknown>;
  }>;
}
