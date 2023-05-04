const fs = require('fs');
const xml2js = require('xml2js');

const parser = new xml2js.Parser();
const fileNames = ['ModuleData/pe_head_armors.xml', 'ModuleData/pe_leg_armors.xml', 'ModuleData/pe_body_armors.xml', 'ModuleData/pe_arm_armors.xml', 'ModuleData/pe_shoulder_armors.xml', 'ModuleData/pe_ba_items.xml'];
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
  const metalMaterials = ['pe_iron_ingot', 'pe_iron_ingot', 'pe_steel_ingot', 'pe_steel_ingot', 'pe_silver_ingot', 'pe_thamaskene_steel'];

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

  for (let tier = 1; tier <= 6; tier++) {
    xml += `\t<Tier${tier}Craftings>\n\t\t`;

    const allItems = [];
    for (let component in tierData) {
      tierData[component].forEach(item => {
        if (item.tier === tier) {
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

function writeToFile(culture, xmlData) {
  fs.writeFile(`${culture}_recipies.xml`, xmlData, (err) => {
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
        const culture = item.$.culture;
        const itemType = item.$.Type; // Get item type

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
          writeToFile(culture, xmlData);
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