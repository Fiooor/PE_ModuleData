const fs = require('fs').promises;
const xml2js = require('xml2js');

const parser = new xml2js.Parser();
const fileName = 'ModuleData/Markets/weaponmarketall.xml';

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

async function readXMLFile(inputFilePath, outputFilePath) {
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

    await saveJsonFile(outputFilePath, allItems);
  } catch (error) {
    console.error('Error reading or parsing XML file:', error);
  }
}

const inputFilePath = fileName;
const outputFilePath = 'gen_json_debug/weapons.json';

readXMLFile(inputFilePath, outputFilePath);
