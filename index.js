const fs = require('fs');
const xml2js = require('xml2js');

const parser = new xml2js.Parser();
const fileNames = ['ModuleData/pe_head_armors.xml', 'ModuleData/pe_leg_armors.xml', 'ModuleData/pe_body_armors.xml', 'ModuleData/pe_arm_armors.xml', 'ModuleData/pe_shoulder_armors.xml', 'ModuleData/mpitems.xml'];

const components = ['head_armor', 'body_armor', 'leg_armor', 'arm_armor', 'shoulder_armor'];
const componentTypes = {
  head_armor: 'HeadArmor',
  body_armor: 'BodyArmor',
  leg_armor: 'LegArmor',
  arm_armor: 'HandArmor',
  shoulder_armor: 'Cape',
};

const slotMultipliers = { head_armor: 4, body_armor: 5, leg_armor: 2, arm_armor: 4, shoulder_armor: 4 };

function getCraftingRecipe(component, material_type, tier, totalArmorValue) {
  let multiplier = slotMultipliers[component];

  const clothMaterials = ['pe_linen', 'pe_linen', 'pe_cloth', 'pe_cloth', 'pe_velvet', 'pe_velvet'];
  const metalMaterials = ['pe_iron_ingot', 'pe_iron_ingot', 'pe_steel_ingot', 'pe_steel_ingot', 'pe_thamaskene_steel', 'pe_thamaskene_steel'];

  const cloth = clothMaterials[tier - 1];
  const plateMaterial = metalMaterials[tier - 1];

  // Calculate the additional material amounts based on tier and totalArmorValue
  const additionalMaterial = Math.floor((tier - 1) * 0.5 * totalArmorValue / 50);
  multiplier += additionalMaterial;

  const plateRecipe = { [cloth]: Math.floor(multiplier / 2), [plateMaterial]: multiplier };

  if (tier > 3 || totalArmorValue > 58) {
    const goldOreAmount = Math.floor(totalArmorValue / 58);
    if (goldOreAmount > 0) {
      plateRecipe['pe_goldore'] = goldOreAmount;
    }
    if (tier >= 4) {
      for (const mat in plateRecipe) {
        if (mat !== 'pe_goldore') {
          plateRecipe[mat] += 1;
        }
      }
    }
  }

  // Cap the crafting materials at 10 for any material
  for (const material in plateRecipe) {
    if (plateRecipe[material] > 10) {
      plateRecipe[material] = 10;
    }
  }

  switch (material_type) {
    case 'Cloth':
      return { [cloth]: Math.min(multiplier, 10) };
    case 'Leather':
      return { [cloth]: Math.min(multiplier, 10) };
    case 'Chainmail':
    case 'Plate':
      return plateRecipe;
    default:
      return {};
  }
}

let combinedMarketData = {};
let combinedCraftingData = {};
let itemsByCulture = {};
let filesProcessed = 0;

function generateXml(culture, tierData) {
  const craftingTime = 10;
  const defaultAmount = 1;
  let xml = `<Recipies>\n`;

  // Update the loop to have only 3 merged tiers
  for (let tier = 1; tier <= 3; tier++) {
    xml += `\t<Tier${tier}Craftings>\n\t\t`;

    const allItems = [];
    for (let component in tierData) {
      tierData[component].forEach(item => {
        // Update the condition to match merged tiers
        if ((tier === 1 && (item.tier === 1 || item.tier === 2)) ||
          (tier === 2 && (item.tier === 3 || item.tier === 4)) ||
          (tier === 3 && (item.tier === 5 || item.tier === 6))) {
          const craftingRecipe = Object.entries(item.crafting_recipe)
            .map(([material, amount]) => `${material}*${amount}`)
            .join(',');
          allItems.push(`${craftingTime}*${item.id}*${item.amount || defaultAmount}=${craftingRecipe}`);
        }
      });
    }

    xml += allItems.join('|') + `\n\t</Tier${tier}Craftings>\n`;
  }

  xml += `</Recipies>`;

  return xml;
}

const materialBasePrices = {
  'pe_linen': 100,
  'pe_cloth': 225,
  'pe_velvet': 475,
  'pe_iron_ingot': 505,
  'pe_steel_ingot': 760,
  'pe_thamaskene_steel': 1520,
  'pe_goldore': 10000,
  'pe_hardwood': 100,
  'pe_wooden_stick': 60,
  'pe_wooden_plank': 100,
  'pe_merchandise_flax': 150,
  'pe_stone': 100,
  'pe_clay': 400,
  'pe_charcoal': 155,
  'pe_cart_packed': 1750,
  'pe_ship_packed': 6425,
  'pe_boat_packed': 1750,
  'pe_ship2_packed': 12400,
  'steppe_fur_harness': 550,
  'stripped_leather_harness': 550,
  'camel_saddle': 2630,
  'northern_noble_harness': 2630,
  'battania_horse_harness_scaled': 4525,
  'imperial_scale_barding': 8325,
  'mail_and_plate_barding': 8325,
  'chain_barding': 8325,
  'pe_wheats_a': 150,
  'pe_fish': 150,
  'pe_meat_raw': 200,
  'pe_chicken_raw': 400,
  'pe_kitchen_basket_grape_b': 150,
  'pe_foods_cabbage_a': 150,
  'pe_foods_basket_olive_a': 250,
  'pe_mi_spice_b': 175,
  'pe_beer_barrel': 850,
  'pe_wine_barrel': 875,
  'pe_beer': 85,
  'pe_wine': 87,
  'pe_pizza': 725,
  'pe_chicken_roast': 450,
  'pe_meat_cooked': 250,
  'pe_pie_meat': 365,
  'pe_pie_fruit': 350,
  'pe_fish_cooked': 175,
  'pe_merchandise_flour': 750,
  'pe_merchandise_grain': 350,
  'pe_kitchen_food_bread_a': 300,
  'pe_spice_sack': 400,
  'pe_bd_oil_lamp_for_table': 300,
};

function calculateItemPrices(item, isCustomMarket = false) {
  const basePrice = 100;
  const tierPriceMultiplier = 100;
  const armorValueMultiplier = 50;
  const sellMarkup = 0.40; // 10% markup on sell price

  let materialCost = 0;

  if (!isCustomMarket) {
    // Calculate the total material cost for the item
    for (const material in item.crafting_recipe) {
      materialCost += item.crafting_recipe[material] * materialBasePrices[material];
    }
  } else {
    materialCost = item.basePrice;
  }

  const sellPrice = isCustomMarket ? Math.floor(materialCost) : Math.floor(basePrice + (item.tier * tierPriceMultiplier) + (item.totalArmorValue * armorValueMultiplier) + materialCost);
  const buyPrice = Math.floor(sellPrice * (1 + sellMarkup)); // Apply markup to sell price

  return { sellPrice, buyPrice };
}

const shops = [
  {
    name: 'market_food_all',
    items: [
      'pe_wheats_a', 'pe_fish', 'pe_meat_raw', 'pe_chicken_raw', 'pe_kitchen_basket_grape_b', 'pe_foods_cabbage_a', 'pe_foods_basket_olive_a', 'pe_mi_spice_b', 'pe_beer_barrel', 'pe_wine_barrel', 'pe_beer', 'pe_wine', 'pe_pizza', 'pe_chicken_roast', 'pe_meat_cooked', 'pe_pie_meat', 'pe_pie_fruit', 'pe_fish_cooked', 'pe_merchandise_flour', 'pe_merchandise_grain', 'pe_kitchen_food_bread_a', 'pe_spice_sack', 'pe_bd_oil_lamp_for_table'
    ]
  },
  {
    name: 'market_general_all',
    items: [
      'pe_hardwood', 'pe_wooden_stick', 'pe_wooden_plank', 'pe_merchandise_flax', 'pe_linen', 'pe_cloth', 'pe_velvet', 'pe_stone', 'pe_ironore', 'pe_silverore', 'pe_goldore', 'pe_clay', 'pe_charcoal', 'pe_iron_ingot', 'pe_steel_ingot', 'pe_thamaskene_steel', 'pe_cart_packed', 'pe_ship_packed', 'pe_boat_packed', 'pe_ship2_packed', 'steppe_fur_harness', 'stripped_leather_harness', 'camel_saddle', 'northern_noble_harness', 'battania_horse_harness_scaled', 'imperial_scale_barding', 'mail_and_plate_barding', 'chain_barding'
    ]
  }
];

function generateMultipleCustomMarketXmls(shops, materialBasePrices) {
  shops.forEach(shop => {
    let customMarketItems = {};

    shop.items.forEach(item => {
      const material = item;
      const basePrice = materialBasePrices[material];

      if (basePrice) {
        const minMultiplier = 0.9; // You can set your desired multiplier here
        const maxMultiplier = 1.25; // You can set your desired multiplier here

        customMarketItems[material] = {
          id: material,
          minPrice: Math.round(basePrice * minMultiplier),
          maxPrice: Math.round(basePrice * maxMultiplier),
          basePrice: basePrice,
          tier: 1 // Set tier to 1 for custom market items
        };
      }
    });

    const marketXml = generateMarketXml(null, customMarketItems, true);
    writeToFile('./gen_markets', shop.name, marketXml);
  });
}

function generateMarketXml(culture, marketData, isCustomMarket = false) {
  let xml = `<Market>\n`;

  for (let tier = 1; tier <= 3; tier++) {
    if (isCustomMarket && tier !== 1) break; // Skip tiers other than 1 for custom markets

    xml += `\t<Tier${tier}Items>\n\t\t`;

    const allItems = [];

    if (isCustomMarket) {
      // Handle custom market items
      for (let itemKey in marketData) {
        const item = marketData[itemKey];
        const { sellPrice, buyPrice } = calculateItemPrices(item, true); // Pass 'true' for custom markets
        allItems.push(`${itemKey}*${sellPrice}*${buyPrice}`);
      }
    } else {
      // Handle regular market items
      for (let component in marketData) {
        marketData[component].forEach(item => {
          // Update the condition to match merged tiers
          if ((tier === 1 && (item.tier === 1 || item.tier === 2)) ||
            (tier === 2 && (item.tier === 3 || item.tier === 4)) ||
            (tier === 3 && (item.tier === 5 || item.tier === 6))) {
            const { sellPrice, buyPrice } = calculateItemPrices(item);
            allItems.push(`${item.id}*${sellPrice}*${buyPrice}`);
          }
        });
      }
    }

    xml += allItems.join('|') + `\n\t</Tier${tier}Items>\n`;
  }

  xml += `\t<Tier4Items>\n\t\t`;
  xml += `\n\t</Tier4Items>\n`;

  if (!isCustomMarket) { // Add CraftingBoxes section only if it's not a custom market
    xml += `\t<CraftingBoxes>\n\t\t`;
    xml += "pe_armor_crate_t1*1*1|pe_armor_crate_t2*2*2|pe_armor_crate_t3*3*3" + `\n\t</CraftingBoxes>\n`;
  }

  xml += `</Market>`;

  return xml;
}

function calculateTierBreakpoints(itemsByComponent) {
  const breakpoints = {};
  for (const component of components) {
    const allItems = [];
    for (const culture in itemsByCulture) {
      allItems.push(...itemsByCulture[culture][component]);
    }
    allItems.sort((a, b) => a.totalArmorValue - b.totalArmorValue);

    const numTiers = 6;
    const tierRange = Math.ceil(allItems.length / numTiers);
    breakpoints[component] = [];

    for (let i = 0; i < numTiers - 1; i++) {
      const rangeStart = i * tierRange;
      const rangeEnd = (i + 1) * tierRange;
      breakpoints[component].push(allItems[rangeEnd - 1].totalArmorValue);
    }
  }
  return breakpoints;
}

function writeToFile(folder, culture, xmlData) {
  fs.writeFile(`${folder}/${culture}.xml`, xmlData, (err) => {
    if (err) {
      console.error(`Error writing to file for culture ${culture}: `, err);
      return;
    }
    console.log(`Successfully wrote to file for culture ${culture}`);
  });
}

fileNames.forEach((fileName) => {
  fs.readFile(fileName, function (err, data) {
    parser.parseString(data, function (err, result) {
      const items = result.Items.Item;
      for (const item of items) {
        const itemId = item.$.id;
        const culture = item.$.culture;
        const itemType = item.$.Type; // Get item type

        // Remove Admin Armor from the Crafting Pool
        if (itemId.startsWith("PE_dummy_")) {
          continue;
        }

        if (!itemsByCulture[culture]) {
          itemsByCulture[culture] = {};
          for (const component of components) {
            itemsByCulture[culture][component] = [];
          }
        }

        for (const component of components) {
          if (componentTypes[component] === itemType) { // Check if the item type matches the component type
            const armor = item.ItemComponent[0].Armor[0];
            let totalArmorValue = 0;
            if (component === 'shoulder_armor') {
              totalArmorValue += Number(armor.$.body_armor) || 0;
              totalArmorValue += Number(armor.$.arm_armor) || 0;
            } else if (component === 'body_armor') {
              totalArmorValue += Number(armor.$.body_armor) || 0;
              totalArmorValue += Number(armor.$.leg_armor) || 0;
              totalArmorValue += Number(armor.$.arm_armor) || 0;
            } else {
              totalArmorValue += Number(armor.$[component]) || 0;
            }

            itemsByCulture[culture][component].push({
              id: item.$.id,
              name: item.$.name,
              totalArmorValue: totalArmorValue || 0,
              material_type: armor.$.material_type,
              armor_type: component // Add armor_type to the object
            });
          }
        }
      }

      filesProcessed++;
      if (filesProcessed === fileNames.length) {
        // Merge items from "Culture.looters" and "Culture.neutral_culture" to other cultures
        for (const sourceCulture of ["Culture.looters", "Culture.neutral_culture"]) {
          if (itemsByCulture[sourceCulture]) { // Check if the sourceCulture exists in itemsByCulture
            for (const component of components) {
              for (const targetCulture in itemsByCulture) {
                if (targetCulture !== sourceCulture && targetCulture !== "undefined") {
                  if (!((sourceCulture === "Culture.looters" && targetCulture === "Culture.neutral_culture") ||
                    (sourceCulture === "Culture.neutral_culture" && targetCulture === "Culture.looters"))) {
                    itemsByCulture[targetCulture][component] = itemsByCulture[targetCulture][component].concat(itemsByCulture[sourceCulture][component]);
                  }
                }
              }
            }
          }
        }

        const itemsJson = {};
        const tierBreakpoints = calculateTierBreakpoints(itemsByCulture); // Add this line to call the function

        for (const culture in itemsByCulture) {
          for (const component of components) {
            itemsByCulture[culture][component].sort((a, b) => a.totalArmorValue - b.totalArmorValue);

            for (const [index, itemArmor] of itemsByCulture[culture][component].entries()) {
              let tier = 1;
              const breakpoints = tierBreakpoints[component];
              for (const [tierIndex, breakpoint] of breakpoints.entries()) {
                if (itemArmor.totalArmorValue > breakpoint) {
                  tier = tierIndex + 2;
                } else {
                  break;
                }
              }
              itemArmor.tier = tier;
            }

            if (!itemsJson[culture]) {
              itemsJson[culture] = {};
            }
            if (!itemsJson[culture][component]) {
              itemsJson[culture][component] = [];
            }

            itemsByCulture[culture][component].forEach((itemArmor) => {
              const craftingRecipe = getCraftingRecipe(component, itemArmor.material_type, itemArmor.tier, itemArmor.totalArmorValue);
              const { sellPrice, buyPrice } = calculateItemPrices({ ...itemArmor, crafting_recipe: craftingRecipe });

              itemsJson[culture][component].push({
                id: itemArmor.id,
                name: itemArmor.name,
                totalArmorValue: itemArmor.totalArmorValue,
                tier: itemArmor.tier,
                material_type: itemArmor.material_type,
                component_type: component,
                crafting_recipe: craftingRecipe,
                sell_price: sellPrice,
                buy_price: buyPrice
              });
            });
          }
        }

        // CHANGE: Call generateXml and writeToFile for each culture
        for (const culture in itemsJson) {
          const xmlData = generateXml(culture, itemsJson[culture]);
          writeToFile("gen_craftingrecipies", culture.replace('Culture.', 'crafting_armor_'), xmlData);
          const marketXmlData = generateMarketXml(culture, itemsJson[culture]);
          writeToFile("gen_markets", culture.replace('Culture.', 'market_armor_'), marketXmlData);

          for (const component of components) {
            if (!combinedMarketData[component]) {
              combinedMarketData[component] = [];
            }
            if (!combinedCraftingData[component]) {
              combinedCraftingData[component] = [];
            }

            combinedMarketData[component] = combinedMarketData[component].concat(itemsJson[culture][component]);
            combinedCraftingData[component] = combinedCraftingData[component].concat(itemsJson[culture][component]);
          }
        }

        const combinedMarketXmlData = generateMarketXml("all", combinedMarketData);
        writeToFile("gen_markets", "market_armor_all", combinedMarketXmlData);

        const combinedCraftingXmlData = generateXml("all", combinedCraftingData);
        writeToFile("gen_craftingrecipies", "crafting_armor_all", combinedCraftingXmlData);

        // Generate the Custom Markets
        generateMultipleCustomMarketXmls(shops, materialBasePrices);


        // Save JSON array to file
        fs.writeFile("items.json", JSON.stringify(itemsJson), function (err) {
          if (err) throw err;
          console.log("Items saved to items.json");
        });
      }
    });
  });
});