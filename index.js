const fs = require('fs');
const xml2js = require('xml2js');

const parser = new xml2js.Parser();
const fileNames = ['ModuleData/pe_head_armors.xml', 'ModuleData/pe_leg_armors.xml', 'ModuleData/pe_body_armors.xml', 'ModuleData/pe_arm_armors.xml', 'ModuleData/pe_shoulder_armors.xml', 'ModuleData/pe_ba_items.xml', 'ModuleData/mpitems.xml'];
const marketFileNames = ['/ModuleData/Markets/armormarketall.xml'];


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
  if (tier === 5) {
    multiplier += 1; // Increase the material cost by 1 for tier 5
  } else if (tier === 6) {
    multiplier += 2; // Increase the material cost by 2 for tier 6
  }

  const clothMaterials = ['pe_linen', 'pe_linen', 'pe_cloth', 'pe_cloth', 'pe_velvet', 'pe_velvet'];
  const metalMaterials = ['pe_iron_ingot', 'pe_iron_ingot', 'pe_steel_ingot', 'pe_steel_ingot', 'pe_thamaskene_steel', 'pe_thamaskene_steel'];

  const cloth = clothMaterials[tier - 1];
  const plateMaterial = metalMaterials[tier - 1];

  const plateRecipe = { [cloth]: multiplier, [plateMaterial]: multiplier };

  if (tier > 3 || totalArmorValue > 43) {
    plateRecipe['pe_goldore'] = 1; // Add pe_goldore for tier 3 or higher with armor value greater than 50
    if (tier >= 4) {
      for (const mat in plateRecipe) {
        if (mat !== 'pe_goldore') {
          plateRecipe[mat] += 1;
        }
      }
    }
  }

  switch (material_type) {
    case 'Cloth':
      return { [cloth]: multiplier };
    case 'Leather':
      return { pe_cloth: multiplier };
    case 'Chainmail':
    case 'Plate':
      return plateRecipe;
    default:
      return {};
  }
}

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


function calculateItemPrices(item) {
  const basePrice = 100;
  const tierPriceMultiplier = 1000;
  const armorValueMultiplier = 100;

  const sellPrice = basePrice + (item.tier * tierPriceMultiplier) + (item.totalArmorValue * armorValueMultiplier);
  const buyPrice = sellPrice * 1.5;

  return { sellPrice, buyPrice };
}

function generateMarketXml(culture, marketData) {
  const craftingBoxesValues = "pe_armor_crate_t1*1*1|pe_armor_crate_t2*2*2|pe_armor_crate_t3*3*3";

  let xml = `<Market>\n`;

  for (let tier = 1; tier <= 3; tier++) {
    xml += `\t<Tier${tier}Items>\n\t\t`;

    const allItems = [];
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

    xml += allItems.join('|') + `\n\t</Tier${tier}Items>\n`;
  }

  xml += `\t<CraftingBoxes>\n\t\t`;

  xml += craftingBoxesValues + `\n\t</CraftingBoxes>\n`;

  xml += `</Market>`;

  return xml;
}

function writeToFile(folder, culture, xmlData) {
  fs.writeFile(`${folder}/${culture}_recipies.xml`, xmlData, (err) => {
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
        // Merge items from "Culture.looters" and "Culture.neutral" to other cultures
        for (const sourceCulture of ["Culture.looters", "Culture.neutral_culture"]) {
          if (itemsByCulture[sourceCulture]) { // Check if the sourceCulture exists in itemsByCulture
            for (const component of components) {
              for (const targetCulture in itemsByCulture) {
                if (targetCulture !== sourceCulture) {
                  itemsByCulture[targetCulture][component] = itemsByCulture[targetCulture][component].concat(itemsByCulture[sourceCulture][component]);
                }
              }
            }
          }
        }

        const itemsJson = {};
        for (const culture in itemsByCulture) {
          for (const component of components) {
            itemsByCulture[culture][component].sort((a, b) => a.totalArmorValue - b.totalArmorValue);
            const numTiers = 6;
            const itemsPerTier = Math.ceil(itemsByCulture[culture][component].length / numTiers);

            for (const [index, itemArmor] of itemsByCulture[culture][component].entries()) {
              const tier = Math.min(Math.ceil((index + 1) / itemsPerTier), numTiers);
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
              itemsJson[culture][component].push({
                id: itemArmor.id,
                name: itemArmor.name,
                totalArmorValue: itemArmor.totalArmorValue,
                tier: itemArmor.tier,
                material_type: itemArmor.material_type,
                component_type: component, // Add component_type to the JSON array
                crafting_recipe: craftingRecipe
              });
            });
          }
        }

        // CHANGE: Call generateXml and writeToFile for each culture
        for (const culture in itemsJson) {
          const xmlData = generateXml(culture, itemsJson[culture]);
          writeToFile("gen_craftingrecipies", culture, xmlData);
          const marketXmlData = generateMarketXml(culture, itemsJson[culture]);
          writeToFile("gen_markets", culture, marketXmlData);
        }

        // Save JSON array to file
        fs.writeFile("items.json", JSON.stringify(itemsJson), function (err) {
          if (err) throw err;
          console.log("Items saved to items.json");
        });
      }
    });
  });
});