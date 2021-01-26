#!/usr/bin/env node
/* eslint-disable prefer-rest-params */
/* eslint-disable array-callback-return */
/* eslint-disable no-unused-vars */
/* eslint-disable consistent-return */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import util from 'util';
import fse from 'fs-extra';
import babel from '@babel/core';
import helpers from './use_require_helpers.js';

const require = createRequire(import.meta.url);
const program = require('commander');

const dirname = path.resolve();
const SUPPORTED_FORMATS = new Set(['amd', 'commonjs', 'systemjs', 'umd']);

program
  .option('--as [format]', `output files using various import formats instead of ES6 import and export.  Supports ${Array.from(SUPPORTED_FORMATS)}.`)
  .option('-m, --with-source-maps [type]', 'output source maps when not generating a bundled app (type may be empty for external source maps, inline for inline source maps, or both) ')
  .option('--with-app', 'process app files as well as core files')
  .option('--only-legacy', 'only output legacy files (no ES6 modules) for the app')
  .option('--clean', 'clear the lib folder before building')
  .parse(process.argv);

// the various important paths
const paths = {
  main: path.resolve(dirname, '..'),
  core: path.resolve(dirname, '..', 'core'),
  app: path.resolve(dirname, '..', 'app'),
  vendor: path.resolve(dirname, '..', 'vendor'),
  js: path.resolve(dirname, '..', 'js'),
  outDirBase: path.resolve(dirname, '..', 'build'),
  libDirBase: path.resolve(dirname, '..', 'lib'),
};

const srcHtmlPath = path.resolve(dirname, '..', 'index.html');
const outHtmlPath = path.resolve(paths.outDirBase, 'index.html');

const noCopyFiles = new Set([
  // skip these -- they don't belong in the processed application
  path.join(paths.vendor, 'sinon.js'),
  path.join(paths.vendor, 'browser-es-module-loader'),
  path.join(paths.app, 'images', 'icons', 'Makefile'),
]);

const onlyLegacyScripts = new Set([
  path.join(paths.vendor, 'promise.js'),
]);

const noTransformFiles = new Set([
  // don't transform this -- we want it imported as-is to properly catch loading errors
  path.join(paths.app, 'error-handler.js'),
]);

noCopyFiles.forEach((file) => noTransformFiles.add(file));

const ensureDir = util.promisify(fse.ensureDir);
const copy = util.promisify(fse.copy);
const babelTransformFile = util.promisify(babel.transformFile);

// walkDir *recursively* walks directories trees,
// calling the callback for all normal files found.
async function walkDir(basePath, cb, filter) {
  const dirents = await fs.promises.readdir(basePath, { withFileTypes: true });

  return Promise.all(
    dirents.map((dirent) => {
      const filepath = path.join(basePath, dirent.name);
      if (filter !== undefined && !filter(filepath)) return Promise.resolve();

      if (dirent.isSymbolicLink()) return Promise.resolve();
      if (dirent.isFile()) return cb(filepath);
      if (dirent.isDirectory()) return walkDir(filepath, cb, filter);
    }),
  );
}

function transformHtml(legacyScripts, onlyLegacy) {
  // write out the modified vnc.html file that works with the bundle
  return fs.promises.readFile(srcHtmlPath)
    .then((contentsRaw) => {
      let contents = contentsRaw.toString();

      const startMarker = '<!-- begin scripts -->\n';
      const endMarker = '<!-- end scripts -->';
      const startInd = contents.indexOf(startMarker) + startMarker.length;
      const endInd = contents.indexOf(endMarker, startInd);

      let newScript = '';
      newScript += '    <script src="js/runtime.js"></script>\n';

      if (onlyLegacy) {
        // Only legacy version, so include things directly
        for (let i = 0; i < legacyScripts.length; i++) {
          newScript += `    <script src="${legacyScripts[i]}"></script>\n`;
        }
      } else {
        // Otherwise include both modules and legacy fallbacks
        newScript += '    <script type="module" crossorigin="anonymous" src="legacy/app.js"></script>\n';
        for (let i = 0; i < legacyScripts.length; i++) {
          newScript += `    <script nomodule src="${legacyScripts[i]}"></script>\n`;
        }
      }

      contents = `${contents.slice(0, startInd)}${newScript}\n${contents.slice(endInd)}`;

      return contents;
    })
    .then((contents) => {
      console.log(`Writing ${outHtmlPath}`);
      return fs.promises.writeFile(outHtmlPath, contents);
    });
}

async function makeLibFiles(importFormat, sourceMaps, withAppDir, onlyLegacy) {
  if (!importFormat) {
    throw new Error('you must specify an import format to generate compiled noVNC libraries');
  } else if (!SUPPORTED_FORMATS.has(importFormat)) {
    throw new Error(`unsupported output format "${importFormat}" for import/export -- only ${Array.from(SUPPORTED_FORMATS)} are supported`);
  }

  // NB: we need to make a copy of babelOpts, since babel sets some defaults on it
  const babelOpts = () => ({
    plugins: [
      '@babel/plugin-transform-regenerator',
    ],
    presets: [
      [
        '@babel/preset-env',
        {
          targets: 'ie >= 9',
          modules: importFormat,
        },
      ],
    ],
    ast: false,
    sourceMaps,
  });

  // No point in duplicate files without the app, so force only converted files
  if (!withAppDir) {
    onlyLegacy = true;
  }

  let inPath;
  let outPathBase;
  if (withAppDir) {
    outPathBase = paths.outDirBase;
    inPath = paths.main;
  } else {
    outPathBase = paths.libDirBase;
  }
  const legacyPathBase = onlyLegacy ? outPathBase : path.join(outPathBase, 'legacy');

  fse.ensureDirSync(outPathBase);

  const helper = helpers[importFormat];

  const outFiles = [];
  const legacyFiles = [];

  const handleDir = (jsOnly, vendorRewrite, inPathBase, filename) => Promise.resolve()
    .then(() => {
      const outPath = path.join(outPathBase, path.relative(inPathBase, filename));
      const legacyPath = path.join(legacyPathBase, path.relative(inPathBase, filename));

      if (path.extname(filename) !== '.js') {
        if (!jsOnly) {
          console.log(`Writing ${outPath}`);
          return copy(filename, outPath);
        }
        return; // skip non-javascript files
      }

      if (noTransformFiles.has(filename)) {
        return ensureDir(path.dirname(outPath))
          .then(() => {
            console.log(`Writing ${outPath}`);
            return copy(filename, outPath);
          });
      }

      if (onlyLegacyScripts.has(filename)) {
        legacyFiles.push(legacyPath);
        return ensureDir(path.dirname(legacyPath))
          .then(() => {
            console.log(`Writing ${legacyPath}`);
            return copy(filename, legacyPath);
          });
      }

      return Promise.resolve()
        .then(() => {
          if (onlyLegacy) {
            return;
          }
          return ensureDir(path.dirname(outPath))
            .then(() => {
              console.log(`Writing ${outPath}`);
              return copy(filename, outPath);
            });
        })
        .then(() => ensureDir(path.dirname(legacyPath)))
        .then(() => {
          const opts = babelOpts();
          if (helper && helpers.optionsOverride) {
            helper.optionsOverride(opts);
          }
          // Adjust for the fact that we move the core files relative
          // to the vendor directory
          if (vendorRewrite) {
            opts.plugins.push(['import-redirect',
              {
                root: legacyPathBase,
                redirect: { 'vendor/(.+)': './vendor/$1' },
              }]);
          }

          return babelTransformFile(filename, opts)
            .then((res) => {
              console.log(`Writing ${legacyPath}`);
              const { map } = res;
              let { code } = res;
              if (sourceMaps === true) {
                // append URL for external source map
                code += `\n//# sourceMappingURL=${path.basename(legacyPath)}.map\n`;
              }
              outFiles.push(`${legacyPath}`);
              return fs.promises.writeFile(legacyPath, code)
                .then(() => {
                  if (sourceMaps === true || sourceMaps === 'both') {
                    console.log(`  and ${legacyPath}.map`);
                    outFiles.push(`${legacyPath}.map`);
                    return fs.promises.writeFile(`${legacyPath}.map`, JSON.stringify(map));
                  }
                });
            });
        });
    });

  {
    const handler = handleDir.bind(null, true, false, inPath || paths.main);
    const filter = (filename) => !noCopyFiles.has(filename);
    await walkDir(paths.vendor, handler, filter);
  }

  {
    const handler = handleDir.bind(null, true, !inPath, inPath || paths.core);
    const filter = (filename) => !noCopyFiles.has(filename);
    await walkDir(paths.core, handler, filter);
  }

  if (withAppDir) {
    const handler = handleDir.bind(null, false, false, inPath);
    const filter = (filename) => !noCopyFiles.has(filename);
    await walkDir(paths.app, handler, filter);
  }

  if (withAppDir) {
    const handler = handleDir.bind(null, false, false, inPath);
    const filter = (filename) => !noCopyFiles.has(filename);
    await walkDir(paths.app, handler, filter);
  }

  {
    const handler = handleDir.bind(null, true, false, inPath || paths.js);
    const filter = (filename) => !noCopyFiles.has(filename);
    await walkDir(paths.js, handler, filter);
  }

  if (withAppDir) {
    if (!helper || !helper.appWriter) {
      throw new Error(`Unable to generate app for the ${importFormat} format!`);
    }

    const outAppPath = path.join(legacyPathBase, 'app.js');
    console.log(`Writing ${outAppPath}`);
    const extraScripts = await helper.appWriter(outPathBase, legacyPathBase, outAppPath);
    let legacyScripts = [];

    legacyFiles.forEach((file) => {
      const relFilePath = path.relative(outPathBase, file);
      legacyScripts.push(relFilePath);
    });

    legacyScripts = legacyScripts.concat(extraScripts);

    const relAppPath = path.relative(outPathBase, outAppPath);
    legacyScripts.push(relAppPath);

    await transformHtml(legacyScripts, onlyLegacy);
    if (helper.removeModules) {
      console.log('Cleaning up temporary files...');
      await Promise.allSettled(
        outFiles.map((filepath) => fs.promises.unlink(filepath)
          .then(fs.promises.rmdir(path.dirname(filepath), { recursive: true }))),
      );
    }
  }
}

if (program.clean) {
  console.log(`Removing ${paths.libDirBase}`);
  fse.removeSync(paths.libDirBase);

  console.log(`Removing ${paths.outDirBase}`);
  fse.removeSync(paths.outDirBase);
}

makeLibFiles(program.as, program.withSourceMaps, program.withApp, program.onlyLegacy)
  .catch((err) => {
    console.error(`Failure converting modules: ${err}`);
    process.exit(1);
  });
