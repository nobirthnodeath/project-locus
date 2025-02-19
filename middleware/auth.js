const jwt = require("jsonwebtoken");
require("dotenv").config();
const SECRET_KEY = process.env.JWT_SECRET || "supersecretkey";

const authMiddleware = (req, res, next) => {
    const token = req.header("Authorization")?.split(" ")[1]; // Extract token

    if (!token) return res.status(401).json({ error: "Unauthorized - No token provided" });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.userId = decoded.userId; // Attach userId to request
        next();
    } catch (error) {
        res.status(401).json({ error: "Unauthorized - Invalid token" });
    }
};

module.exports = authMiddleware;