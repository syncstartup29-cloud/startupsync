const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let resource_type = 'image';
    let folder = 'startupsync/images';

    if (file.mimetype.startsWith('video/')) {
      resource_type = 'video';
      folder = 'startupsync/videos';
    } else if (file.mimetype === 'application/pdf') {
      resource_type = 'raw';
      folder = 'startupsync/pdfs';
    }

    return {
      folder,
      resource_type,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'pdf'],
    };
  },
});

const upload = multer({ storage });

module.exports = { cloudinary, upload };