const fs = require('fs');
const xml2js = require('xml2js');

const parser = new xml2js.Parser();
const fileName = 'ModuleData/Markets/weaponmarketall.xml';

const parseTier1Items = (tier1ItemsString) => {
  const items = tier1ItemsString.split('|');
  const parsedItems = items.map((item) => {
    const [id, sell_price, buy_price] = item.split('*');
    return {
      id: id.trim(),
      sell_price: Math.floor(parseInt(sell_price, 10)),
      buy_price: Math.floor(parseInt(buy_price, 10)),
    };
  });
  return parsedItems;
};

const saveJsonFile = async (filePath, data) => {
  try {
    await fs.promises.writeFile(filePath, JSON.stringify(data, null));
    console.log(`Data saved to ${filePath}`);
  } catch (error) {
    console.error('Error writing JSON file:', error);
  }
};

const readXMLFile = async (inputFilePath, outputFilePath) => {
  try {
    const xmlData = await fs.promises.readFile(inputFilePath, 'utf8');
    const parsedData = await parser.parseStringPromise(xmlData);
    const tier1Items = parseTier1Items(parsedData.Market.Tier1Items[0]);

    await saveJsonFile(outputFilePath, tier1Items);
  } catch (error) {
    console.error('Error reading or parsing XML file:', error);
  }
};

const inputFilePath = fileName;
const outputFilePath = 'gen_json_debug/weapons.json';
readXMLFile(inputFilePath, outputFilePath);