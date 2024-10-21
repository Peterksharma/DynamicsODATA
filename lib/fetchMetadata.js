// lib/fetchMetadata.js

import axios from 'axios';
import fs from 'fs-extra';
import xml2js from 'xml2js';
import ora from 'ora';
import chalk from 'chalk';
import path from 'path';

/**
 * Fetches metadata from the given URL, parses it, and saves the processed data to a JSON file.
 * @param {string} metadataUrl - The URL to fetch the OData $metadata XML.
 * @param {string} outputPath - The file path to save the parsed metadata JSON.
 * @param {string} bearerToken - The Bearer Token for authentication.
 */
async function fetchMetadata(metadataUrl, outputPath, bearerToken) {
  const spinner = ora('Fetching metadata...').start();

  try {
    // Fetch the XML metadata with Authorization header
    const response = await axios.get(metadataUrl, {
      responseType: 'text',
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: 'application/xml', // Ensure the response is in XML
      },
    });

    spinner.text = 'Saving raw metadata to file for inspection...';

    // Save the full response to a file for verification
    const rawMetadataPath = path.join(path.dirname(outputPath), 'raw_metadata.xml');
    await fs.writeFile(rawMetadataPath, response.data, 'utf-8');

    spinner.text = 'Parsing XML metadata...';

    // Parse the XML to JSON
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      mergeAttrs: true,
      tagNameProcessors: [xml2js.processors.stripPrefix],
    });

    const parsedResult = await parser.parseStringPromise(response.data);

    // Log the entire parsed JSON for debugging
    console.log(chalk.yellow('\n--- Parsed JSON Structure ---\n'));
    console.log(JSON.stringify(parsedResult, null, 2));
    console.log(chalk.yellow('\n--- End of Parsed JSON Structure ---\n'));

    spinner.text = 'Processing metadata...';

    // Process the parsed JSON to extract entities
    const processedData = processMetadata(parsedResult);

    // Ensure the output directory exists
    await fs.ensureDir(path.dirname(outputPath));

    // Write the processed metadata to a JSON file
    await fs.writeJson(outputPath, processedData, { spaces: 2 });

    spinner.succeed('Metadata fetched and parsed successfully.');
    console.log(chalk.green(`Raw metadata saved to ${rawMetadataPath}`));
  } catch (error) {
    spinner.fail('Failed to fetch or parse metadata.');

    if (error.response) {
      console.error(chalk.red(`Status Code: ${error.response.status}`));
      console.error(chalk.red(`Response Data: ${error.response.data}`));
    } else {
      console.error(chalk.red(error.message));
    }

    throw error;
  }
}

/**
 * Processes the parsed JSON metadata to extract entities.
 * @param {Object} parsedJson - The parsed JSON object from XML.
 * @returns {Object} - The processed metadata containing entities.
 */
function processMetadata(parsedJson) {
  const schemas = parsedJson['Edmx']?.['DataServices']?.['Schema'];
  if (!schemas) {
    throw new Error('Invalid metadata format: Missing Schema.');
  }

  // Handle multiple schemas
  const schemaArray = Array.isArray(schemas) ? schemas : [schemas];

  const entities = [];

  schemaArray.forEach((schema) => {
    const entityTypes = schema.EntityType;
    if (!entityTypes) return;

    // Handle multiple entities
    const entityArray = Array.isArray(entityTypes) ? entityTypes : [entityTypes];

    entityArray.forEach((entity) => {
      const entityName = entity.Name;
      const keyProps = extractKeyProperties(entity.Key);
      const properties = extractProperties(entity.Property);
      const navigationProperties = extractNavigationProperties(entity.NavigationProperty);

      entities.push({
        name: entityName,
        keys: keyProps,
        properties: properties,
        navigationProperties: navigationProperties,
      });
    });
  });

  return { entities };
}

function extractKeyProperties(keyObj) {
  if (!keyObj || !keyObj.PropertyRef) return [];

  const propertyRefs = Array.isArray(keyObj.PropertyRef) ? keyObj.PropertyRef : [keyObj.PropertyRef];
  return propertyRefs.map((prop) => prop.Name);
}

function extractProperties(propObj) {
  if (!propObj) return [];

  const properties = Array.isArray(propObj) ? propObj : [propObj];
  return properties.map((prop) => ({
    name: prop.Name,
    type: prop.Type,
    nullable: prop.Nullable === 'true',
    annotations: extractAnnotations(prop.Annotation),
  }));
}

function extractNavigationProperties(navObj) {
  if (!navObj) return [];

  const navProps = Array.isArray(navObj) ? navObj : [navObj];
  return navProps.map((nav) => ({
    name: nav.Name,
    type: nav.Type,
  }));
}

function extractAnnotations(annotations) {
  if (!annotations) return [];

  const annots = Array.isArray(annotations) ? annotations : [annotations];
  return annots.map((annot) => ({
    term: annot.Term,
    value: annot.String || annot.Bool || annot.EnumMember || '',
  }));
}

export default fetchMetadata;