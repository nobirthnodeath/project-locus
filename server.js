const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const Location = require("./models/location"); 
const User = require("./models/user"); 
const authMiddleware = require("./middleware/auth"); 

dotenv.config();
const SECRET_KEY = process.env.JWT_SECRET || "supersecretkey";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static("public"));

// 🟢 Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// 🟢 Multer Storage for Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { folder: "project-locus" }
});

const upload = multer({ storage: storage });

// ============================
// ✅ AUTHENTICATION ROUTES ✅
// ============================

// 🟢 REGISTER A NEW USER
app.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "Email is already in use" });
        }

        const newUser = new User({ username, email, password });
        await newUser.save();

        // Generate JWT
        const token = jwt.sign({ userId: newUser._id }, SECRET_KEY, { expiresIn: "7d" });

        res.status(201).json({ success: true, token });
    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 🟢 LOGIN A USER
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Generate JWT
        const token = jwt.sign({ userId: user._id }, SECRET_KEY, { expiresIn: "7d" });

        res.json({ success: true, token });
    } catch (error) {
        console.error("Error logging in:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ============================
// ✅ PROTECTED LOCATION ROUTES ✅
// ============================

// 🟢 GET all locations for the logged-in user
app.get("/locations", authMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Get page number from query (default: 1)
        const limit = 12; // Max 12 locations per page
        const skip = (page - 1) * limit; // Calculate how many to skip

        const locations = await Location.find()
            .populate("user", "username") // Include username
            .skip(skip) // Skip previous pages
            .limit(limit); // Limit results

        const totalLocations = await Location.countDocuments(); // Get total location count

        res.json({
            locations,
            totalPages: Math.ceil(totalLocations / limit), // Calculate total pages
            currentPage: page
        });
    } catch (error) {
        console.error("❌ Error fetching paginated locations:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 🟢 POST a new location (Only for logged-in users)
app.post("/locations", authMiddleware, async (req, res) => {
    try {
        const { title, description, image, tags, lat, lng } = req.body;

        if (!title || lat === undefined || lng === undefined) {
            return res.status(400).json({ error: "Title, lat, and lng are required" });
        }

        console.log("✅ Saving location with tags:", tags);

        const newLocation = new Location({
            title,
            description,
            image,
            tags, // ✅ Ensure tags are saved
            lat,
            lng,
            user: req.userId
        });

        await newLocation.save();
        res.status(201).json(newLocation);
    } catch (err) {
        console.error("❌ Error saving location:", err);
        res.status(500).json({ error: "Error saving location" });
    }
});

// 🟢 PATCH route to update a location (Only if the user owns it)
app.patch("/locations/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const location = await Location.findOne({ _id: id, user: req.userId });
        if (!location) {
            return res.status(404).json({ error: "Location not found or unauthorized" });
        }

        const updatedLocation = await Location.findByIdAndUpdate(id, { $set: updates }, { new: true });

        res.json(updatedLocation);
    } catch (err) {
        res.status(500).json({ error: "Error updating location" });
    }
});

// 🟢 DELETE a location (Only if the user owns it)
app.delete("/locations/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const location = await Location.findOne({ _id: id, user: req.userId });

        if (!location) {
            return res.status(404).json({ error: "Location not found or unauthorized" });
        }

        await Location.findByIdAndDelete(id);
        res.json({ message: "Location deleted successfully", id });
    } catch (error) {
        console.error("Error deleting location:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ============================
// ✅ OTHER ROUTES ✅
// ============================

// 🟢 UPLOAD an image to Cloudinary
app.post("/upload", authMiddleware, upload.single("image"), (req, res) => {
    try {
        if (!req.file || !req.file.path) {
            return res.status(400).json({ error: "Image upload failed" });
        }
        res.json({ url: req.file.path });
    } catch (error) {
        console.error("Error uploading image:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 🟢 SEARCH locations by title or tags
app.get("/search", authMiddleware, async (req, res) => {
    try {
        const query = req.query.query;
        if (!query) {
            return res.status(400).json({ error: "Search query is required" });
        }

        console.log("🔍 Searching for:", query);

        // Search by title, description, or tags (case insensitive, partial match)
        const locations = await Location.find({
            $or: [
                { title: { $regex: query, $options: "i" } }, // Matches partial words in title
                { description: { $regex: query, $options: "i" } }, // Matches description
                { tags: { $in: [new RegExp(query, "i")] } } // Matches tags
            ]
        }).populate("user", "username");

        res.json(locations);
    } catch (error) {
        console.error("❌ Error in search:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 🟢 GET all unique tags for the logged-in user
app.get("/tags", authMiddleware, async (req, res) => {
    try {
        const tagAggregation = await Location.aggregate([
            { $unwind: "$tags" },  // Split tags array into individual items
            { $group: { _id: "$tags", count: { $sum: 1 } } },  // Count occurrences
            { $sort: { count: -1 } },  // Sort by popularity
            { $limit: 10 }  // Return top 10 tags
        ]);

        const tags = tagAggregation.map(tag => ({ name: tag._id, count: tag.count }));

        console.log("🟢 Popular Tags from DB:", tags); // Debugging

        res.json(tags);
    } catch (error) {
        console.error("❌ Error fetching popular tags:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 🟢 GET all locations for a specific user
app.get("/my-locations", authMiddleware, async (req, res) => {
    try {
        console.log("🔹 Fetching locations for user:", req.userId);

        // Find only locations where user matches logged-in user
        const locations = await Location.find({ user: req.userId }).populate("user", "username");

        res.json(locations);
    } catch (error) {
        console.error("❌ Error fetching user locations:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ============================
// ✅ START SERVER ✅
// ============================

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("Connected to MongoDB!"))
  .catch(err => {
      console.error("MongoDB connection error:", err);
      process.exit(1);
  });

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});