import { Injectable } from '@nestjs/common';
import { Worker } from 'node:worker_threads';

/** Parse untrusted PDFs away from the API event loop, with time and heap limits. */
@Injectable()
export class PdfInspectorService {
  countPages(bytes: Buffer): Promise<number> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        `
        const { parentPort, workerData } = require('node:worker_threads');
        const { PDFDocument } = require(workerData.library);
        (async () => {
          const document = await PDFDocument.load(workerData.bytes, { updateMetadata: false });
          if (document.isEncrypted) throw new Error('Encrypted PDF');
          parentPort.postMessage(document.getPageCount());
        })().catch(() => { throw new Error('Unreadable PDF'); });
      `,
        {
          eval: true,
          workerData: { bytes, library: require.resolve('pdf-lib') },
          resourceLimits: {
            maxOldGenerationSizeMb: 96,
            maxYoungGenerationSizeMb: 16,
          },
        },
      );
      const timer = setTimeout(() => {
        reject(new Error('PDF parsing timed out'));
        void worker.terminate();
      }, 3000);
      worker.once('message', (count: number) => {
        clearTimeout(timer);
        resolve(count);
        void worker.terminate();
      });
      worker.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      worker.once('exit', () => {
        clearTimeout(timer);
        reject(new Error('PDF parser exited'));
      });
    });
  }
}
