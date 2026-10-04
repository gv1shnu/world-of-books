import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PdfSearchService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('SERPAPI_API_KEY')?.trim());
  }

  async search(query: string): Promise<string[]> {
    const url = new URL('https://serpapi.com/search.json');
    url.search = new URLSearchParams({
      engine: 'google',
      q: query,
      api_key: this.config.get<string>('SERPAPI_API_KEY') || '',
      num: '10',
      hl: 'en',
    }).toString();
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(12000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error('Search failed');
      const result = (await response.json()) as {
        error?: string;
        organic_results?: { link?: unknown }[];
      };
      if (
        result.error ||
        (result.organic_results && !Array.isArray(result.organic_results))
      ) {
        throw new Error('Invalid search response');
      }
      return [
        ...new Set(
          (result.organic_results || [])
            .map((item) => item.link)
            .filter((link): link is string => typeof link === 'string'),
        ),
      ].slice(0, 5);
    } catch {
      // Never expose/log the provider URL, which contains a credential.
      throw new ServiceUnavailableException(
        'PDF search is temporarily unavailable. Please try again later.',
      );
    }
  }
}
