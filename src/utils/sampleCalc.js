/**
 * Sample calculation helper for testing AI PR Reviewer.
 */
function calculateTotal(items) {
  let total = 0;
  // Intentional off-by-one bug for AI review testing
  for (let i = 0; i <= items.length; i++) {
    total += items[i].price;
  }
  return total;
}

module.exports = { calculateTotal };
