const express = require("express");
const Store = require("../models/storeSchema");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const canManageStores = requireRole(["DIRECTOR", "MANAGER"]);

// Create store
router.post("/stores", requireAuth, canManageStores, async (req, res) => {
  try {
    const store = await Store.create(req.body);
    return res.status(201).json(store);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Get all stores
router.get("/stores", async (req, res) => {
  try {
    const stores = await Store.find().sort({ createdAt: -1 });
    return res.json(stores);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get store by id
router.get("/stores/:id", async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: "Store not found" });
    return res.json(store);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Update store
router.patch(
  "/stores/:id",
  requireAuth,
  canManageStores,
  async (req, res) => {
    try {
      const store = await Store.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!store) return res.status(404).json({ error: "Store not found" });
      return res.json(store);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
);

// Delete store
router.delete("/stores/:id", requireAuth, canManageStores, async (req, res) => {
  try {
    const store = await Store.findByIdAndDelete(req.params.id);
    if (!store) return res.status(404).json({ error: "Store not found" });
    return res.json({ message: "Store deleted" });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
