import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Security: Helmet middleware for HTTP headers
  app.use(helmet());
  
  // Security: Strict CORS configuration
  const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:3000';
  app.enableCors({
    origin: webOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('ACK Thiboro SACCO API')
    .setDescription('RESTful API for ACK Thiboro SACCO Platform - Member management, savings, loans, and shares')
    .setVersion('1.0')
    .addTag('Auth', 'Authentication and authorization endpoints')
    .addTag('Members', 'Member management endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth'
    )
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'ACK Thiboro SACCO API Docs',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  
  console.log(`🚀 API running on: http://localhost:${port}/api/v1`);
  console.log(`📚 API docs available at: http://localhost:${port}/docs`);
  console.log(`🔒 Security: Helmet enabled, CORS origin: ${webOrigin}`);
  console.log(`⏱️  Rate limiting: ${process.env.THROTTLE_TTL || 60}s window, ${process.env.THROTTLE_LIMIT || 10} requests max`);
}

bootstrap();
