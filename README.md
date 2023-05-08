# pe-moduledata-generator

## Overview
This is a Node.js script that generates crafting recipes and market configurations for armor items based on their values in Persistent Empires. The script reads armor item data from several XML files, merges the data from different cultures, sorts the armor items by their total armor value, calculates their tier based on predetermined breakpoints, generates crafting recipes and market configurations, and saves the data as XML files in separate folders.
## Requirements
To run this script, you will need:

- Node.js v12.0.0 or later
- Yarn or NPM package manager

## Installation
1. Clone the repository or download the source code.
2. Open a terminal in the project directory.
3. Run `yarn install` or `npm install` to install the dependencies.

## Usage
1. Open a terminal in the project directory.
2. Run `yarn start` or `npm start` to run the script.
3. Wait for the script to finish running. The generated XML files will be saved in the `gen_craftingrecipies` and `gen_markets` folders.
4. The generated JSON file `items.json` will be saved in the project directory.

Note: The script assumes that the armor item data is stored in several XML files in the `ModuleData` directory. You can modify the file paths in the `fileNames` array to match your project structure.
