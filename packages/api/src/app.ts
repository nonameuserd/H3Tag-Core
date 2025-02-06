import express from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { applyMiddleware } from './middleware/apply';
import routes from './routes';

const app = express();

// Apply global middleware (parsing, security headers, etc.)
applyMiddleware(app);

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';

// Adjust swagger API paths for production (compiled .js) vs. development (source .ts)
const swaggerApis = isProduction
  ? [
      './dist/routes/*.js',
      './dist/controllers/*.js',
      './dist/dtos/*.js',
      './dist/services/*.js',
    ]
  : [
      './src/routes/*.ts',
      './src/controllers/*.ts',
      './src/dtos/*.ts',
      './src/services/*.ts',
    ];

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'H3TAG Blockchain Node API',
      version: '1.0.0',
      description: 'API for managing blockchain nodes',
      contact: {
        name: 'API Support',
        url: 'https://h3tag.io/support',
        email: 'support@h3tag.io',
      },
      license: {
        name: 'Apache 2.0',
        url: 'https://www.apache.org/licenses/LICENSE-2.0.html',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'Production server',
      },
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
  },
  apis: swaggerApis,
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Only expose Swagger documentation if not in production,
// or when explicitly enabled with the ENABLE_SWAGGER environment variable.
if (!isProduction || process.env.ENABLE_SWAGGER === 'true') {
  // Swagger UI setup
  app.use(
    '/api-docs',
    swaggerUi.serve as unknown as express.RequestHandler,
    swaggerUi.setup(swaggerSpec, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'H3TAG Blockchain Node API Documentation',
    }) as unknown as express.RequestHandler
  );

  // API Documentation JSON endpoint
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

// API Routes
app.use('/api/v1', routes);

// Global error handling middleware (in case applyMiddleware doesn't catch everything)
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err);
    res.status(err.status || 500).json({
      error: {
        message: err.message || 'Internal Server Error',
      },
    });
  }
);

export default app;
