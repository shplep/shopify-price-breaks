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
        
        // Get the metafields from the product
        const priceBreaksMetafield = merchandise.product?.metafields?.find(m => 
          m.namespace === "custom" && m.key === "pricebreaks"
        );
        
        const zakekePriceMetafield = merchandise.product?.metafields?.find(m => 
          m.namespace === "zakeke" && m.key === "price"
        );
        
        // Parse zakeke price if available
        let zakekePrice = 0;
        if (zakekePriceMetafield?.value) {
          try {
            zakekePrice = parseFloat(zakekePriceMetafield.value);
            console.log(`💰 Zakeke price addition: ${zakekePrice}`);
          } catch (error) {
            console.log(`⚠️ Error parsing zakeke price: ${error.message}`);
            zakekePrice = 0;
          }
        }
        
        // Continue with price breaks logic
        if (!priceBreaksMetafield?.value) {
          // If we only have zakeke price, apply it directly
          if (zakekePrice > 0) {
            console.log(`✅ Applying only zakeke price: ${zakekePrice}`);
            operations.push({
              update: {
                cartLineId: line.id,
                price: {
                  adjustment: {
                    fixedPricePerUnit: {
                      amount: zakekePrice.toString()
                    }
                  }
                }
              }
            });
          } else {
            console.log("❌ No price breaks or zakeke price found");
          }
          continue;
        }
        
        const metafieldValue = priceBreaksMetafield.value;
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
        
        // Calculate price with quantity breaks
        const priceWithBreaks = getPriceForQuantity(basePrice, quantityBreaks, quantity);
        
        // Add zakeke price to the final price
        const finalPrice = priceWithBreaks + zakekePrice;
        console.log(`💵 Final price calculation: ${priceWithBreaks} + ${zakekePrice} = ${finalPrice}`);
        
        // Only add operation if price is different from base
        if (finalPrice !== basePrice) {
          console.log(`✅ PRICE CHANGE: ${basePrice} → ${finalPrice}`);
          operations.push({
            update: {
              cartLineId: line.id,
              price: {
                adjustment: {
                  fixedPricePerUnit: {
                    amount: finalPrice.toString()
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