import {
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  StreamableFile,
} from '@nestjs/common';
import { PdfService } from './pdf.service';

@Controller('products')
export class PdfController {
  constructor(private readonly pdf: PdfService) {}

  @Post(':id/pdf/extract')
  @Header('Cache-Control', 'no-store')
  extract(@Param('id', ParseIntPipe) id: number) {
    return this.pdf.extract(id);
  }

  @Get(':id/pdf/:token')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', 'sandbox')
  read(
    @Param('id', ParseIntPipe) id: number,
    @Param('token', new ParseUUIDPipe({ version: '4' })) token: string,
  ) {
    return new StreamableFile(this.pdf.read(id, token), {
      type: 'application/pdf',
      disposition: 'inline; filename="book.pdf"',
    });
  }
}
