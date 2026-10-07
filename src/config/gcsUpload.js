const storage = require('./gcpStorage');

const bucketName = 'storage.glamlink.net'; // Update this
const bucket = storage.bucket(bucketName);

const getUploadPath = (file) => {
  const fileType = file.mimetype.split('/')[0];
  const basePath = {
    image: 'images',
    video: 'videos',
    audio: 'audios',
    application: 'docs'
  }[fileType] || 'others';

  return `${basePath}/${Date.now()}_${file.originalname}`;
};

// const uploadToGCS = (file) => {
//   return new Promise((resolve, reject) => {
//     if (!file) {
//       return reject(new Error('No file provided'));
//     }

//     const uniqueFileName = getUploadPath(file);
//     const blob = bucket.file(uniqueFileName);
//     const blobStream = blob.createWriteStream({
//       resumable: false,
//       gzip: true,
//     });

//     blobStream.on('error', (err) => {
//       console.error('Blob stream error:', err);
//       reject(new Error('Failed to upload file to Google Cloud Storage'));
//     });

//     blobStream.on('finish', async () => {
//       try {
//         // await blob.makePublic(); // If not necessary immediately, remove this line for speed improvement
//         file.filename = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
//         resolve(file);
//       } catch (err) {
//         console.error('Error generating public URL:', err);
//         reject(new Error('Failed to generate public URL for uploaded file'));
//       }
//     });

//     blobStream.end(file.buffer);
//   });
// };

const uploadToGCS = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No file provided'));
    }

    const uniqueFileName = getUploadPath(file);
    const blob = bucket.file(uniqueFileName);
    const blobStream = blob.createWriteStream({
      resumable: false,
      gzip: true,
      metadata: {
        contentType: file.mimetype, // ✅ Fixes MIME type issue
      },
    });

    blobStream.on('error', (err) => {
      console.error('Blob stream error:', err);
      reject(new Error('Failed to upload file to Google Cloud Storage'));
    });

    blobStream.on('finish', () => {
      file.filename = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      resolve(file);
    });

    blobStream.end(file.buffer);
  });
};

module.exports = uploadToGCS;