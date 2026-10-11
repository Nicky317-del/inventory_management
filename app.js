
require("dotenv").config();

const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const mongoose = require("mongoose");
const Product = require("./models/Product");
const errorHandler = require("./middleware/errorHandler");
const validateProduct = require("./middleware/validateProduct");

const app = express();
const PORT = process.env.PORT || 3000;

// ==================================================
// OBJECTIVE 8: ENVIRONMENT CONFIGURATION
// ==================================================

app.use(express.json());

// ==================================================
// OBJECTIVE 1: HEALTH CHECK
// ==================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Inventory Management API is running"
  });
});

// ==================================================
// OBJECTIVE 3: CREATE PRODUCT
// POST /products
// ==================================================

app.post("/products", validateProduct, async (req, res, next) => {
  try {
    const product = await Product.create(req.body);

    res.status(201).json({
      success: true,
      message: "Product added successfully",
      product
    });
  } catch (error) {
    next(error);
  }
});

// ==================================================
// OBJECTIVES 4 AND 5: GET PRODUCTS
// Filtering, sorting, and pagination
// GET /products?category=Electronics&page=1&limit=10
// GET /products?sortBy=price&order=asc
// ==================================================

app.get("/products", async (req, res, next) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      search,
      sortBy = "createdAt",
      order = "desc",
      page = "1",
      limit = "10"
    } = req.query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(limitNumber) ||
      limitNumber < 1 ||
      limitNumber > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Page must be positive and limit must be between 1 and 100"
      });
    }

    const filter = {};

    if (category) {
      filter.category = category;
    }

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};

      if (minPrice !== undefined) {
        filter.price.$gte = Number(minPrice);
      }

      if (maxPrice !== undefined) {
        filter.price.$lte = Number(maxPrice);
      }

      if (
        Object.values(filter.price).some(
          (value) => !Number.isFinite(value) || value < 0
        ) ||
        (minPrice !== undefined &&
          maxPrice !== undefined &&
          Number(minPrice) > Number(maxPrice))
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid price range"
        });
      }
    }

    const allowedSortFields = [
      "name",
      "price",
      "quantity",
      "category",
      "createdAt"
    ];

    if (
      !allowedSortFields.includes(sortBy) ||
      !["asc", "desc"].includes(order)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid sorting field or order"
      });
    }

    const sort = { [sortBy]: order === "asc" ? 1 : -1 };
    const skip = (pageNumber - 1) * limitNumber;

    const [products, totalProducts] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNumber),
      Product.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      totalProducts,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalProducts / limitNumber),
      products
    });
  } catch (error) {
    next(error);
  }
});

// ==================================================
// OBJECTIVE 3: GET ONE PRODUCT
// GET /products/:id
// ==================================================

app.get("/products/:id", async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    next(error);
  }
});

// ==================================================
// OBJECTIVE 3: UPDATE PRODUCT
// PUT /products/:id
// ==================================================

app.put(
  "/products/:id",
  validateProduct,
  async (req, res, next) => {
    try {
      const product = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        {
          new: true,
          runValidators: true
        }
      );

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found"
        });
      }

      res.status(200).json({
        success: true,
        message: "Product updated successfully",
        product
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================================================
// OBJECTIVE 3: PARTIAL UPDATE
// PATCH /products/:id
// ==================================================

app.patch("/products/:id", async (req, res, next) => {
  try {
    const allowedFields = ["name", "category", "price", "quantity", "description"];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one valid field to update"
      });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      {
        new: true,
        runValidators: true
      }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product
    });
  } catch (error) {
    next(error);
  }
});

// ==================================================
// OBJECTIVE 3: DELETE PRODUCT
// DELETE /products/:id
// ==================================================

app.delete("/products/:id", async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      product
    });
  } catch (error) {
    next(error);
  }
});

// ==================================================
// OBJECTIVE 6: RESTOCK PRODUCT
// PATCH /products/:id/restock
// Body: { "quantity": 10 }
// ==================================================

app.patch("/products/:id/restock", async (req, res, next) => {
  try {
    const quantity = req.body.quantity;

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Restock quantity must be a positive integer"
      });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { quantity } },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Product restocked successfully",
      product
    });
  } catch (error) {
    next(error);
  }
});

// ==================================================
// OBJECTIVE 6: SELL PRODUCT
// PATCH /products/:id/sell
// Body: { "quantity": 2 }
// Prevents selling more than available stock.
// ==================================================

app.patch("/products/:id/sell", async (req, res, next) => {
  try {
    const quantity = req.body.quantity;

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Sale quantity must be a positive integer"
      });
    }

    const product = await Product.findOneAndUpdate(
      {
        _id: req.params.id,
        quantity: { $gte: quantity }
      },
      { $inc: { quantity: -quantity } },
      { new: true, runValidators: true }
    );

    if (!product) {
      const exists = await Product.exists({ _id: req.params.id });

      if (!exists) {
        return res.status(404).json({
          success: false,
          message: "Product not found"
        });
      }

      return res.status(400).json({
        success: false,
        message: "Insufficient stock for this sale"
      });
    }

    res.status(200).json({
      success: true,
      message: "Product sale recorded successfully",
      product
    });
  } catch (error) {
    next(error);
  }
});

// ==================================================
// OBJECTIVE 5: INVENTORY SUMMARY REPORT
// GET /reports/inventory-summary
// ==================================================

app.get("/reports/inventory-summary", async (req, res, next) => {
  try {
    const result = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalInventoryValue: {
            $sum: { $multiply: ["$price", "$quantity"] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalProducts: 1,
          totalQuantity: 1,
          totalInventoryValue: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      summary: result[0] || {
        totalProducts: 0,
        totalQuantity: 0,
        totalInventoryValue: 0
      }
    });
  } catch (error) {
    next(error);
  }
});

// ==================================================
// OBJECTIVE 5: REPORT BY CATEGORY
// GET /reports/by-category
// ==================================================

app.get("/reports/by-category", async (req, res, next) => {
  try {
    const report = await Product.aggregate([
      {
        $group: {
          _id: "$category",
          totalProducts: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalInventoryValue: {
            $sum: { $multiply: ["$price", "$quantity"] }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.status(200).json({
      success: true,
      report
    });
  } catch (error) {
    next(error);
  }
});

// ==================================================
// OBJECTIVE 5: LOW STOCK REPORT
// GET /reports/low-stock?threshold=5
// ==================================================

app.get("/reports/low-stock", async (req, res, next) => {
  try {
    const threshold =
      req.query.threshold === undefined
        ? 5
        : Number(req.query.threshold);

    if (!Number.isInteger(threshold) || threshold < 0) {
      return res.status(400).json({
        success: false,
        message: "Threshold must be a non-negative integer"
      });
    }

    const products = await Product.find({
      quantity: { $lte: threshold }
    }).sort({ quantity: 1 });

    res.status(200).json({
      success: true,
      threshold,
      totalLowStockProducts: products.length,
      products
    });
  } catch (error) {
    next(error);
  }
});

// ==================================================
// OBJECTIVE 7: CENTRALIZED ERROR HANDLING
// Keep this AFTER all routes.
// ==================================================

app.use((req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
});

app.use(errorHandler);

// ==================================================
// OBJECTIVE 8: SECURE DATABASE CONNECTION
// Load credentials from .env, never hardcode them.
// ==================================================

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is missing from .env");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Atlas connected successfully!");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
