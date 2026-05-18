import { test, expect, describe } from 'bun:test';
import { applyExtractionDefaults, EXTRACTION_DEFAULTS } from './defaults';

describe('applyExtractionDefaults', () => {
  test('undefined config → alle defaults', () => {
    const resolved = applyExtractionDefaults(undefined);
    expect(resolved).toEqual(EXTRACTION_DEFAULTS);
  });

  test('partielle config — nur die gesetzten Felder überschreiben', () => {
    const resolved = applyExtractionDefaults({ strategy: 'long-text-chunked', chunk_size_tokens: 5000 });
    expect(resolved.strategy).toBe('long-text-chunked');
    expect(resolved.chunk_size_tokens).toBe(5000);
    expect(resolved.chunk_overlap_tokens).toBe(EXTRACTION_DEFAULTS.chunk_overlap_tokens);
    expect(resolved.merge_strategy).toBe(EXTRACTION_DEFAULTS.merge_strategy);
  });

  test('model_override durchgereicht', () => {
    const resolved = applyExtractionDefaults({
      model_override: { provider_id: 'adacor', model_id: 'qwen3-a3bthinking-30b-256k' },
    });
    expect(resolved.model_override).toEqual({ provider_id: 'adacor', model_id: 'qwen3-a3bthinking-30b-256k' });
  });

  test('explizites false überschreibt true-Default', () => {
    const resolved = applyExtractionDefaults({ section_aware: false });
    expect(resolved.section_aware).toBe(false);
  });
});
