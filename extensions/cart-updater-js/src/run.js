// @ts-check

/**
 * @typedef {import("../generated/api").Input} RunInput
 * @typedef {import("../generated/api").FunctionResult} FunctionRunResult
 */

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  try {
    if (!input?.cart?.lines?.length) {
      console.log("❌ No cart lines found");
      return { operations: [] };
    }
    
    console.log(`🛒 Processing ${input.cart.lines.length} cart lines`);
    const operations = [];
    
    for (const line of input.cart.lines) {
      try {
        if (!line?.id || !line?.merchandise) {
          console.log("❌ Invalid line data");
          continue;
        }
        
        console.log(`🔄 Processing line ID: ${line.id}`);
        const { merchandise, quantity } = line;
        console.log(`📊 Line quantity: ${quantity}`);
        
        if (merchandise.__typename !== "ProductVariant") {
          console.log("⚠️ Not a product variant, skipping");
          continue;
        }
        
        if (!merchandise.product?.metafield?.value) {
          console.log("❌ No price breaks metafield found");
          continue;
        }
        
        const metafieldValue = merchandise.product.metafield.value;
        let parsedData, basePrice, quantityBreaks;
        
        try {
          parsedData = JSON.parse(metafieldValue);
          
          const dynamicKey = Object.keys(parsedData)[0];
          if (!dynamicKey || !parsedData[dynamicKey]) {
            console.log("❌ Invalid JSON structure");
            continue;
          }
          
          if (!parsedData[dynamicKey].base_price?.amount) {
            console.log("❌ Missing base_price.amount");
            continue;
          }
          
          basePrice = parseFloat(parsedData[dynamicKey].base_price.amount);
          console.log(`💰 Base price: ${basePrice}`);
          
          if (isNaN(basePrice)) {
            console.log("❌ Base price is not a valid number");
            continue;
          }
          
          quantityBreaks = parsedData[dynamicKey].quantity_breaks || [];
          if (!Array.isArray(quantityBreaks)) {
            console.log("⚠️ No valid quantity breaks found");
            quantityBreaks = [];
          }
          
          console.log(`📊 Found ${quantityBreaks.length} quantity breaks`);
          
          if (quantityBreaks.length > 0) {
            console.log("📊 First quantity break:", JSON.stringify(quantityBreaks[0]));
          }
        } catch (error) {
          console.log(`❌ Error parsing metafield: ${error.message}`);
          continue;
        }
        
        const newPrice = getPriceForQuantity(basePrice, quantityBreaks, quantity);
        console.log(`💵 Calculated price: ${newPrice}`);
        
        if (newPrice !== basePrice) {
          console.log(`✅ PRICE CHANGE: ${basePrice} → ${newPrice}`);
          operations.push({
            update: {
              cartLineId: line.id,
              price: {
                adjustment: {
                  fixedPricePerUnit: {
                    amount: newPrice.toString()
                  }
                }
              }
            }
          });
        }
      } catch (error) {
        console.log(`❌ Line processing error: ${error.message}`);
      }
    }
    
    console.log("-------------------------------------------");
    console.log(`📤 Returning ${operations.length} operations`);
    if (operations.length > 0) {
      console.log("📤 First operation:", JSON.stringify(operations[0]));
    }
    console.log("==========================================");
    
    return { operations };
  } catch (error) {
    console.log(`❌ FATAL ERROR: ${error.message}`);
    return { operations: [] };
  }
}

function getPriceForQuantity(basePrice, quantityBreaks, quantity) {
  if (!quantityBreaks?.length) {
    return basePrice;
  }
  
  try {
    console.log(`🔢 Checking ${quantityBreaks.length} price breaks for quantity ${quantity}`);
    
    let applicablePrice = basePrice;
    let highestMatchingQuantity = 0;
    
    for (const breakItem of quantityBreaks) {
      const minQuantity = parseFloat(breakItem.minimum_quantity);
      const breakPrice = parseFloat(breakItem.price?.amount);
      
      console.log(`📊 Checking break: minimum_quantity=${minQuantity}, price.amount=${breakPrice}`);
      
      if (quantity >= minQuantity && 
          minQuantity > highestMatchingQuantity && 
          !isNaN(breakPrice) && 
          breakPrice > 0) {
        
        applicablePrice = breakPrice;
        highestMatchingQuantity = minQuantity;
        console.log(`✅ BETTER MATCH: ${minQuantity}+ items at ${breakPrice}`);
      }
    }
    
    if (highestMatchingQuantity > 0) {
      console.log(`🏆 Final match: ${highestMatchingQuantity}+ items at ${applicablePrice}`);
      return applicablePrice;
    }
    
    console.log("⚠️ No quantity break matches, using base price");
    return basePrice;
  } catch (error) {
    console.log(`⚠️ Error in price calculation: ${error.message}`);
    return basePrice;
  }
}