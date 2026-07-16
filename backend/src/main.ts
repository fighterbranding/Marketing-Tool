import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  // rawBody is needed to verify Meta's x-hub-signature-256 webhook header,
  // which is computed over the exact bytes Meta sent — not a re-serialized copy.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
