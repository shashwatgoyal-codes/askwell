// Prints the ADMIN_PASSWORD_HASH for a password typed here, never shown.
//   pnpm --filter @askwell/portal hash-password

import { stdin, stdout } from 'node:process';
import { hashPassword, verifyPassword } from '../lib/password.ts';

// Input typed (or piped) ahead of the next question is kept for it.
let pending = '';

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    stdout.write(question);
    let value = '';
    const take = (chunk: string): boolean => {
      for (let i = 0; i < chunk.length; i++) {
        const char = chunk[i]!;
        if (char === '\r' || char === '\n') {
          pending = chunk.slice(i + 1).replace(/^\n/, '');
          stdout.write('\n');
          resolve(value);
          return true;
        }
        if (char === '\u0003') process.exit(130); // Ctrl+C
        if (char === '\u007f') value = value.slice(0, -1); // Backspace
        else value += char;
      }
      return false;
    };
    const buffered = pending;
    pending = '';
    if (take(buffered)) return;
    const onData = (chunk: string) => {
      if (!take(chunk)) return;
      stdin.off('data', onData);
      stdin.setRawMode?.(false);
      stdin.pause();
    };
    stdin.setRawMode?.(true);
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
    stdin.resume();
  });
}

const password = await ask('New admin password: ');
if (password.length < 12) {
  console.error('Use at least 12 characters; a password manager’s 20+ is better.');
  process.exit(1);
}
if ((await ask('Again: ')) !== password) {
  console.error('The two didn’t match. Nothing was printed.');
  process.exit(1);
}
const hash = await hashPassword(password);
if (!(await verifyPassword(password, hash))) throw new Error('The new hash did not verify.');
console.log(`\nADMIN_PASSWORD_HASH=${hash}\n`);
console.log('Put that line in Vercel (or .env.local). The password itself is stored nowhere.');
