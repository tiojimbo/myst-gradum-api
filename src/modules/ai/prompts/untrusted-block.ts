import { JsonValue } from '../ai.params';
export function buildUntrustedBlock(input: JsonValue): string {
  const json = JSON.stringify(input)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return `<untrusted_data>\n${json}\n</untrusted_data>`;
}
