import { createHash } from 'node:crypto';

export const DEFAULT_PREFIX = 'cas-';
export const DEFAULT_LENGTH = 8;

export interface HashOptions {
  readonly prefix?: string;
  readonly length?: number;
}

export function hash(canonical: string, options: HashOptions = {}): string {
  const prefix = options.prefix ?? DEFAULT_PREFIX;
  const length = options.length ?? DEFAULT_LENGTH;
  const digest = createHash('sha1').update(canonical).digest('hex');
  return prefix + digest.slice(0, length);
}
