// https://www.twilio.com/blog/how-to-build-a-cli-with-node-js

import { fontawesomeSubset } from 'fontawesome-subset';
import chokidar from 'chokidar'
import fastGlob from 'fast-glob'
import fs from 'fs'
import arg from 'arg'
import path from 'path'
import sass from 'sass'
import yaml from 'yaml'

function parseArgumentsIntoOptions(rawArgs) {
  const args = arg(
    {
      '--watch': Boolean,
      '-w': '--watch',
      '--pro': Boolean,
      '-p': '--pro',
      '--minify': Boolean,
      '-m': '--minify'
    },
    {
      argv: rawArgs.slice(2),
    }
  );
  return {
    watch: args['--watch'] || false,
    pro: args['--pro'] || false,
    minify: args['--minify'] || false
  };
 }

export default function RailsFontAwesomeSubset(args) {

  let options = parseArgumentsIntoOptions(args)

  copyAssets(options)

  //process.exit(0)

  if (options.watch) {
    process.stdin.on('end', () => process.exit(0))

    process.stdin.resume()
  
    startWatcher(options)
  }
}

async function copyAssets(options) {

  //let start = process.hrtime()

  console.log('Extracting icons from templates...')
  
  const templateFiles = fastGlob.sync(['app/views/**/*', 'app/helpers/**/*'])

  let icons = { }

  for (let file of templateFiles) {
    let content = fs.readFileSync(path.resolve(file), 'utf8')

    // In our app we are looking for instances of "= icon(:fas, :file)"
    // The regex will match 'fas' and 'file' so it can subset them.
    let results = [...content.matchAll(/icon\s?\(?:(?<type>(fas|fab|fal|fat|far|fad|fass)),\s*:(?<name>[a-z|_-]*)[,)]/gm)]

    // TODO: Add new font sharp
    for (let result of results) {

      let icon_type = null
      
      switch(result.groups.type) {
        case 'fas':
          icon_type = 'solid'
          break
        case 'far':
          icon_type = 'regular'
          break
        case 'fab':
          icon_type = 'brands'
          break
        case 'fal':
          icon_type = 'light'
          break
        case 'fad':
          icon_type = 'duotone'
          break
        case 'fass':
          icon_type = 'sharp'
          break
      }
      let icon_name = result.groups.name.replaceAll('_', '-')

      if (icons[icon_type] === undefined)
        icons[icon_type] = []

      if(!icons[icon_type].includes(icon_name))
        icons[icon_type].push(icon_name)
    }
  }

  console.log('Subsetting fonts...')

  fontawesomeSubset(icons, 'app/assets/builds/fonts', { package: options.pro ? 'pro' : 'free' })

  console.log('Compiling CSS...')

  let fontawesomePath = 'node_modules/@fortawesome/fontawesome-' + (options.pro ? 'pro' : 'free') + '/'

  let scss = fs.readFileSync(path.resolve(fontawesomePath + 'scss/_functions.scss'), 'utf-8')

  scss += fs.readFileSync(path.resolve(fontawesomePath + 'scss/_variables.scss'), 'utf-8').replace(new RegExp('\$fa-icons\: \(.*\)\;'), '')

  scss += '\n$fa-font-path: "fonts";\n\n'

  scss += scss + fs.readFileSync(path.resolve(fontawesomePath + 'scss/_mixins.scss'), 'utf-8')

  let metadata = yaml.parse(fs.readFileSync(path.resolve(fontawesomePath + 'metadata/icons.yml'), 'utf-8'))
  
  // I want keys to be the icon name as well as it's aliases names and the value as icon types (brand, solid, duotone, etc)
  let iconAliases = { }
  
  Object.keys(metadata).forEach(key => {
    iconAliases[key] = metadata[key].styles
    
    if (metadata[key].aliases !== undefined && metadata[key].aliases.names !== undefined)
    for (let alias of metadata[key].aliases.names) {
        iconAliases[alias] = metadata[key].styles
      }
  })
  
  // Update _variables.scss
  let generalIcons = '$fa-icons: (\n'

  let brandIcons = '$fa-brand-icons: (\n'

  let aggregateIcons = []

  Object.keys(icons).forEach(key => {
    aggregateIcons = aggregateIcons.concat(icons[key])
  })

  let uniqueIcons = [...new Set(aggregateIcons)]
  
  for (let icon of uniqueIcons) {
    if (iconAliases[icon].includes('brands'))
      brandIcons += '  ' + icon + ': $fa-var-' + icon + ',\n'
    else
      generalIcons += '  ' + icon + ': $fa-var-' + icon + ',\n'
  }

  generalIcons += ');'
  
  brandIcons += ');'

  scss += generalIcons + brandIcons
    // Copy stylesheets, except (!) for certain ones that we need to generate dynamically
  const partialSCSSFiles = fastGlob.sync([fontawesomePath + 'scss/_*',
    '!' + fontawesomePath + 'scss/v4-shims.scss',
    '!' + fontawesomePath + 'scss/_shims.scss',
    '!' + fontawesomePath + 'scss/_variables.scss',
    '!' + fontawesomePath + 'scss/_mixins.scss'])
    //'!' + fontawesomePath + 'scss/_icons.scss',

  for (let file of partialSCSSFiles)
    scss += fs.readFileSync(path.resolve(file), 'utf-8')

  // Create font faces

  let uniqueFonts = Object.keys(icons)

  for (let font of uniqueFonts) {
    let content = fs.readFileSync(path.resolve(fontawesomePath + 'scss/' + font + '.scss'), 'utf-8')

    content = content.replace("@import 'variables';", '').replace("@import 'functions';", '')

    scss += content
  }

  const result = sass.compileString(scss, { style: options.minify ? "compressed" : "expanded" })
  
  fs.writeFileSync(path.resolve('app/assets/builds/fontawesome-pro.css'), result.css.toString())

  console.log('Done.')

  //console.log('Done in ' + (process.hrtime(start)[1] / 1e6).toFixed(3) + 'ms.');
}

async function startWatcher(options) {
  
  let watcher = chokidar.watch(['app/views/**/*.slim', 'app/helpers/**/*.rb'], { ignoreInitial: true })

  watcher.on('change', async (file) => {
    copyAssets(options)
  })

  watcher.on('add', async (file) => {
    copyAssets(options)
  })

}
