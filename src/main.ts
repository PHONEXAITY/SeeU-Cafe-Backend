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

  (BigInt.prototype as any).toJSON = function () {
    return (this as unknown as bigint).toString();
  };
  // Security middleware
  app.use(helmet());
  app.use(compression());

  // แก้ไข CORS configuration
  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:3000'], // รองรับทั้ง frontend และ backend URL
    credentials: true, // สำคัญมากสำหรับ cookie
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('SeeU Cafe API')
    .setDescription('The SeeU Cafe ordering system API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('access_token')
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
