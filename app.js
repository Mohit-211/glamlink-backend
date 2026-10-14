
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const httpStatus = require('./src/core/http/status');
const cron = require('node-cron');
const path = require('path');
const app = express();
app.set("trust proxy", 1);

const config = require('./src/core/config/config.js');
const routes = require('./src/routes');
const accessLog = require('./src/core/http/accessLog.js');
const { authLimiter } = require('./src/core/http/rateLimiter.js');
const corsConfigs = require('./src/core/http/corsConfigs.js');
const credentials = require('./src/core/http/credentials.js');

const ApiError = require('./src/core/http/ApiError.js');
const errorHandler = require('./src/core/http/errorHandler.js');
require('./src/models');
require('./src/integrations/firebase.js');
const { UPLOADS_DIR } = require('./src/core/config/paths');


const handleFileUploads = require('./src/core/http/uploads.js');
const { checkUserPremiumStatus, checkUserFreeTrialStatus } = require('./src/modules/crm/crmPayment.controller.js');
const { updateUserPromotions } = require('./src/modules/professional/promotion.service.js');




cron.schedule('* * * * *', () => {
  checkUserFreeTrialStatus();
	checkUserPremiumStatus();

});

cron.schedule("1 0 * * *", async () => {
  await updateUserPromotions();
});

// set security HTTP headers
app.use(
	helmet.contentSecurityPolicy({
		useDefaults: true,
		directives: {
			'img-src': ["'self' data:", '*.google-analytics.com', '*.vimeocdn.com'],
			'script-src': ["'self'", '*.polyfill.io', "'unsafe-eval'", "'unsafe-inline'"],
			'default-src': ["'self'", '*.google-analytics.com', '*.gstatic.com', '*.googleapis.com', 'vimeo.com', '*.vimeo.com']
		}
	})
);




// parse json request body

app.use(
  '/api/v1/payment/stripe/charge-intent/webhooks',
  express.raw({ type: '*/*' })
);
app.use(express.json());
// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));


// gzip compression
app.use(compression());

if (config.env !== 'test') {
  app.use(accessLog);
};


process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 1;


app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.removeHeader("Cross-Origin-Embedder-Policy");
  next();
});

app.use(credentials);
app.use(cors(corsConfigs));


// limit repeated failed requests to auth endpoints
if (config.env === 'production') {
  app.use(['/api/v1/user/auth', '/api/v1/admin/auth'], authLimiter);
};

app.get('/api/healthcheck', function (req, res) {
  let data = {
    response: 'ok'
  };
  res.status(200).send(data);
});



// Added multer with all v1 api routes
app.use('/api/v1', handleFileUploads, routes);


// Uploaded files. Stored URLs look like <API_BASE_URL>/images/<file>, so keep these paths stable.
['images', 'videos', 'gifs', 'docs', 'audios', 'csv'].forEach((folder) => {
  app.use(`/${folder}`, express.static(path.join(UPLOADS_DIR, folder)));
});

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// error handling
app.use(errorHandler);

module.exports = app;

