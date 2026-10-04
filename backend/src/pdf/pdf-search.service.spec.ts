import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { PdfSearchService } from './pdf-search.service';

describe('PdfSearchService', () => {
  const query = '"Example Book" "Jane Doe" filetype:pdf';
  const service = new PdfSearchService(
    new ConfigService({ SERPAPI_API_KEY: 'test-key' }),
  );
  afterEach(() => jest.restoreAllMocks());

  it('uses the Google engine, keeps the query, and deduplicates candidate links', async () => {
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        organic_results: [
          { link: 'https://example.org/one.pdf' },
          { link: 'https://example.org/one.pdf' },
          { link: 42 },
        ],
      }),
    } as Response);
    expect(await service.search(query)).toEqual([
      'https://example.org/one.pdf',
    ]);
    const url = fetcher.mock.calls[0][0] as URL;
    expect(url.origin).toBe('https://serpapi.com');
    expect(url.searchParams.get('q')).toBe(query);
    expect(url.searchParams.get('engine')).toBe('google');
  });
  it('reports provider errors without leaking the key', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ error: 'test-key invalid' }),
    } as Response);
    await expect(service.search(query)).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(service.search(query)).rejects.not.toThrow('test-key');
  });
  it('limits candidates to five', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        organic_results: Array.from({ length: 10 }, (_, i) => ({
          link: `https://example.org/${i}.pdf`,
        })),
      }),
    } as Response);
    expect(await service.search(query)).toHaveLength(5);
  });
  it('does not claim an unconfigured provider is ready', () => {
    expect(new PdfSearchService(new ConfigService()).isConfigured()).toBe(
      false,
    );
  });
});
