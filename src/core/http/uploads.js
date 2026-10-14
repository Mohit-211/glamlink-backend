const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ApiError = require("./ApiError");
const httpStatus = require("http-status");
const config = require("../config/config");
const crypto = require("crypto");

// Define base directory for uploads
const { UPLOADS_DIR } = require("../config/paths");

// Ensure all required directories exist
const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Define allowed file categories and folders
const fileCategories = {
  images: ["jpeg", "jpg", "png", "webp", "avif"],
  videos: ["mp4", "mov", "webm"],
  gifs: ["gif"],
  docs: ["pdf", "doc", "docx"],
  audios: ["mp3"],
  csv: ["csv"],
};

// Get correct upload folder based on file fieldname
const getUploadFolder = (fieldname) => {
  const categoryFolders = {
    profile_image: "images",
    video_thumbnails: "images",
    featured_link_images: "images",
    gifs: "gifs",
    images: "images",
    videos: "videos",
    docs: "docs",
    audios: "audios",
    csv_file: "csv",
  };

  return categoryFolders[fieldname] || "others";
};

// Ensure all category directories exist
Object.keys(fileCategories).forEach((category) => {
  ensureDirectoryExists(path.join(UPLOADS_DIR, category));
});

// Set up multer storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadFolder = getUploadFolder(file.fieldname);
    const uploadPath = path.join(UPLOADS_DIR, uploadFolder);
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = getFileExtension(file);
    const uniqueId = crypto.randomBytes(8).toString("hex");

    cb(null, `${file.fieldname}-${Date.now()}-${uniqueId}.${ext}`);
  },
});

// Validate file type
function checkFileType(file, cb) {
  const allowedFiletypes = [
    "jpeg",
    "jpg",
    "png",
    "avif",
    "gif",
    "mp4",
    "mov",
    "webm",
    "pdf",
    "mp3",
    "doc",
    "docx",
    "webp",
    "csv",
  ];
  const fileExtension = path
    .extname(file.originalname)
    .substring(1)
    .toLowerCase();

  const isValidExtension = allowedFiletypes.includes(fileExtension);
  const isValidMimeType =
    file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("video/") ||
    file.mimetype.startsWith("application/pdf") ||
    file.mimetype.startsWith("audio/") ||
    file.mimetype === "text/csv" ||
    file.mimetype === "application/msword" ||
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  if (isValidExtension && isValidMimeType) {
    return cb(null, true);
  } else {
    return cb(
      new ApiError(
        httpStatus.BAD_REQUEST,
        "Error: Invalid file type! Allowed: Images, Videos, Audio, Docs.",
      ),
    );
  }
}

// Get file extension based on MIME type
function getFileExtension(file) {
  const mimeToExtMap = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/png": "png",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/mov": "mov",
    "video/webm": "webm",
    "application/pdf": "pdf",
    "audio/mpeg": "mp3",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "docx",
    "text/csv": "csv",
    "application/vnd.ms-excel": "csv",
  };
  return mimeToExtMap[file.mimetype] || "txt";
}

// Initialize multer upload
// Per-file size cap; override with UPLOAD_MAX_MB.
const MAX_FILE_BYTES = (Number(process.env.UPLOAD_MAX_MB) || 50) * 1024 * 1024;

const upload = multer({
  storage: storage,
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  },
}).fields([
  { name: "profile_image", maxCount: 1 },
  { name: "video_thumbnails", maxCount: 10 },
  { name: "featured_link_images", maxCount: 20 },
  { name: "gifs", maxCount: 10 },
  { name: "images", maxCount: 10 },
  { name: "videos", maxCount: 10 },
  { name: "docs", maxCount: 10 },
  { name: "audios", maxCount: 10 },
  { name: "csv_file", maxCount: 1 },
]);

// Middleware to handle file uploads
// Deletes this request's stored files if the request ends in an error (including failed auth),
// so rejected uploads don't pile up on disk.
const removeFilesOnFailure = (req, res) => {
  res.once("finish", () => {
    if (res.statusCode < 400 || !req.files) return;
    Object.values(req.files)
      .flat()
      .forEach((file) => file && file.path && fs.unlink(file.path, () => {}));
  });
};

const handleFileUploads = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return next(new ApiError(httpStatus.BAD_REQUEST, err.code === "LIMIT_FILE_SIZE" ? "File is too large." : err.message));
      }
      return next(err);
    }
    removeFilesOnFailure(req, res);

    try {
      const fileTypes = [
        "profile_image",
        "video_thumbnails",
        "featured_link_images",
        "gifs",
        "images",
        "videos",
        "docs",
        "audios",
        "csv_file"
      ];
      fileTypes.forEach((type) => {
        if (req.files && req.files[type]) {
          req.files[type] = req.files[type].map((file) => {
            const folder =
              type === "profile_image" ||
              type === "video_thumbnails" ||
              type === "featured_link_images"
                ? "images"
                : type === "csv_file"
                ? "csv"
                : type;

            return {
              ...file,
              filename: `${config.API_BASE_URL}/${folder}/${file.filename}`,
            };
          });
        }
      });

      next();
    } catch (uploadError) {
      next(uploadError);
    }
  });
};
module.exports = handleFileUploads;


