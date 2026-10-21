const express = require("express");
const router = express.Router();
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;
const { protect } = require("../middleware/authMiddleware");

// Configure only if credentials exist; the route will fail gracefully otherwise.
if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "smartbudget/splits",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "heic", "heif"],
    transformation: [{ width: 1200, height: 1200, crop: "limit" }],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/**
 * Upload a receipt screenshot to Cloudinary.
 *
 * Returns { url, public_id } so the UI can display it and the split can
 * store the URL.
 */
router.post("/", protect, upload.single("receipt"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      message:
        "No file uploaded. Make sure CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET are set on the server.",
    });
  }

  res.json({
    url: req.file.path || req.file.secure_url || req.file.url,
    public_id: req.file.filename || req.file.public_id,
  });
});

module.exports = router;
