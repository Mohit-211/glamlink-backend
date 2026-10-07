const { Storage } = require('@google-cloud/storage');
const path = require('path');
const logger = require('./logger');

// Load Google Cloud credentials
const storage = new Storage({
  keyFilename: path.join(__dirname, './service-account-file.json'),
  projectId: 'glamlink-storage', 
});

const listBuckets = async () => {
  try {
    const [buckets] = await storage.getBuckets();
    logger.info('Google Cloud Storage Authentication Success.');
  } catch (err) {
    logger.warn('Google Cloud Storage Authentication Failed.');
  }
};

listBuckets();

module.exports = storage;
