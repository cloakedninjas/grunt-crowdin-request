## Getting Started
This plugin requires Grunt `~0.4.0`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-crowdin-request --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-crowdin-request');
```


## Configuration
_Run this task with the `grunt crowdin-request:<action>` command._

There are currently two supported actions:

- upload
- download

Task targets, files and options may be specified according to the grunt [Configuring tasks](http://gruntjs.com/configuring-tasks) guide.

### Options

#### api-key

Type: `String`  
Default: `''`

Your Crowdin API key. Remember to keep it secret!


#### project-identifier

Type: `String`  
Default: `''`

The name of your project at Crowdin. What you access at https://crowdin.com/project/<my-project-name>

### Upload

#### filename

Type: `String`  
Default: `''`

The filename to send to Crowdin. Can be anything you like to identify a file. This option can also use the current Git branch you might be on.
Use `#GIT_BRANCH#` to insert the branch name.

#### srcFile

Type: `String`  
Default: `''`

The location of the file to be uploaded, relative to `Gruntfile.js`

### Download

#### outputDir

Type: `String`  
Default: `''`

The folder where translations should be downloaded to. This will extract the .zip from Crowdin and create subdirectories for each locale contained therein.

## Sample config

```javascript
var config = {
    'crowdin-request': {

        options: {
            'api-key': 'xyz123',
            'project-identifier': 'test-project'
        },

        upload: {
            filename: '#GIT_BRANCH#.pot',
            srcFile: 'i18n/translations.pot'
        },

        download: {
            outputDir: 'i18n'
        }
    }
};

grunt.initConfig(config);
```

## Usage

```sh
grunt crowdin-request:upload
```

```sh
grunt crowdin-request:download
```