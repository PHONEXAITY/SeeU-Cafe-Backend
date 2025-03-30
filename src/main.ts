import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Global prefix
  app.setGlobalPrefix('api');
  // Use cookie parser
  app.use(cookieParser());
  // Validation and transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  // Security middleware
  app.use(helmet());
  app.use(compression());
  // CORS with credentials
  app.enableCors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  });
  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('SeeU Cafe API')
    .setDescription('The SeeU Cafe ordering system API documentation')
    .setVersion('1.0')
    .addBearerAuth() // Keep for backward compatibility
    .addCookieAuth('access_token') // Add cookie authentication
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap().catch((error) => {
  console.error('Error during application startup:', error);
});
