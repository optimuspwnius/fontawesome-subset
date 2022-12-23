# FontAwesome Subset For Ruby on Rails CSS-Bundling

It's like TailwindCSS but for FontAwesome!

## Installation

In Procfile.dev add

    fontawesome: yarn build:fontawesome --watch

In package.json under "scripts" add

    "build:fontawesome": "subset"

Some options you can add to the build:fontawesome subset command are:

Use Font Awesome Pro (requires subscription and your npm token to be setup beforehand)

    "build:fontawesome": "subset --pro"

Remove all whitespace to make the file as small as possible. This option just adds the style="compressed" option to the sass compiler when it builds the output file.

    "build:fontawesome": "subset --minify"

Sets the output path and filename. The default is app/assets/builds/fontawesome.css

    "build:fontawesome": "subset --output app/assets/myfonts.css"

Create lib/tasks/build.rake and add the following

    namespace :build do

      desc "Builds FontAwesome by subsetting icons."
      task :fontawesome do
        unless system "yarn install && yarn build:fontawesome"
          raise "cssbundling-rails: Command build:fontawesome failed, ensure yarn is installed and `yarn build:fontawesome` runs without errors"
        end
      end

      Rake::Task["assets:precompile"].enhance(["build:fontawesome"])

    end

Add this to your helper in app/helpers/application_helper.rb

    # This has been adapted from the font-awesome-sass gem found at: https://github.com/FortAwesome/font-awesome-sass/blob/master/lib/font_awesome/sass/rails/helpers.rb
    def icon(style, name, text = nil, html_options = {}, &block)
      text, html_options = nil, text if text.is_a?(Hash)
      style = style.to_s
      name  = name.to_s.dasherize

      content_class = "#{ style } fa-#{ name }"
      content_class << " #{html_options[:class]}" if html_options.key?(:class)
      html_options[:class] = content_class

      html = content_tag(:i, nil, html_options)

      unless text.blank?
        html = "#{ html } #{ text.to_s }"
      end

      if block_given?
        html = "#{ html } #{ capture(block) }"
      end

      html.html_safe
    end

Reference the stylesheet in your layout:

    = stylesheet_link_tag 'fontawesome'

After installation, run your proc file which will watch your development app and create icon subsets on the fly. In production during deploy your app should automatically run the rake task build:fontawesome and create the icon subsets and css.

## Usage

Use the icon method from the helper as this is what we are scanning for to create subsets. The icon() method's first parameter is the icon type and can be a symbol (like :fas, :fad, :far, :fal, :fab, or :fass) or just a string (like this... "fas"). The second parameter is the actual icon name and can be a symbol (like :mug_hot, :file, or :poo) or a string (like "mug-hot" or "poo")

In your app you should reference your fonts like this:

    icon(:fas, :mug_hot)

    # OR

    icon('fas', 'mug-hot')

    # OR

    icon :fas, :mug_hot

## Requests

PRs welcome. If you need help just open an issue.

## Special Thanks

Thanks to omacranger for the nifty fontawesome-subset package: https://github.com/omacranger/fontawesome-subset
