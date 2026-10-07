
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const httpStatus = require('http-status');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs')
const moment = require('moment');
const slugify = require('slugify');
const app = express();
app.set("trust proxy", 1);

// app.use((req, res, next) => {
//   console.log("========== APP ENTRY ==========");
//   console.log("rawHeaders:", req.rawHeaders);
//   console.log("headers:", req.headers);
//   console.log("===============================");
//   next();
// });

const config = require('./src/config/config.js');
const routes = require('./src/routes/v1');
const morgan = require('./src/config/morgan.js');
const { authLimiter } = require('./src/middlewares/rateLimiter.js');
const corsConfigs = require('./src/config/corsConfigs.js');
const credentials = require('./src/middlewares/credentials.js');
const {Permission } = require('./src/models');

const ApiError = require('./src/utils/ApiError.js');
// const upload = require('./src/config/multer.js');
const errorHandler = require('./src/utils/errorHandler.js');
const logger = require('./src/config/logger.js');
require('./src/models');
require('./src/config/firebaseConfig.js');
require('./src/config/gcpStorage.js');
const PUBLIC_DIR = path.resolve(__dirname, './public');

const paymentRoute = require("./src/routes/v1/Common/payment.route.js");

const responseWrapper = require('./src/config/responseWrapper');
const allResource = require('./src/config/resource.js');
const handleFileUploads = require('./src/config/multer.js');
const { checkUserPremiumStatus, checkUserFreeTrialStatus } = require('./src/controllers/Common/crmPayment.controller.js');
const bodyParser = require('body-parser');
const { updateUserPromotions } = require('./src/services/Common/promotion.service.js');



async function createPermissions(){
  for (const resource of allResource) {
    try {
      console.log("111111111", resource.label);
      const permissionParentObj = {
        label: resource.label,
        permission_slug: slugify(resource.label, { lower: true })
      };
      const children = resource.children;
    
      const [parentPermissionDoc, parentCreated] = await Permission.findOrCreate({
        where: { permission_slug: slugify(resource.label, { lower: true }) },
        defaults: permissionParentObj
      });
      
      if (parentPermissionDoc && children) {
        for (const permission of children) {
          const childrenObj = {
            label: permission.label,
            permission_slug: slugify(permission.label, { lower: true }),
            parent_id: parentPermissionDoc.id
          };
          const [permissionDoc, created] = await Permission.findOrCreate({
            where: { permission_slug: slugify(permission.label, { lower: true }) },
            defaults: childrenObj
          });
        }
      }
    } catch(error) {
      console.log("Failed to create permissions:", error.message);
    }
  }
};

// createPermissions()


cron.schedule('* * * * *', () => {
  logger.info('Hello, I am still Running.......😊');
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
// app.use('/api/v1/payment/stripe/charge-intent/webhooks', express.raw({type: "*/*"}));
app.use(express.json());
// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));


// app.use('/api/v1/payment', paymentRoute);

// gzip compression
app.use(compression());

if (config.env !== 'test') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
};

app.use(express.static(PUBLIC_DIR));

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
  app.use('/api/v1/auth', authLimiter);
};

app.get('/api/healthcheck', function (req, res) {
  let data = {
    response: 'ok'
  };
  res.status(200).send(data);
});


app.get('/test', (req, res, next) => {
  res.status(200).send('Hello World !!')
});

// Added multer with all v1 api routes
app.use('/api/v1', handleFileUploads, routes);

app.get('/api/v1/logs', (req, res) => {
  const currentDate = moment().format('YYYY-MM-DD');
  const logFileName = `${currentDate}.log`;
  const logFilePath = path.join(__dirname, 'logs', logFileName);
  fs.readFile(logFilePath, 'utf8', (err, data) => {
    if (err) {
      return responseWrapper(res, [], 'success');
    } else {
      const logs = data.split('\n');
      return responseWrapper(res, logs, 'success');
    }
  });
});

app.delete('/api/v1/logs', async (req, res) => {
  const logDirectory = path.join(__dirname, 'logs');
  fs.readdir(logDirectory, async (err, files) => {
    if (err) {
      return responseWrapper(res, '', 'Error reading log directory', 400);
    } else {
      files.forEach(file => {
        if (file.endsWith('.log')) {
          fs.unlink(path.join(logDirectory, file), err => {
            if (err) {
              return responseWrapper(res, '', 'Error deleting log file', 400);
            }
          });
        }
      });
      return responseWrapper(res, '', 'All log files deleted successfully');
    }
  });
});

// All File Apis
app.use('/images', express.static(`${PUBLIC_DIR}/uploads/images`));
app.use('/videos', express.static(`${PUBLIC_DIR}/uploads/videos`));
app.use('/gifs', express.static(`${PUBLIC_DIR}/uploads/gifs`));
app.use('/docs', express.static(`${PUBLIC_DIR}/uploads/docs`));
app.use('/audios', express.static(`${PUBLIC_DIR}/uploads/audios`));
app.use('/csv', express.static(`${PUBLIC_DIR}/uploads/csv`));

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// error handling
app.use(errorHandler);

module.exports = app;

