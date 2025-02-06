import app from './app';
import { defaultConfig, Logger } from '@h3tag-blockchain/shared';

const PORT = process.env.PORT || defaultConfig.network.port || 3000;

const server = app.listen(PORT, () => {
  Logger.info(`Server is running on port ${PORT}`);
});

// Listen for errors during startup (e.g., port already in use)
server.on('error', (error: Error) => {
  Logger.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown handler
const shutdown = () => {
  Logger.info('Received shutdown signal, shutting down gracefully...');
  server.close((err?: Error) => {
    if (err) {
      Logger.error('Error during server shutdown:', err);
      process.exit(1);
    }
    Logger.info('Server stopped gracefully.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
