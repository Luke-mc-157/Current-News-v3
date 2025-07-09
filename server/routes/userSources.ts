import express from "express";
import { setUserTrustedSources, getUserTrustedSources } from "../services/dynamicSources.js";

const router = express.Router();

// Get user's trusted sources
router.get("/api/user-sources/:userId", (req, res) => {
  const { userId } = req.params;
  const sources = getUserTrustedSources(userId);
  res.json({ sources });
});

// Set user's trusted sources
router.post("/api/user-sources/:userId", (req, res) => {
  const { userId } = req.params;
  const { sources } = req.body;
  
  if (!Array.isArray(sources)) {
    return res.status(400).json({ error: "Sources must be an array" });
  }
  
  setUserTrustedSources(userId, sources);
  res.json({ message: "Trusted sources updated successfully" });
});

export default router;