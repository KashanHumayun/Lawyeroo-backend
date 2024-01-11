const express = require('express');
const cors = require('cors');
const adminRoutes = require('./src/routes/adminRoutes');
const lawyerRoutes = require('./src/routes/lawyerRoutes');
const loginRoutes = require('./src/routes/loginRoutes'); // If you have login routes
const clientRoutes = require('./src/routes/clientRoutes'); // If you have client routes
const app = express();
app.use(cors());
app.use(express.json());


app.use((req, res, next) => {
    console.log(req.method, req.path, req.body);
    next();
});

app.use('/api', adminRoutes);
app.use('/api', lawyerRoutes);
app.use('/api', clientRoutes);
app.use('/api', loginRoutes);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
