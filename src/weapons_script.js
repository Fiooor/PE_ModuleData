const fs = require('fs').promises;
const xml2js = require('xml2js');

const parser = new xml2js.Parser();
const fileName = 'ModuleData/Markets/weaponmarketall.xml';
const fileCrafting = 'ModuleData/CraftingRecipies/all_weapons.xml';

function parseTierCraftings(tierCraftingsString) {
  const recipes = tierCraftingsString.split('|');
  const parsedRecipes = recipes.map((recipe) => {
    const [craftingTimeString, craftingRecipeString] = recipe.split('=');
    const [craftingTime, itemId, amount = null] = craftingTimeString.split('*').map((part) => part.trim());
    const ingredients = craftingRecipeString.split('*').map((ingredient) => ingredient.trim());
    return {
      id: itemId,
      crafting_recipe: ingredients.reduce((obj, ingredient, index) => {
        if (index % 2 !== 0) {
          obj[ingredients[index - 1]] = parseInt(ingredient, 10);
        }
        return obj;
      }, {}),
      count: amount ? parseInt(amount, 10) : null,
      crafting_time: parseInt(craftingTime, 10),
    };
  });
  return parsedRecipes;
}


async function mergeData(inputFilePath1, inputFilePath2, outputFilePath) {
  try {
    const [craftingData, marketData] = await Promise.all([
      readCraftingXMLFile(inputFilePath1),
      readfilenameXMLFile(inputFilePath2),
    ]);

    const mergedData = {};

    for (const tier in marketData) {
      mergedData[tier] = marketData[tier].map((marketItem) => {
        for (const craftingTier in craftingData) {
          const craftingItem = craftingData[craftingTier].find((item) => item.id === marketItem.id);
          if (craftingItem) {
            return {
              ...marketItem,
              ...craftingItem,
              tier: craftingTier,
            };
          }
        }
        return {
          ...marketItem,
          tier,
        };
      });
    }

    await saveJsonFile(outputFilePath, mergedData);
  } catch (error) {
    console.error('Error merging data:', error);
  }
}


function parseTierItems(tierItemsString) {
  const items = tierItemsString.split('|');
  const parsedItems = items.map((item) => {
    const [id, sell_price, buy_price] = item.split('*');
    return {
      id: id.trim(),
      sell_price: Math.floor(parseInt(sell_price, 10)),
      buy_price: Math.floor(parseInt(buy_price, 10)),
    };
  });
  return parsedItems;
}

async function saveJsonFile(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null));
    console.log(`Data saved to ${filePath}`);
  } catch (error) {
    console.error('Error writing JSON file:', error);
  }
}

async function readCraftingXMLFile(inputFilePath) {
  try {
    const xmlData = await fs.readFile(inputFilePath, 'utf8');
    const parsedData = await parser.parseStringPromise(xmlData);

    const recipiesData = parsedData.Recipies;
    const tier1Craftings = parseTierCraftings(recipiesData.Tier1Craftings[0]);
    const tier2Craftings = parseTierCraftings(recipiesData.Tier2Craftings[0]);
    const tier3Craftings = parseTierCraftings(recipiesData.Tier3Craftings[0]);

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

const outputFilePath = 'gen_json_debug/weapons.json';
mergeData(fileCrafting, fileName, outputFilePath);
