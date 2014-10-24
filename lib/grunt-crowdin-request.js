/*
 * grunt-crowdin-request
 * https://github.com/cloakedninjas/grunt-crowdin-request
 *
 * Copyright (c) 2014 Daniel Jackson
 * Licensed under the MIT license.
 */

'use strict';

var fs = require('fs');
var request = require('request');

module.exports = function(grunt) {

  grunt.registerMultiTask('upload', 'Upload a .pot file to crowdin.net', function() {

    var options = this.options({
      functionName: 'tr',
      potFile: 'messages.pot',
      header: undefined
    });

    var done = this.async();

    /*
     console.log(this.data.uploadFileName);
     console.log(this.data.srcFile);
     console.log(options);
     */

    var uploadFileName = 'plop.pot';
    var formData = {};

    formData['files[' + uploadFileName + ']'] = fs.createReadStream(this.data.srcFile);

    request.post({
      url: options.endpointUrl + '/upload-translation?key=' + options.apiKey,
      formData: formData
    }, function optionalCallback (err, httpResponse, body) {
      if (err) {
        console.error('upload failed:', err);
      }
      else {
        console.log('Upload successful!  Server responded with:', body);
      }

      done();
    });

    //grunt.file.write(options.potFile, contents);
    //grunt.log.writeln(count + ' messages successfully extracted, ' +

  });

};
