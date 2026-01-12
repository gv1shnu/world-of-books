import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { ScraperService } from '../scraper/scraper.service';
import { Logger } from '@nestjs/common';

describe('HealthService', () => {
  let service: HealthService;
  let scraperService: Partial<ScraperService>;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Mock ScraperService
    scraperService = {
      scrapeCategory: jest.fn(),
    };

    // Spy on Logger
    loggerSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: ScraperService, useValue: scraperService },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkSelectors', () => {
    it('should pass given valid products', async () => {
      (scraperService.scrapeCategory as jest.Mock).mockResolvedValue([
        { title: 'Test Book', price: 10 },
      ]);

      await service.checkSelectors();

      expect(scraperService.scrapeCategory).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Health Check PASSED'),
      );
    });

    it('should fail given empty results', async () => {
      (scraperService.scrapeCategory as jest.Mock).mockResolvedValue([]);

      await service.checkSelectors();

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Health Check FAILED'),
      );
    });

    it('should warn given missing data', async () => {
      (scraperService.scrapeCategory as jest.Mock).mockResolvedValue([
        { title: '', price: 0 }, // Invalid data
      ]);

      await service.checkSelectors();

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.stringContaining('Health Check WARNING'),
      );
    });
  });
});
