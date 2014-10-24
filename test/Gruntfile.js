/*
 * grunt-crowdin-request
 * https://github.com/cloakedninjas/grunt-crowdin-request
 *
 * Copyright (c) 2014 Daniel Jackson
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  grunt.initConfig({
    'crowdin-request': {
      options: {
        functionName: ['tr', 'i18n.tr', 'i18n'],
        potFile: 'messages.pot'
      },

      upload: {
        srcFile: ''
      }
    }
  });

  grunt.loadTasks('../lib');

  /*grunt.registerTask('compare', 'Compare extracted messages with expected messages', function() {

  });*/



  grunt.registerTask('default', ['crowdin-request:upload']);

};
