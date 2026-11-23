/** ULID (시간순 정렬되는 26자 id). Rust `storage::is_valid_id`와 같은 문자 집합. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function isValidId(id: unknown): id is string {
  return typeof id === "string" && ULID_PATTERN.test(id);
}

export function ulid(now: number = Date.now()): string {
  let time = "";
  for (let t = now, i = 0; i < 10; i++, t = Math.floor(t / 32)) time = ALPHABET[t % 32] + time;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let rand = "";
  for (const b of bytes) rand += ALPHABET[b % 32];
  return time + rand;
}
