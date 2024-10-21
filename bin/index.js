#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import path from 'path';
import fetchMetadata from '../lib/fetchMetadata.js';
import queryMetadata from '../lib/queryMetadata.js';
import fs from 'fs-extra';
import inquirer from 'inquirer'; // Import Inquirer

const program = new Command();

// Utility to get __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamically read package.json to get version
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = await fs.readJson(packageJsonPath);

program
  .name('d365-metadata-cli')
  .description('CLI tool to fetch, parse, and query Dynamics 365 OData metadata')
  .version(packageJson.version);

// Command: fetch
program
  .command('fetch')
  .description('Fetch and parse the OData $metadata XML')
  .requiredOption('-u, --url <metadataUrl>', 'OData metadata URL')
  .option('-t, --token <bearerToken>', 'Bearer Token for authentication', process.env.DYNAMICS_BEARER_TOKEN)
  .option('-o, --output <outputPath>', 'Output path for parsed metadata JSON', path.join(__dirname, '../data/metadata.json'))
  .action(async (options) => {
    try {
      let token = options.token;

      if (!token) {
        // Prompt the user for the Bearer Token if not provided
        const answers = await inquirer.prompt([
          {
            type: 'password',
            name: 'bearerToken',
            message: 'Enter your Bearer Token:',
            mask: '*',
            validate: function (value) {
              if (value.length && value.split('.').length === 3) { // Simple JWT format check
                return true;
              } else {
                return 'Please enter a valid Bearer Token.';
              }
            },
          },
        ]);
        token = answers.bearerToken;
      }

      await fetchMetadata(options.url, options.output, token);
      console.log(chalk.green('Metadata fetched and parsed successfully.'));
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.error(chalk.red('Unauthorized: Please check your Bearer Token.'));
      } else {
        console.error(chalk.red('Error fetching metadata:'), error.message);
      }
    }
  });

// Command: list
program
  .command('list')
  .description('List all available entities/tables')
  .option('-i, --input <inputPath>', 'Path to parsed metadata JSON', path.join(__dirname, '../data/metadata.json'))
  .action(async (options) => {
    try {
      const entities = await queryMetadata.listEntities(options.input);
      console.log(chalk.blue('Available Entities:'));
      entities.forEach((entity, index) => {
        console.log(`${index + 1}. ${entity}`);
      });
    } catch (error) {
      console.error(chalk.red('Error listing entities:'), error.message);
    }
  });

// Command: show
program
  .command('show <entity>')
  .description('Show detailed mapping of a specific entity/table')
  .option('-i, --input <inputPath>', 'Path to parsed metadata JSON', path.join(__dirname, '../data/metadata.json'))
  .action(async (entity, options) => {
    try {
      const entityDetails = await queryMetadata.showEntity(entity, options.input);
      if (!entityDetails) {
        console.log(chalk.yellow(`Entity "${entity}" not found.`));
        return;
      }

      console.log(chalk.green(`\nEntity: ${entityDetails.name}\n`));

      console.log(chalk.blue('Keys:'));
      entityDetails.keys.forEach((key) => {
        console.log(` - ${key}`);
      });

      console.log(chalk.blue('\nProperties:'));
      entityDetails.properties.forEach((prop) => {
        console.log(` - ${prop.name} (${prop.type})${prop.nullable ? ' [Nullable]' : ' [Not Nullable]'}`);
      });

      if (entityDetails.navigationProperties.length > 0) {
        console.log(chalk.blue('\nNavigation Properties:'));
        entityDetails.navigationProperties.forEach((nav) => {
          console.log(` - ${nav.name} -> ${nav.type}`);
        });
      } else {
        console.log(chalk.blue('\nNavigation Properties: None'));
      }

    } catch (error) {
      console.error(chalk.red('Error showing entity details:'), error.message);
    }
  });

// Command: search
program
  .command('search <query>')
  .description('Search for entities by partial name')
  .option('-i, --input <inputPath>', 'Path to parsed metadata JSON', path.join(__dirname, '../data/metadata.json'))
  .action(async (query, options) => {
    try {
      const entities = await queryMetadata.listEntities(options.input);
      const results = entities.filter((entity) => entity.toLowerCase().includes(query.toLowerCase()));

      if (results.length === 0) {
        console.log(chalk.yellow('No entities found matching the query.'));
        return;
      }

      console.log(chalk.blue('Search Results:'));
      results.forEach((entity, index) => {
        console.log(`${index + 1}. ${entity}`);
      });
    } catch (error) {
      console.error(chalk.red('Error searching entities:'), error.message);
    }
  });

// Command: export
program
  .command('export <entity>')
  .description('Export detailed mapping of a specific entity/table to Markdown')
  .option('-i, --input <inputPath>', 'Path to parsed metadata JSON', path.join(__dirname, '../data/metadata.json'))
  .option('-o, --output <outputPath>', 'Output path for the Markdown file', path.join(__dirname, '../data/entity.md'))
  .action(async (entity, options) => {
    try {
      await queryMetadata.exportEntityToMarkdown(entity, options.input, options.output);
      console.log(chalk.green(`Entity "${entity}" exported to ${options.output}`));
    } catch (error) {
      console.error(chalk.red('Error exporting entity:'), error.message);
    }
  });

// Parse and execute commands
program.parse(process.argv)