const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/packshiftdb', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Schemas
const bookingSchema = new mongoose.Schema({
    name: String,
    phone: String,
    pickup: String,
    drop: String,
    date: Date,
    status: { type: String, default: 'Pending' },
    pickupTime: Date,
    deliveryTime: Date,
    createdAt: { type: Date, default: Date.now }
});
const Booking = mongoose.model('Booking', bookingSchema);

const contactSchema = new mongoose.Schema({
    name: String,
    email: String, // Added email field
    message: String,
    createdAt: { type: Date, default: Date.now }
});
const Contact = mongoose.model('Contact', contactSchema);

// Submit booking with validation
app.post('/submit-booking', async (req, res) => {
    try {
        const { name, phone, pickup, drop, date } = req.body;

        if (!name || !phone || !pickup || !drop || !date) {
            return res.status(400).json({ error: 'Please fill all fields' });
        }

        // Validate name: only letters and spaces, min 3 characters
        const nameRegex = /^[A-Za-z\s]{3,}$/;
        if (!nameRegex.test(name)) {
            return res.status(400).json({ error: 'Invalid name. Only letters and spaces allowed.' });
        }

        // Validate phone: must start with 6–9 and be exactly 10 digits
        const phoneRegex = /^[6-9]\d{9}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({ error: 'Invalid phone number. Must be 10 digits starting with 6-9.' });
        }

        const newBooking = new Booking({ name, phone, pickup, drop, date });
        await newBooking.save();

        res.status(201).json({ message: 'Booking submitted successfully' });
    } catch (err) {
        console.error('Error submitting booking:', err);
        res.status(500).json({ error: 'Error submitting booking' });
    }
});

// Get all bookings
app.get('/get-bookings', async (req, res) => {
    try {
        const bookings = await Booking.find();
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching bookings' });
    }
});

// Delete a booking
app.delete('/delete-booking/:id', async (req, res) => {
    try {
        await Booking.findByIdAndDelete(req.params.id);
        res.json({ message: 'Booking deleted!' });
    } catch (err) {
        res.status(500).json({ error: 'Error deleting booking' });
    }
});

// Update booking status
app.patch('/update-booking/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const updateData = { status };
        // Set pickupTime or deliveryTime based on the status
        if (status === 'Picked Up') {
            updateData.pickupTime = new Date(); // Set current time for pickup
        } else if (status === 'Delivered') {
            updateData.deliveryTime = new Date(); // Set current time for delivery
        }
        const updated = await Booking.findByIdAndUpdate(req.params.id, updateData, { new: true });
        res.json({ message: 'Booking updated!', booking: updated });
    } catch (err) {
        console.error('Update error:', err);
        res.status(500).json({ error: 'Error updating booking' });
    }
});

// Track booking by phone
app.get('/track/:phone', async (req, res) => {
    try {
        const phone = req.params.phone;
        const bookings = await Booking.find({ phone: { $regex: phone, $options: 'i' } });
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ error: 'Error tracking booking' });
    }
});

// Contact form
app.post('/contact', async (req, res) => {
    try {
        const { name, email, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ error: 'Please fill all fields' });
        }

        const newMessage = new Contact({ name, email, message });
        await newMessage.save();

        res.status(201).json({ message: 'Message received' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Socket.IO (optional real-time updates)
io.on('connection', socket => {
    console.log('Client connected');
    socket.on('disconnect', () => console.log('Client disconnected'));
});

// Start server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
