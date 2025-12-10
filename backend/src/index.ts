import { app } from './app';
import { config } from './config';
import { log } from './lib/logger';

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  log.info(`Server running on port ${PORT}`);
  log.info('Auth config loaded', {
    tenantId: config.auth.tenantId ? `${config.auth.tenantId.substring(0, 8)}...` : 'MISSING',
    clientId: config.auth.clientId ? `${config.auth.clientId.substring(0, 8)}...` : 'MISSING',
    hasClientSecret: !!config.auth.clientSecret,
    redirectUri: config.auth.redirectUri,
  });
});


