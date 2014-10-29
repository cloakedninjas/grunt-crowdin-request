/*
 * grunt-crowdin-request
 * https://github.com/cloakedninjas/grunt-crowdin-request
 *
 * Copyright (c) 2014 Daniel Jackson
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {
  var fs = require('fs');
  var request = require('request');

  var config = {
    crowdinUrl: 'https://api.crowdin.com/api'
  };

  grunt.registerMultiTask('crowdin-request', 'Upload a .pot file to crowdin.net', function() {

    var done = this.async();

    switch (this.target) {
      case 'upload':
        initUpload(done, this.options(), this.data);
        break;

      case 'download':
        // TODO
        done();
        break;

      default:
        grunt.fail.warn('Unknown job: ' + this.target);
        done(false);
    }
  });

  /**
   * Prep the upload process, gather all input variables
   *
   * @param done
   * @param options
   * @param uploadOptions
   */
  function initUpload (done, options, uploadOptions) {
    var gitPattern = '#GIT_BRANCH#';
    if (uploadOptions.uploadFilename.indexOf(gitPattern) !== -1) {
      var git = require('git-rev');

      // get the current branch name

      git.branch(function (branchName) {
        grunt.verbose.writeln('Detected git branch: ' + branchName);
        uploadToCrowdin(done, uploadOptions.uploadFilename.replace(gitPattern, branchName), uploadOptions.srcFile, options);
      })
    }
    else {
      uploadToCrowdin(done, uploadOptions.uploadFilename, uploadOptions.srcFile, options);
    }
  }

  /**
   * Find out if file exists at Crowdin, then pick the correct API method to upload the file
   *
   * @param done
   * @param uploadFilename
   * @param uploadFile
   * @param options
   */
  function uploadToCrowdin(done, uploadFilename, uploadFile, options) {
    getStatus(options, function (err, response) {
      if (err) {
        done(false);
      }
      else {
        try {
          response = JSON.parse(response);
          var apiMethod = addFileToCrowdin;

          for (var i = 0, len = response.files.length; i < len; i++) {
            if (response.files[i].name === uploadFilename) {
              apiMethod = updateFileAtCrowdin;
              break;
            }
          }

          apiMethod(done, uploadFilename, uploadFile, options);
        }
        catch (e) {
          grunt.fail.warn('Unable to parse JSON');
          done(false);
        }
      }
    });
  }

  /**
   * Get the project current status
   *
   * @param options
   * @param callback
   */
  function getStatus(options, callback) {
    var url = buildUrl('info', options['project-identifier'], options['api-key']);

    grunt.verbose.writeln('Making POST request to: ' + url);

    request.post({
      url: url
    }, function (err, httpResponse, body) {
      if (err) {
        grunt.fail.warn('Get status failed: ' + err);
        callback(false, err);
      }
      else {
        grunt.verbose.writeln('Successfully got project info');

        callback(null, body);
      }
    });
  }

  /**
   *
   * @param done
   * @param uploadFilename
   * @param uploadFile
   * @param options
   */
  function addFileToCrowdin (done, uploadFilename, uploadFile, options) {
    var url = buildUrl('upload', options['project-identifier'], options['api-key']);
    var formData = {};

    formData['files[' + uploadFilename + ']'] = fs.createReadStream(uploadFile);

    grunt.verbose.writeln('Making POST request to: ' + url);

    request.post({
      url: url,
      formData: formData
    }, function (err, httpResponse, body) {
      if (err) {
        grunt.fail.warn('Upload failed: ' + err);
        done(false);
      }
      else {
        grunt.verbose.writeln('Upload succeeded');

        console.log(body);

        done();

        return;

        var errorMatch = body.match(/<caode>(\d+)<\/code>/);
        var error;

        if (errorMatch !== null) {
          switch (errorMatch[1]) {
            case '8':
              error = ''

          }
        }


        done();
      }
    });
  }

  function updateFileAtCrowdin (done, uploadFilename, uploadFile, options) {
    console.log('TODO');
    done();
  }

  /**
   * Construct a URL to access the Crowdin API
   *
   * @param task
   * @param project
   * @param apiKey
   * @returns {string}
   */
  function buildUrl(task, project, apiKey) {
    var url = config.crowdinUrl + '/project/' + project + '/';

    switch (task) {
      case 'info':
        url += 'info';
        break;

      case 'upload':
        url += 'add-file';
        break;
    }

    url += '?key=' + apiKey + '&json=1';

    return url;
  }


};
