import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfInspectorService } from './pdf-inspector.service';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { PdfSearchService } from './pdf-search.service';
import { PdfDownloadService } from './pdf-download.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [PdfController],
  providers: [
    PdfService,
    PdfSearchService,
    PdfDownloadService,
    PdfInspectorService,
  ],
})
export class PdfModule {}
