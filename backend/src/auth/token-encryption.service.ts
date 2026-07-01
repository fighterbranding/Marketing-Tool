import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

@Injectable()
export class TokenEncryptionService {
  private readonly key: Buffer;

  constructor() {
    const raw = process.env.TOKEN_ENCRYPTION_KEY ?? '';
    this.key = Buffer.from(raw, 'hex');
  }

  encrypt(token: string): { ciphertext: string; iv: string; tag: string } {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
    };
  }

  decrypt(ciphertext: string, iv: string, tag: string): string {
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
