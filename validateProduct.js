
function validateProduct(req, res, next) {
  const { name, category, price, quantity } = req.body || {};

  const errors = [];

  if (typeof name !== "string" || !name.trim()) {
    errors.push("Product name is required");
  }

  if (typeof category !== "string" || !category.trim()) {
    errors.push("Product category is required");
  }

  if (
    price === undefined ||
    price === null ||
    price === "" ||
    !Number.isFinite(Number(price)) ||
    Number(price) < 0
  ) {
    errors.push("Price must be a non-negative number");
  }

  if (
    quantity === undefined ||
    quantity === null ||
    quantity === "" ||
    !Number.isInteger(Number(quantity)) ||
    Number(quantity) < 0
  ) {
    errors.push("Quantity must be a non-negative integer");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Product validation failed",
      errors
    });
  }

  next();
}

module.exports = validateProduct;
