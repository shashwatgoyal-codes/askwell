import { describe, expect, it } from 'vitest';
import { providerDetail, redactKeys } from './providers';

describe('key redaction in provider messages', () => {
  it.each([
    ['Incorrect API key provided: sk-proj-abc123***************xyz9. You can find your API key at …', 'sk-proj'],
    ['invalid x-api-key: sk-ant-api03-abcdef', 'sk-ant'],
    ['API key not valid: AIzaSyD-abcdefghijk', 'AIza'],
    ['Key abcdefgh******wxyz was revoked', 'abcdefgh'],
  ])('hides the key in %j', (message, fragment) => {
    const out = redactKeys(message);
    expect(out).not.toContain(fragment);
    expect(out).toContain('[key hidden]');
  });

  it('leaves ordinary messages alone', () => {
    const message = 'models/gemini-2.5-flash is not found for API version v1beta';
    expect(redactKeys(message)).toBe(message);
  });

  it('redacts inside the detail shown to the user', () => {
    const error = new Error('{"error":{"code":401,"message":"Incorrect API key provided: sk-abcd1234****wxyz"}}');
    expect(providerDetail(error)).toBe('Incorrect API key provided: [key hidden]');
  });
});
