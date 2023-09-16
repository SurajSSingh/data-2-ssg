"use strict";

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";

/**
 * Types
 * @typedef Flag
 * @type {object}
 * @property {string} long
 * @property {string} short
 * @property {string} description
 * @property {string | undefined} configName

 * @typedef Config
 * @type {object}
 * @property {string} data_dir
 * @property {string} output_dir
 * @property {string} template_dir
 * @property {string} static_dir
 */

// CONSTANTS
const NAME = "Simple SSG";
const VERSION = "0.1.0";

/** @type {Flag[]}  */
const FLAG_LIST = [
  {
    long: "data",
    short: "d",
    description: "What directory to look for the input data",
    configName: "data_dir",
  },
  { long: "help", short: "h", description: "Print out this help information" },
  {
    long: "output",
    short: "o",
    description: "Where to output files after processing",
    configName: "output_dir",
  },
  {
    long: "static",
    short: "s",
    description: "Where static files are located",
    configName: "static_dir",
  },
  {
    long: "template",
    short: "t",
    description: "Where to find templates",
    configName: "template_dir",
  },
  { long: "version", short: "v", description: "Print the current version" },
];

const maxOptionLength = Math.max(
  ...FLAG_LIST.map(({ long, short }) => long.length + short.length + 4),
);

const FLAGS_STRING = FLAG_LIST.map((flag) => {
  const beginning = `--${flag.long},-${flag.short}`;
  const spacing = maxOptionLength - beginning.length + 4;
  return beginning + " ".repeat(spacing) + flag.description;
}).join("\n");

const HELP = `${NAME} ${VERSION}

COMMANDS:
${"help" + " ".repeat(maxOptionLength) + "See --help option"}
${"version" + " ".repeat(maxOptionLength - 3) + "See --version option"}

OPTIONS:
${FLAGS_STRING}
`;

const DEFAULT_DATA_DIR_NAME = "./";
const DEFAULT_OUTPUT_DIR_NAME = "public";
const DEFAULT_TEMPLATE_DIR_NAME = "template";
const DEFAULT_STATIC_DIR_NAME = "static";

// const TEMPLATE_REGEX_SELF_CLOSING = /<\s*template\b\s*.*?\s*(?<slot1>\bslot\s*=\s*"(?<name1>[0-9A-Za-z_-]*)")\s*.*?\s*\/\s*>/;
// const TEMPLATE_REGEX_WITH_DEFAULT = /<\s*template\b\s*.*?\s*(?<slot2>\bslot\s*=\s*"(?<name2>[0-9A-Za-z_-]*)")\s*[^/]*?\s*>\s*(?<default>.*)\s*<\s*\/\s*template\s*>/;
// const namedPaddedRegex = (name, regexArray, flags = "") => new RegExp(`(?<${name}>${paddedRegex(regexArray).source})`, flags);

/**
 * Construct a Regex from an array of Regex with padding (`s*`) between each item
 * @param {RegExp[]} regexArray
 * @param {string} flags
 * @returns {RegExp}
 */
const paddedRegex = (regexArray, flags = "") =>
  new RegExp(regexArray.map((rgx) => rgx.source).join("\s*"), flags);

const TEMPLATE_REGEX_SELF_CLOSING = paddedRegex([
  /</,
  /template\b/,
  /.*?/,
  /\bslot/,
  /=/,
  /(['"])(?<name>[0-9A-Za-z_-]+)\1/,
  /.*?/,
  /\//,
  />/,
], "g");
const TEMPLATE_REGEX_WITH_DEFAULT = paddedRegex([
  /</,
  /template\b/,
  /.*?/,
  /\bslot/,
  /=/,
  /(['"])(?<name>[0-9A-Za-z_-]+)\1/,
  /.*?/,
  />/,
  /(?<default>.*)/,
  /</,
  /\//,
  /template/,
  />/,
], "g");

const TEMPLATE = new RegExp(
  `${TEMPLATE_REGEX_SELF_CLOSING.source}|${TEMPLATE_REGEX_WITH_DEFAULT.source}`,
  "g",
);

/** @type {string[]}  */
let args = [];

if (typeof process !== "undefined") {
  if (process.isBun) {
    // Bun specific code - has process
    args = Bun.argv.slice(2) || [];
  } else if (process.title === "node") {
    // Node.js specific code
    args = process.argv.slice(2) || [];
  } else {
    throw "Unsupported Runtime: Must be either Node, Deno, or Bun";
  }
} else if (typeof Deno !== "undefined") {
  // Deno specific code
  args = Deno.args || [];
} else if (typeof Bun !== "undefined") {
  // Bun specific code - no process
  args = Bun.argv.slice(2) || [];
} else {
  // Unknown specific code
  throw "Unsupported Runtime: Must be either Node, Deno, or Bun";
}

/** @type {Config} */
const DEFAULT_CONFIG = {
  data_dir: "./",
  output_dir: "./public/",
  template_dir: "./template/",
  static_dir: "./static/",
};

/**
 * Handles any file errors
 * @param {Error} error
 * @returns {void}
 */
function handleFileError(error) {
  if (error.code === "ENOENT") {
    console.error(`File not found: ${error.path}`);
  } else if (error.code === "EACCES") {
    console.error(`Permission denied: ${error.path}`);
  } else {
    console.error(`An error occurred: ${error.message}`);
  }
}

/**
 * Read a file, transform it, and then write result to output dir
 * @param {string} srcFilePath - source file path
 * @param {string} templatePath - template directory path
 * @returns {string | undefined}
 */
function transformFile(srcFilePath, templatePath) {
  try {
    const data = readFileSync(srcFilePath).toString();
    const templates = [...data.matchAll(TEMPLATE)];
    let transformedData = "";
    // Run transformation
    if(templates.length > 0){
        let start = 0;
        for (const match of templates) {
            transformedData += data.slice(start, match.index);
            // Copy template there if it exists
            const templateFile = join(templatePath, `${match.groups.name}.html`);
            if(match.groups.name && existsSync(templateFile)){
                transformedData+=readFileSync(templateFile).toString();
            }
            // Or just give default
            else {
                transformedData += match.groups.default ?? "";
            }
            start = match.index + match[0].length;
        }
        transformedData += data.slice(start);
    }

    return transformedData || data;
  } catch (error) {
    handleFileError(error);
  }
}

/**
 * Main function, processes all files part of a given configuration
 * @param {Config} config
 * @returns {void}
 */
function processConfig(config) {
  // Resolve directories
  const dataDir = resolve(config.data_dir);
  const outputDir = resolve(config.output_dir);

  // Read all files in the data directory
  const files = readdirSync(dataDir);

  //   console.log(files);

  // Loop through each file
  files.forEach((filename) => {
    // Check if the file is an HTML file
    if (extname(filename) === ".html") {
      const filePath = join(dataDir, filename);

      // Generate the output file path
      const outFileDir = dirname(filename);
      const names = basename(filename, ".html").split(".");
      const outFilePath = names.length === 1 && names[0] === "index"
        ? join(outputDir, "index.html")
        : join(outputDir, outFileDir, ...names, "index.html");

      // Transform the file
      const data = transformFile(filePath, config.template_dir);

      // Write data to file
      if (data) {
        // // Create the output directory if it doesn't exist
        // if (!existsSync(dirname(outFilePath))) {
        //   mkdirSync(dirname(outFilePath), { recursive: true });
        // }

        // // Write the file to the output directory
        // writeFileSync(outFilePath, data);
        console.log(`Converted and wrote ${filename} to ${outFilePath}`);
      } else {
        console.log(`No data from ${filename}`);
      }
    } else {
      // TODO: What to do with non HTML files
    }
  });
}

/**
 * @typedef PossibleFlags
 * @type {object}
 * @property {string | undefined} data_dir
 * @property {string | undefined} output_dir
 * @property {string | undefined} template_dir
 * @property {string | undefined} static_dir
 * @property {string[]} remaining
 */

/**
 * Read flags from argument and return as structured object
 * @param {string[]} args
 * @returns {PossibleFlags}
 */
function readFlags(args) {
  const possibleFlags = {
    remaining: args,
  };
  if (args) {
    // TODO: Should order actual matter
    let i = 0;
    while (i < args.length) {
      let item = args[i];
      if (item.startsWith("-")) {
        const found_flag = FLAG_LIST.find(({ long, short }) =>
          short === item.slice(1) || long === item.slice(2)
        );
        if (found_flag && found_flag.configName) {
          const nextItem = args[i + 1];
          if (nextItem && !nextItem.startsWith("-")) {
            possibleFlags[found_flag.configName] = nextItem;
            const foundIndex = possibleFlags.remaining.findIndex((elem) =>
              elem === item
            );
            possibleFlags.remaining.splice(foundIndex, 2);
            continue;
          } else {
            // TODO: Return actual error
            throw "TEMP ERROR: Next Item not found";
          }
        } else {
          // TODO: Return actual error
          throw `TEMP ERROR: Unknown flag: ${item}`;
        }
      }
      i += 1;
    }
  }
  return possibleFlags;
}

/**
 * Get configuration from either arguments or just default
 * @param {string[] | undefined} args
 * @returns {Config}
 */
function getConfig(args) {
  let config = DEFAULT_CONFIG;
  config = {
    data_dir: DEFAULT_DATA_DIR_NAME,
  };
  config.output_dir = join(config.data_dir, DEFAULT_OUTPUT_DIR_NAME);
  config.template_dir = join(config.data_dir, DEFAULT_TEMPLATE_DIR_NAME);
  config.static_dir = join(config.data_dir, DEFAULT_STATIC_DIR_NAME);
  if (args) {
    let flags = readFlags(args);
    config.data_dir = flags.data_dir || config.data_dir;
    config.output_dir = flags.output_dir ||
      join(config.data_dir, DEFAULT_OUTPUT_DIR_NAME);
    config.template_dir = flags.template_dir ||
      join(config.data_dir, DEFAULT_TEMPLATE_DIR_NAME);
    config.static_dir = flags.static_dir ||
      join(config.data_dir, DEFAULT_STATIC_DIR_NAME);
  }
  return config;
}

/**
 * Check if an array inlcudes any item from options
 * @param {any[]} arr
 * @param {any[]} options
 * @returns {boolean}
 */
function includesAny(arr, options) {
  for (const item of arr) {
    if (options.includes(item)) return true;
  }
  return false;
}

if (args[0] === "help" || includesAny(args, ["help", "--help", "-h"])) {
  console.log(`${HELP}`);
} else if (
  args[0] === "version" || includesAny(args, ["version", "--version", "-v"])
) {
  console.log(`${NAME} ${VERSION}`);
} else {
  const config = getConfig(args);
  processConfig(config);
}
