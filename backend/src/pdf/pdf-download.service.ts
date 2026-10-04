import { Injectable } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import ipaddr from 'ipaddr.js';

export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export function isPublicAddress(address: string): boolean {
  try {
    // process() converts IPv4-mapped IPv6 before checking reserved ranges.
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
}

@Injectable()
export class PdfDownloadService {
  async download(rawUrl: string): Promise<{ bytes: Buffer; url: string }> {
    const deadline = Date.now() + 8000;
    let url = new URL(rawUrl);
    for (let redirects = 0; redirects <= 3; redirects++) {
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        (url.port && url.port !== '443')
      ) {
        throw new Error('Only public HTTPS PDF sources are supported');
      }
      const hostname = url.hostname.replace(/^\[|\]$/g, '');
      const records = await this.withDeadline(
        lookup(hostname, { all: true }),
        deadline,
      );
      if (
        !records.length ||
        records.some(({ address }) => !isPublicAddress(address))
      ) {
        throw new Error('PDF source resolves to a non-public address');
      }
      const record = records[0];
      const response = await new Promise<{ bytes?: Buffer; location?: string }>(
        (resolve, reject) => {
          // Pin the checked address to this request; do not resolve it again in the socket.
          const req = request(
            url,
            {
              agent: false,
              family: record.family,
              lookup: (_host, _options, callback) =>
                callback(null, record.address, record.family),
              headers: {
                Accept: 'application/pdf',
                'User-Agent': 'WorldOfBooks-PdfReader/1.0',
              },
            },
            (res) => {
              res.on('error', reject);
              if (
                [301, 302, 303, 307, 308].includes(res.statusCode || 0) &&
                res.headers.location
              ) {
                resolve({ location: res.headers.location });
                res.destroy();
                return;
              }
              if (
                res.statusCode !== 200 ||
                Number(res.headers['content-length']) > MAX_PDF_BYTES
              ) {
                reject(new Error('PDF source unavailable or too large'));
                res.destroy();
                return;
              }
              const chunks: Buffer[] = [];
              let length = 0;
              res.on('data', (chunk: Buffer) => {
                length += chunk.length;
                if (length > MAX_PDF_BYTES) {
                  reject(new Error('PDF exceeds the 20 MiB limit'));
                  res.destroy();
                  return;
                }
                chunks.push(chunk);
              });
              res.on('end', () => resolve({ bytes: Buffer.concat(chunks) }));
            },
          );
          const timer = setTimeout(
            () => req.destroy(new Error('PDF download timed out')),
            Math.max(1, deadline - Date.now()),
          );
          req.on('close', () => clearTimeout(timer));
          req.on('error', reject);
          req.end();
        },
      );
      if (response.location) {
        // Recheck DNS and protocol on every redirect, including relative redirects.
        url = new URL(response.location, url);
        continue;
      }
      const bytes = response.bytes!;
      if (bytes.subarray(0, 1024).indexOf('%PDF-') < 0)
        throw new Error('Source is not a PDF');
      return { bytes, url: url.toString() };
    }
    throw new Error('Too many PDF redirects');
  }

  private async withDeadline<T>(
    work: Promise<T>,
    deadline: number,
  ): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('PDF lookup timed out')),
            Math.max(1, deadline - Date.now()),
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}
