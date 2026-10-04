import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { PdfInspectorService } from './pdf-inspector.service';
import { PdfService } from './pdf.service';
import {
  expectedPages,
  pagesMatch,
  pageTolerance,
  pdfSearchQuery,
} from './pdf-matching';

async function makePdf(pages: number): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  for (let page = 0; page < pages; page++) pdf.addPage();
  return Buffer.from(await pdf.save());
}

describe('PDF metadata and matching', () => {
  it.each([
    [{ Pages: '320 pages' }, 320],
    [{ 'Number of pages': 1024 }, 1024],
    [{ 'Page count': '1,024' }, 1024],
    [{ 'No. of pages': '220 pp.' }, 220],
    [{ Pagination: 'unknown' }, null],
    [{ Pages: '320-340' }, null],
    [{ Pages: '-320' }, null],
    [{ Pages: 0 }, null],
    [{ Pages: 20001 }, null],
    [{ Pages: '320,000' }, null],
    [null, null],
    [[], null],
  ])('parses only reliable counts from %j', (specs, expected) => {
    expect(expectedPages(specs)).toBe(expected);
  });
  it('uses an inclusive five percent tolerance with a five-page minimum', () => {
    expect(pageTolerance(320)).toBe(16);
    expect(pagesMatch(320, 304)).toBe(true);
    expect(pagesMatch(320, 336)).toBe(true);
    expect(pagesMatch(320, 303)).toBe(false);
    expect(pagesMatch(320, 337)).toBe(false);
    expect(pagesMatch(20, 25)).toBe(true);
    expect(pagesMatch(20, 26)).toBe(false);
    expect(pagesMatch(0, 0)).toBe(false);
  });
  it('quotes both fields and removes embedded quotes and line breaks', () => {
    expect(pdfSearchQuery('A "Book"\nTitle', 'Jane Doe')).toBe(
      '"A Book Title" "Jane Doe" filetype:pdf',
    );
  });
});

describe('PdfService', () => {
  const product = {
    id: 1,
    title: 'Example Book',
    author: 'Jane Doe',
    specs: { 'Number of pages': '20' },
  };
  let service: PdfService;
  let prisma: { product: { findUnique: jest.Mock } };
  let search: { isConfigured: jest.Mock; search: jest.Mock };
  let downloader: { download: jest.Mock };
  let full: Buffer;
  let preview: Buffer;
  let near: Buffer;

  beforeAll(async () => {
    [full, preview, near] = await Promise.all([
      makePdf(20),
      makePdf(3),
      makePdf(22),
    ]);
  });
  beforeEach(() => {
    prisma = { product: { findUnique: jest.fn().mockResolvedValue(product) } };
    search = {
      isConfigured: jest.fn().mockReturnValue(true),
      search: jest.fn().mockResolvedValue(['https://books.example/full.pdf']),
    };
    downloader = {
      download: jest.fn().mockResolvedValue({
        bytes: full,
        url: 'https://books.example/full.pdf',
      }),
    };
    service = new PdfService(
      prisma as never,
      search as never,
      downloader as never,
      new PdfInspectorService(),
    );
  });

  it('counts a generated PDF and serves the exact bytes with its token', async () => {
    const match = await service.extract(1);
    expect(search.search).toHaveBeenCalledWith(
      '"Example Book" "Jane Doe" filetype:pdf',
    );
    expect(match).toMatchObject({
      status: 'matched',
      expectedPages: 20,
      pdfPages: 20,
      tolerancePages: 5,
    });
    expect(service.read(1, match.token!)).toEqual(full);
    expect(() => service.read(2, match.token!)).toThrow(NotFoundException);
    expect(() => service.read(1, 'other-token')).toThrow(NotFoundException);
  });
  it('skips a preview and selects the closest match', async () => {
    search.search.mockResolvedValue(['preview', 'near', 'exact']);
    downloader.download
      .mockResolvedValueOnce({
        bytes: preview,
        url: 'https://books.example/preview.pdf',
      })
      .mockResolvedValueOnce({
        bytes: near,
        url: 'https://books.example/near.pdf',
      })
      .mockResolvedValueOnce({
        bytes: full,
        url: 'https://books.example/full.pdf',
      });
    expect(await service.extract(1)).toMatchObject({
      status: 'matched',
      pdfPages: 20,
      sourceUrl: 'https://books.example/full.pdf',
    });
  });
  it('keeps the near match if later candidates fail', async () => {
    search.search.mockResolvedValue(['near', 'broken']);
    downloader.download
      .mockResolvedValueOnce({
        bytes: near,
        url: 'https://books.example/near.pdf',
      })
      .mockRejectedValueOnce(new Error('blocked'));
    expect(await service.extract(1)).toMatchObject({
      status: 'matched',
      pdfPages: 22,
    });
  });
  it('rejects malformed and password-protected PDFs without bypassing encryption', async () => {
    search.search.mockResolvedValue(['html', 'encrypted']);
    const protectedDoc = await PDFDocument.create();
    protectedDoc.addPage();
    protectedDoc.context.trailerInfo.Encrypt = protectedDoc.context.register(
      protectedDoc.context.obj({ Filter: 'Standard' }),
    );
    const encrypted = Buffer.from(await protectedDoc.save());
    downloader.download
      .mockResolvedValueOnce({
        bytes: Buffer.from('<html>'),
        url: 'https://books.example/html',
      })
      .mockResolvedValueOnce({
        bytes: encrypted,
        url: 'https://books.example/encrypted.pdf',
      });
    expect(await service.extract(1)).toMatchObject({ status: 'no_match' });
  });
  it('returns no match for previews and caches the outcome', async () => {
    downloader.download.mockResolvedValue({
      bytes: preview,
      url: 'https://books.example/preview.pdf',
    });
    expect(await service.extract(1)).toMatchObject({ status: 'no_match' });
    await service.extract(1);
    expect(search.search).toHaveBeenCalledTimes(1);
  });
  it.each([
    { ...product, author: null },
    { ...product, author: ' ' },
    { ...product, specs: {} },
    { ...product, title: '' },
  ])('avoids searching without required metadata', async (incomplete) => {
    prisma.product.findUnique.mockResolvedValue(incomplete);
    expect(await service.extract(1)).toMatchObject({
      status: 'missing_metadata',
    });
    expect(search.search).not.toHaveBeenCalled();
  });
  it('returns a manual search query if the provider is unconfigured', async () => {
    search.isConfigured.mockReturnValue(false);
    expect(await service.extract(1)).toMatchObject({
      status: 'not_configured',
      query: '"Example Book" "Jane Doe" filetype:pdf',
    });
    expect(search.search).not.toHaveBeenCalled();
  });
  it('returns 404 for unknown books', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(service.extract(1)).rejects.toThrow(NotFoundException);
  });
  it('deduplicates concurrent requests and reuses validated bytes', async () => {
    const [one, two] = await Promise.all([
      service.extract(1),
      service.extract(1),
    ]);
    expect(one).toEqual(two);
    await service.extract(1);
    expect(search.search).toHaveBeenCalledTimes(1);
    expect(downloader.download).toHaveBeenCalledTimes(1);
  });
  it('expires matched bytes after ten minutes', async () => {
    const result = await service.extract(1);
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now + 10 * 60000 + 1);
    expect(() => service.read(1, result.token!)).toThrow(NotFoundException);
    clock.mockRestore();
    await service.extract(1);
    expect(search.search).toHaveBeenCalledTimes(2);
  });
  it('bounds cached outcomes to three books', async () => {
    const result = await service.extract(1);
    await service.extract(2);
    await service.extract(3);
    await service.extract(4);
    expect(() => service.read(1, result.token!)).toThrow(NotFoundException);
  });
  it('does not cache provider errors', async () => {
    search.search.mockRejectedValueOnce(new ServiceUnavailableException());
    await expect(service.extract(1)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(await service.extract(1)).toMatchObject({ status: 'matched' });
  });
  it('rejects overload while sharing requests already in flight', async () => {
    let finish: (urls: string[]) => void = () => {};
    search.search.mockReturnValue(
      new Promise<string[]>((resolve) => {
        finish = resolve;
      }),
    );
    const one = service.extract(1);
    const two = service.extract(2);
    await expect(service.extract(3)).rejects.toThrow(
      ServiceUnavailableException,
    );
    finish([]);
    await Promise.all([one, two]);
  });
});
