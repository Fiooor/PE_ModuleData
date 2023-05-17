const fs = require('fs').promises;
const xml2js = require('xml2js');

const parser = new xml2js.Parser();
const fileMarket = 'ModuleData/Markets/weaponmarketall.xml';
const fileCrafting = 'ModuleData/CraftingRecipies/all_weapons.xml';
const fileItemTypes = ['ModuleData/pe_weapons.xml', 'ModuleData/pe_shields.xml']

function parseTierCraftings(tierCraftingsString, tier) {
  const recipes = tierCraftingsString.split('|');
  const clothMaterials = ['pe_linen', 'pe_cloth', 'pe_velvet'];
  const metalMaterials = ['pe_iron_ingot', 'pe_steel_ingot', 'pe_thamaskene_steel'];

  const parsedRecipes = recipes.map((recipe) => {
    const [craftingTimeString, craftingRecipeString] = recipe.split('=');
    const [craftingTime, itemId, amount = null] = craftingTimeString.split('*').map((part) => part.trim());
    const ingredients = craftingRecipeString.split(',').map((ingredientPair) => {
      const [ingredient, value] = ingredientPair.split('*').map((part) => part.trim());

      let replacedIngredient = ingredient;
      if (ingredient === 'clothmaterial') {
        replacedIngredient = clothMaterials[tier - 1];
      } else if (ingredient === 'metalmaterial') {
        replacedIngredient = metalMaterials[tier - 1];
      }

      return { [replacedIngredient]: parseInt(value, 10) };
    });

    return {
      id: itemId,
      crafting_recipe: Object.assign({}, ...ingredients),
      count: amount ? parseInt(amount, 10) : null,
      crafting_time: parseInt(craftingTime, 10),
    };
  });

  return parsedRecipes;
}

const tierPriceMultiplier = 1000;

async function createCultureFiles(cultureList, baseData, outputFilePathBase) {
  try {
    // Loop through each culture
    for (const culture of cultureList) {
      // Filter data based on culture
      let cultureData = JSON.parse(JSON.stringify(baseData)); // Deep copy the base data
      for (const tier in cultureData) {
        cultureData[tier] = cultureData[tier].filter(item => item.culture === culture || item.culture === 'Unknown');

        // If there are no items for this culture in this tier, delete the tier
        if (cultureData[tier].length === 0) {
          delete cultureData[tier];
        }
      }

      // Generate the XML data
      const xmlData = generateXml(cultureData);

      // Generate the culture-specific file path
      const outputFilePath = outputFilePathBase.replace('all', culture.replace('Culture.', ''));

      // Save the XML data to a file
      await writeToFile(outputFilePath, xmlData);
    }
  } catch (error) {
    console.error('Error creating culture files:', error);
  }
}

async function mergeData(inputFilePath1, inputFilePath2, inputFilePaths3, outputFilePath) {
  try {
    const itemDetailsPromises = inputFilePaths3.map(filePath => readItemTypesXMLFile(filePath));
    const [craftingData, marketData, itemDetailsResults] = await Promise.all([
      readCraftingXMLFile(inputFilePath1),
      readfilenameXMLFile(inputFilePath2),
      Promise.all(itemDetailsPromises),
    ]);

    // Merge the results of the item details files into a single object
    const itemDetailsData = Object.assign({}, ...itemDetailsResults);


    const mergedData = {
      Tier1: [],
      Tier2: [],
      Tier3: [],
      Tier4: [],
    };

    for (const tier in marketData) {
      for (const marketItem of marketData[tier]) {
        let mergedItem = null;
        if (marketItem.id) { // Exclude items without an "id" field
          for (const craftingTier in craftingData) {
            const craftingItem = craftingData[craftingTier].find((item) => item.id === marketItem.id);
            if (craftingItem) {
              const tierNumber = parseInt(craftingTier.replace('Tier', ''), 10);
              const priceMultiplier = tierNumber * tierPriceMultiplier;

              mergedItem = {
                ...marketItem,
                ...craftingItem,
                buy_price: marketItem.buy_price + priceMultiplier,
                sell_price: Math.floor((marketItem.buy_price + priceMultiplier) * 0.8), // Calculate the sell_price using the scale
                tier: tierNumber // Add the tier property here
              };
              mergedData[craftingTier].push(mergedItem); // Push the item to the respective tier in mergedData
              break;
            }
          }
          if (!mergedItem) {
            mergedData[tier].push({
              ...marketItem,
              tier: parseInt(tier.replace('Tier', ''), 10) // Add the tier property here
            }); // Push the marketItem if no craftingItem was found
          }
        }
      }

      mergedData['Undefined'] = [];

      // Check for items not present in other tiers
      for (const itemId in itemDetailsData) {
        let found = false;
        for (const tier in mergedData) {
          if (mergedData[tier].find(item => item.id === itemId)) {
            found = true;
            break;
          }
        }

        if (!found) {
          const itemDetail = itemDetailsData[itemId];
          mergedData['Undefined'].push({
            id: itemId,
            type: itemDetail.type || 'Unknown',
            culture: itemDetail.culture || 'Unknown',
            name: itemDetail.name || 'Unknown',
            crafting_template: itemDetail.crafting_template || 'Unknown',
            modifier_group: itemDetail.modifier_group || 'Unknown',
            buy_price: 0,
            sell_price: 0,
          });
        }
      }
    }

    for (const tier in mergedData) {
      for (const item of mergedData[tier]) {
        if (itemDetailsData[item.id]) {
          item.type = itemDetailsData[item.id].type || 'Unknown';
          item.culture = itemDetailsData[item.id].culture || 'Unknown';
          item.name = itemDetailsData[item.id].name || 'Unknown';
          item.crafting_template = itemDetailsData[item.id].crafting_template || 'Unknown';
          item.modifier_group = itemDetailsData[item.id].modifier_group || 'Unknown';
        } else {
          item.type = 'Unknown';
          item.culture = 'Unknown';
          item.name = 'Unknown';
          item.crafting_template = 'Unknown';
          item.modifier_group = 'Unknown';
        }
      }
    }



    // Generate XML using the updated function
    const xmlData = generateXml(mergedData);

    // Save the XML data to a file
    await writeToFile(outputFilePath, xmlData);

    const jsonFilePath = outputFilePath.replace('.xml', '.json');
    const jsonDebugFilePath = jsonFilePath.replace('gen_craftingrecipies', 'gen_json_debug');
    await saveJsonFile(jsonDebugFilePath, mergedData);

    // Extract unique cultures
    const cultureSet = new Set();
    for (const tier in mergedData) {
      for (const item of mergedData[tier]) {
        cultureSet.add(item.culture);
      }
    }

    // Convert the Set to an Array
    const cultureList = Array.from(cultureSet);

    // Pass the culture list to the createCultureFiles function
    createCultureFiles(cultureList, mergedData, outputFilePath);
  } catch (error) {
    console.error('Error merging data:', error);
  }
}

function parseTierItems(tierItemsString) {
  const items = tierItemsString.split('|');
  const sellPriceScale = 0.8; // You can set the desired scale value for the sell_price here

  const parsedItems = items.map((item) => {
    const [id, sell_price, buy_price] = item.split('*');
    const buyPrice = Math.floor(parseInt(buy_price, 10));
    const sellPrice = Math.floor(buyPrice * sellPriceScale); // Calculate the sell_price using the scale

    return {
      id: id.trim(),
      sell_price: sellPrice,
      buy_price: buyPrice,
    };
  });
  return parsedItems;
}

async function saveJsonFile(filePath, data) {
  try {
    const jsonDebugPath = filePath.replace('.json', '').replace('gen_craftingrecipies', 'gen_json_debug/weapons.json');
    await fs.writeFile(jsonDebugPath, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${jsonDebugPath}`);
  } catch (error) {
    console.error('Error writing JSON file:', error);
  }
}


async function readCraftingXMLFile(inputFilePath) {
  try {
    const xmlData = await fs.readFile(inputFilePath, 'utf8');
    const parsedData = await parser.parseStringPromise(xmlData);

    const recipiesData = parsedData.Recipies;
    const tier1Craftings = parseTierCraftings(recipiesData.Tier1Craftings[0], 1);
    const tier2Craftings = parseTierCraftings(recipiesData.Tier2Craftings[0], 2);
    const tier3Craftings = parseTierCraftings(recipiesData.Tier3Craftings[0], 3);

    const allCraftings = {
      Tier1: tier1Craftings,
      Tier2: tier2Craftings,
      Tier3: tier3Craftings,
    };

    return allCraftings;
  } catch (error) {
    console.error('Error reading or parsing XML file:', error);
  }
}

async function readItemTypesXMLFile(inputFilePath) {
  try {
    const xmlData = await fs.readFile(inputFilePath, 'utf8');
    const parsedData = await parser.parseStringPromise(xmlData);
    const itemDetails = {};

    const itemsData = parsedData.Items.Item || [];
    const craftedItemsData = parsedData.Items.CraftedItem || [];

    for (const item of itemsData) {
      const typeValue = item.$.Type || item.$.crafting_template || 'Unknown';
      itemDetails[item.$.id] = {
        type: typeValue,
        culture: item.$.culture || 'Unknown',
        name: item.$.name || 'Unknown',
        crafting_template: item.$.crafting_template || 'Unknown',
        modifier_group: item.$.modifier_group || 'Unknown',
      };
    }

    for (const item of craftedItemsData) {
      const typeValue = item.$.crafting_template || 'Unknown';
      itemDetails[item.$.id] = {
        type: typeValue,
        culture: item.$.culture || 'Unknown',
        name: item.$.name || 'Unknown',
        crafting_template: item.$.crafting_template || 'Unknown',
        modifier_group: item.$.modifier_group || 'Unknown',
      };
    }

    return itemDetails;
  } catch (error) {
    console.error('Error reading or parsing XML file:', error);
  }
}


async function readfilenameXMLFile(inputFilePath) {
  try {
    const xmlData = await fs.readFile(inputFilePath, 'utf8');
    const parsedData = await parser.parseStringPromise(xmlData);

    const marketData = parsedData.Market;
    const tier1Items = parseTierItems(marketData.Tier1Items[0]);
    const tier2Items = parseTierItems(marketData.Tier2Items[0]);
    const tier3Items = parseTierItems(marketData.Tier3Items[0]);
    const tier4Items = parseTierItems(marketData.Tier4Items[0]);

    const allItems = {
      Tier1: tier1Items,
      Tier2: tier2Items,
      Tier3: tier3Items,
      Tier4: tier4Items,
    };

    return allItems;
  } catch (error) {
    console.error('Error reading or parsing XML file:', error);
  }
}

function generateXml(tierData) {
  const craftingTime = 10;
  const defaultAmount = 1;
  let xml = `<Recipies>\n`;

  const constantLine = "pe_buildhammer*55*100|PE_fishing_rod*270*320|PE_peasant_pickaxe_1_t1*290*360|PE_peasant_hatchet_1_t1*55*100|PE_peasant_sickle_1_t1*55*100";

  for (let tier = 1; tier <= 3; tier++) {
    xml += `\t<Tier${tier}Craftings>\n\t\t`;

    const allItems = [];
    for (const component in tierData) {
      tierData[component].forEach(item => {
        if (item.tier === tier) {
          const craftingRecipe = Object.entries(item.crafting_recipe)
            .map(([material, amount]) => `${material}*${amount}`)
            .join(',');
          allItems.push(`${craftingTime}*${item.id}*${item.amount || defaultAmount}=${craftingRecipe}`);
        }
      });
    }

    if (tier === 1) {
      xml += constantLine + '|';
    }

    xml += allItems.join('|') + `\n\t</Tier${tier}Craftings>\n`;
  }

  xml += `</Recipies>`;

  return xml;
}
async function writeToFile(filePath, data) {
  try {
    await fs.writeFile(filePath, data);
    console.log(`Data saved to ${filePath}`);
  } catch (error) {
    console.error('Error writing file:', error);
  }
}

const outputFilePath = 'gen_craftingrecipies/crafting_weapons_all.xml';
mergeData(fileCrafting, fileMarket, fileItemTypes, outputFilePath);