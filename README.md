# Shopify Price Breaks Extension

A Shopify cart transform function that applies quantity-based price breaks to products. This extension automatically adjusts product prices in the cart based on quantity thresholds defined in product metafields.

## Features

- Automatic price adjustments based on quantity
- Configurable price breaks through product metafields
- Detailed console logging for debugging
- Support for multiple quantity thresholds

## Setup

1. Install the app in your Shopify store
2. Add price breaks data to your products using the `custom.pricebreaks` metafield
3. The metafield should contain JSON data in the following format:

```json
{
  "PRODUCT_KEY": {
    "base_price": {
      "amount": "18.00"
    },
    "quantity_breaks": [
      {
        "minimum_quantity": "5",
        "price": {
          "amount": "15.00"
        }
      },
      {
        "minimum_quantity": "10",
        "price": {
          "amount": "10.00"
        }
      }
    ]
  }
}
```

## Development

1. Clone this repository
2. Install dependencies: `npm install`
3. Build the extension: `npm run build`
4. Deploy to Shopify: `npm run deploy`

## Testing

1. Add products with price breaks metafields to your cart
2. Adjust quantities to trigger different price breaks
3. Check the browser console for detailed logs

## License

MIT