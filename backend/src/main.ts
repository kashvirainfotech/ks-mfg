import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');

  const frontendUrlEnv = process.env.FRONTEND_URL || '';
  const configuredOrigins = frontendUrlEnv
    .split(',')
    .map((url) => url.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const staticAllowedOrigins = [
    'https://ks-mfg.onrender.com',
    'https://ks-mfg-web.onrender.com',
    'https://ks-mfg-api.onrender.com',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    ...configuredOrigins,
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow non-browser requests (mobile apps, server-to-server, health checks)
      if (!origin) return callback(null, true);

      const sanitizedOrigin = origin.replace(/\/$/, '');

      // Check explicit allowed list
      if (staticAllowedOrigins.includes(origin) || staticAllowedOrigins.includes(sanitizedOrigin)) {
        return callback(null, true);
      }

      // Automatically allow any onrender.com deployment origin
      if (/^https:\/\/.*\.onrender\.com$/.test(sanitizedOrigin)) {
        return callback(null, true);
      }

      // Allow any localhost development port
      if (/^https?:\/\/localhost(:\d+)?$/.test(sanitizedOrigin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(sanitizedOrigin)) {
        return callback(null, true);
      }

      logger.warn(`Blocked CORS request from origin: ${origin}`);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-comp-id',
      'x-branch-id',
      'x-fyear-id',
      'x-correlation-id',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    optionsSuccessStatus: 204,
  });

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  logger.log(`KS-MFG ERP Backend running at http://localhost:${port}/api/v1`);
}
bootstrap();
