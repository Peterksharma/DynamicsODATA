// lib/queryMetadata.js

import fs from 'fs-extra';
import chalk from 'chalk';
import path from 'path';

/**
 * Lists all available entities from the parsed metadata JSON.
 * @param {string} inputPath - Path to the parsed metadata JSON file.
 * @returns {Promise<Array<string>>} - A promise that resolves to an array of entity names.
 */
async function listEntities(inputPath) {
  try {
    const data = await fs.readJson(inputPath);
    const entities = data.entities.map((entity) => entity.name).sort();
    return entities;
  } catch (error) {
    throw new Error(`Failed to read metadata JSON: ${error.message}`);
  }
}

/**
 * Shows detailed mapping of a specific entity.
 * @param {string} entityName - The name of the entity to display.
 * @param {string} inputPath - Path to the parsed metadata JSON file.
 * @returns {Promise<Object|null>} - A promise that resolves to the entity details or null if not found.
 */
async function showEntity(entityName, inputPath) {
  try {
    const data = await fs.readJson(inputPath);
    const entity = data.entities.find((e) => e.name.toLowerCase() === entityName.toLowerCase());
    return entity || null;
  } catch (error) {
    throw new Error(`Failed to read metadata JSON: ${error.message}`);
  }
}

/**
 * Exports detailed mapping of a specific entity to a Markdown file.
 * @param {string} entityName - The name of the entity to export.
 * @param {string} inputPath - Path to the parsed metadata JSON file.
 * @param {string} outputPath - Path to save the Markdown file.
 */
async function exportEntityToMarkdown(entityName, inputPath, outputPath) {
  try {
    const entityDetails = await showEntity(entityName, inputPath);
    if (!entityDetails) {
      throw new Error(`Entity "${entityName}" not found.`);
    }

    let markdown = `# Entity: ${entityDetails.name}\n\n`;

    markdown += `## Keys\n`;
    entityDetails.keys.forEach((key) => {
      markdown += `- ${key}\n`;
    });

    markdown += `\n## Properties\n`;
    entityDetails.properties.forEach((prop) => {
      markdown += `- **${prop.name}** (${prop.type})${prop.nullable ? ' _[Nullable]_' : ' _[Not Nullable]_' }\n`;
    });

    if (entityDetails.navigationProperties.length > 0) {
      markdown += `\n## Navigation Properties\n`;
      entityDetails.navigationProperties.forEach((nav) => {
        markdown += `- **${nav.name}** → ${nav.type}\n`;
      });
    } else {
      markdown += `\n## Navigation Properties\n- None\n`;
    }

    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, markdown, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to export entity to Markdown: ${error.message}`);
  }
}

export default {
  listEntities,
  showEntity,
  exportEntityToMarkdown,
};