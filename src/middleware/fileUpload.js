const multer = require('multer');

// Configure multer to store files in memory
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    // Allowed MIME types
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/octet-stream'];

    // Check if the MIME type is one of the allowed types
    if (file.mimetype.startsWith('image/') || allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true); // Allow the upload
    } else {
        cb(new Error('Please upload only JPEG, JPG, PNG, or octet-stream files.'), false); // Reject the upload
    }
};


const upload = multer({ storage: storage, fileFilter: fileFilter });

module.exports = upload;
