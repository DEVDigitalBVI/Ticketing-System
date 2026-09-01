import "server-only";

import { randomInt } from "node:crypto";

const groups = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnopqrstuvwxyz",
  "23456789",
  "!@#$%&*+-=?",
] as const;
const alphabet = groups.join("");

function pick(source: string) {
  return source[randomInt(source.length)];
}

export function createTemporaryPassword() {
  const characters = [...groups.map(pick), ...Array.from({ length: 16 }, () => pick(alphabet))];
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1);
    [characters[index], characters[swap]] = [characters[swap], characters[index]];
  }
  return characters.join("");
}
