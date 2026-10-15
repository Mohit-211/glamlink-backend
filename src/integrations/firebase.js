const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const config = require('../core/config/config');
const logger = require('../core/logger');

// Without the FIREBASE_* variables, skip Firebase so the app still starts (push and chat are unavailable).
if (!config.firebase) {
  logger.warn('Firebase key not configured: push notifications and chat are disabled.');
} else {
  const { projectId, clientEmail, privateKey, databaseURL } = config.firebase;

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    databaseURL,
  });

  getAuth()
    .listUsers(1)
    .then(() => logger.info('Firebase is authenticated successfully.'))
    .catch((error) => logger.warn('Error authenticating with Firebase:', error));
}
