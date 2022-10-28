// https://www.twilio.com/blog/how-to-build-a-cli-with-node-js

import { fontawesomeSubset } from 'fontawesome-subset';
import chokidar from 'chokidar'
import fastGlob from 'fast-glob'
import fs from 'fs'
import arg from 'arg'
import path from 'path'
import sass from 'sass'

function parseArgumentsIntoOptions(rawArgs) {
  const args = arg(
    {
      '--watch': Boolean,
      '-w': '--watch',
      '--pro': Boolean,
      '-p': '--pro'
    },
    {
      argv: rawArgs.slice(2),
    }
  );
  return {
    watch: args['--watch'] || false,
    pro: args['--pro'] || false,
  };
 }

export function cli(args) {

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

    let results = [...content.matchAll(/icon\(:(?<type>fa[sbltrd]), :(?<name>[a-z|_]*)[,)]/gm)]

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

  let scss = fs.readFileSync(path.resolve(fontawesomePath + 'scss/_variables.scss'), 'utf-8')

  scss += '\n$fa-font-path: "fonts";\n\n'

  scss += scss = fs.readFileSync(path.resolve(fontawesomePath + 'scss/_mixins.scss'), 'utf-8')

  // Copy stylesheets
  const partialSCSSFiles = fastGlob.sync([fontawesomePath + 'scss/_*',
                          '!' + fontawesomePath + 'scss/v4-shims.scss',
                          '!' + fontawesomePath + 'scss/_shims.scss',
                          '!' + fontawesomePath + 'scss/_variables.scss',
                          '!' + fontawesomePath + 'scss/_icons.scss',
                          '!' + fontawesomePath + 'scss/_mixins.scss'])
  
  for (let file of partialSCSSFiles)
    scss += fs.readFileSync(path.resolve(file), 'utf-8')

  // Update _icons.scss
  
  scss += '$icons: (\n'

  let aggregateIcons = []

  Object.keys(icons).forEach(key => {
    aggregateIcons = aggregateIcons.concat(icons[key])
  })

  let uniqueIcons = [...new Set(aggregateIcons)]

  for (let icon of uniqueIcons)
    scss += '  ' + icon + ': $fa-var-' + icon + ',\n'

  scss += ');\n\n@each $key, $value in $icons {\n  .#{$fa-css-prefix}-#{$key}:before {\n    content: fa-content($value);\n  }\n}\n'

  // Create font faces

  let uniqueFonts = Object.keys(icons)

  for (let font of uniqueFonts) {
    let content = fs.readFileSync(path.resolve(fontawesomePath + 'scss/' + font + '.scss'), 'utf-8')

    content = content.replace("@import 'variables';", '')

    if (font === 'duotone') {
      // Unescaped regex
      //let duotones = content.match(/\.fad\.#{\$fa-css-prefix}-${icons[font].join('|')}:after { content: fa-content\(\\[a-z0-9]*\); }\n/g)

      // Escaped regex
      let duotoneRegex = new RegExp('\\.fad\\.#{\\$fa-css-prefix}-(' + icons[font].join('|') + '):after { content: fa-content\\(\\\\[a-z0-9]*\\); }\\n', 'g');

      let duotones = content.match(duotoneRegex)
      
      content = content.replaceAll(/\.fad\.#{\$fa-css-prefix}-[a-z0-9-]*:after { content: fa-content\(\\[a-z0-9]*\); }\n/g, '')
      
      if (duotones.length > 0)
        content += duotones.join('\n')
      
    }

    scss += content
  }

  const result = sass.renderSync({ data: scss, quietDeps: true, verbose: false })

  fs.writeFileSync(path.resolve('app/assets/builds/fontawesome-pro.css'), result.css.toString())

  console.log('Done.')

  //console.log('Done in ' + (process.hrtime(start)[1] / 1e6).toFixed(3) + 'ms.');
}

async function startWatcher(options) {
  
  let watcher = chokidar.watch(['app/views/**/*.slim'], { ignoreInitial: true })

  watcher.on('change', async (file) => {
    copyAssets(options)
  })

  watcher.on('add', async (file) => {
    copyAssets(options)
  })

}