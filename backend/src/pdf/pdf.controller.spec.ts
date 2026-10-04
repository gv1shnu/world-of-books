import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PDFDocument } from 'pdf-lib';
import { PdfInspectorService } from './pdf-inspector.service';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { PdfDownloadService } from './pdf-download.service';
import { PdfSearchService } from './pdf-search.service';

describe('PDF HTTP API', () => {
  let app: INestApplication;
  let bytes: Buffer;
  beforeAll(async () => {
    const document = await PDFDocument.create();
    document.addPage();
    bytes = Buffer.from(await document.save());
    const module = await Test.createTestingModule({
      controllers: [PdfController],
      providers: [
        PdfService,
        PdfInspectorService,
        {
          provide: PrismaService,
          useValue: {
            product: {
              findUnique: jest.fn(({ where }) =>
                Promise.resolve(
                  where.id === 1
                    ? { title: 'Book', author: 'Author', specs: { Pages: '1' } }
                    : null,
                ),
              ),
            },
          },
        },
        {
          provide: PdfSearchService,
          useValue: {
            isConfigured: () => true,
            search: async () => ['https://example.org/book.pdf'],
          },
        },
        {
          provide: PdfDownloadService,
          useValue: {
            download: async () => ({
              bytes,
              url: 'https://example.org/book.pdf',
            }),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('extracts and serves a real PDF with inline headers', async () => {
    const extraction = await request(app.getHttpServer())
      .post('/products/1/pdf/extract')
      .expect(201);
    expect(extraction.body.status).toBe('matched');
    const reader = await request(app.getHttpServer())
      .get(`/products/1/pdf/${extraction.body.token}`)
      .expect(200);
    expect(reader.headers['content-type']).toBe('application/pdf');
    expect(reader.headers['content-disposition']).toContain('inline');
    expect(reader.headers['cache-control']).toBe('private, no-store');
    expect(reader.body).toEqual(bytes);
  });
  it('rejects invalid identifiers and absent books or tokens', async () => {
    await request(app.getHttpServer())
      .post('/products/1xyz/pdf/extract')
      .expect(400);
    await request(app.getHttpServer())
      .post('/products/9/pdf/extract')
      .expect(404);
    await request(app.getHttpServer())
      .get('/products/1/pdf/bad-token')
      .expect(400);
    await request(app.getHttpServer())
      .get('/products/1/pdf/b022ef76-dcf2-4f8a-994b-56be8e84b051')
      .expect(404);
  });
});
