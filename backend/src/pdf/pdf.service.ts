import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PdfInspectorService } from './pdf-inspector.service';
import { PrismaService } from '../prisma/prisma.service';
import { PdfSearchService } from './pdf-search.service';
import { PdfDownloadService } from './pdf-download.service';
import {
  expectedPages,
  pageTolerance,
  pagesMatch,
  pdfSearchQuery,
} from './pdf-matching';

export interface PdfExtraction {
  status: 'matched' | 'no_match' | 'missing_metadata' | 'not_configured';
  message: string;
  query?: string;
  expectedPages?: number;
  tolerancePages?: number;
  pdfPages?: number;
  sourceUrl?: string;
  token?: string;
}
interface CachedPdf {
  result: PdfExtraction;
  bytes?: Buffer;
  expiresAt: number;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly cache = new Map<number, CachedPdf>();
  private readonly pending = new Map<number, Promise<PdfExtraction>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly search: PdfSearchService,
    private readonly downloader: PdfDownloadService,
    private readonly inspector: PdfInspectorService,
  ) {}

  async extract(productId: number): Promise<PdfExtraction> {
    this.prune();
    const cached = this.cache.get(productId);
    if (cached) return cached.result;
    const existing = this.pending.get(productId);
    if (existing) return existing;
    if (this.pending.size >= 2)
      throw new ServiceUnavailableException(
        'PDF search is busy. Please try again shortly.',
      );
    const work = this.findPdf(productId);
    this.pending.set(productId, work);
    try {
      return await work;
    } finally {
      this.pending.delete(productId);
    }
  }

  read(productId: number, token: string): Buffer {
    this.prune();
    const cached = this.cache.get(productId);
    if (!cached?.bytes || cached.result.token !== token) {
      throw new NotFoundException(
        'PDF has expired. Click Extract PDF to search again.',
      );
    }
    return cached.bytes;
  }

  private async findPdf(productId: number): Promise<PdfExtraction> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');
    const pages = expectedPages(product.specs);
    if (!product.title.trim() || !product.author?.trim() || !pages) {
      return {
        status: 'missing_metadata',
        message:
          'This book needs a title, author and World of Books page count before a PDF can be matched.',
      };
    }
    const query = pdfSearchQuery(product.title, product.author);
    const metadata = {
      query,
      expectedPages: pages,
      tolerancePages: pageTolerance(pages),
    };
    if (!this.search.isConfigured()) {
      return {
        ...metadata,
        status: 'not_configured',
        message: 'Automatic PDF search has not been configured for this site.',
      };
    }
    const candidates = await this.search.search(query);
    let best: { bytes: Buffer; url: string; count: number } | undefined;
    for (const candidate of candidates) {
      try {
        const { bytes, url } = await this.downloader.download(candidate);
        const count = await this.inspector.countPages(bytes);
        if (
          pagesMatch(pages, count) &&
          (!best || Math.abs(pages - count) < Math.abs(pages - best.count))
        ) {
          best = { bytes, url, count };
          if (count === pages) break;
        }
      } catch {
        this.logger.debug(
          `Skipped an unreadable PDF candidate for product ${productId}`,
        );
      }
    }
    if (!best) {
      const result: PdfExtraction = {
        ...metadata,
        status: 'no_match',
        message:
          'No readable PDF with a similar page count was found. Previews, blocked downloads and different editions may not match.',
      };
      this.remember(productId, { result, expiresAt: Date.now() + 60000 });
      return result;
    }
    const result: PdfExtraction = {
      ...metadata,
      status: 'matched',
      pdfPages: best.count,
      sourceUrl: best.url,
      token: randomUUID(),
      message: 'A PDF with a similar page count was found.',
    };
    // Retain the exact bytes we counted so redirects/changed sources cannot swap the reader content.
    this.remember(productId, {
      result,
      bytes: best.bytes,
      expiresAt: Date.now() + 10 * 60000,
    });
    return result;
  }

  private remember(id: number, entry: CachedPdf): void {
    this.prune();
    if (this.cache.size >= 3)
      this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(id, entry);
  }

  private prune(): void {
    for (const [id, entry] of this.cache) {
      if (entry.expiresAt <= Date.now()) this.cache.delete(id);
    }
  }
}
