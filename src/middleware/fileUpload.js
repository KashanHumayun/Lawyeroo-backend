const multer = require('multer');

// Configure multer to store files in memory
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    console.log("Mime Type for a file:" + file.mimetype)
    // Check if the MIME type starts with 'image/' and the file extension is one of the allowed types
    if (file.mimetype.startsWith('image/') && ['image/jpeg', 'image/jpg', 'image/png'].includes(file.mimetype)) {
        cb(null, true); // Allow the upload
    } else {
        cb(new Error('Please upload only JPEG, JPG, or PNG images.'), false); // Reject the upload
    }
};


const upload = multer({ storage: storage, fileFilter: fileFilter });

module.exports = upload;
