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
  var Promise = require('bluebird');
  var requestPromise = Promise.promisify(request);
  var unzip = require('unzip');

  var config = {
    crowdinUrl: 'https://api.crowdin.com/api'
  };

  grunt.registerMultiTask('crowdin-request', 'Upload a .pot file to crowdin.net', function() {

    var crowdin = new Crowdin({
      endpointUrl: 'https://api.crowdin.com/api',
      apiKey: this.options()['api-key'],
      projectIndentifier: this.options()['project-identifier']
    });

    var done = this.async();
    var self = this;

    switch (this.target) {
      case 'upload':
        initUpload(done, this.options(), this.data);
        break;

      case 'download':
        crowdin.export()
          .then(function (response) {
            grunt.verbose.writeln('Crowdin export result: ', response.success);
          })
          .then(function () {
            crowdin.unzipTranslations(self.data.outputDir);
          })
          .catch(Error, function (e) {
            grunt.fail.fatal(e);
          });

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
          var apiMethod = 'add-file';

          for (var i = 0, len = response.files.length; i < len; i++) {
            if (response.files[i].name === uploadFilename) {
              apiMethod = 'update-file';
              break;
            }
          }

          updateFileAtCrowdin(apiMethod, uploadFilename, uploadFile, options, done);
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
        var response = JSON.parse(body);

        if (response.error) {
          grunt.fail.warn('Error from Crowdin: ' + response.error.message);
          callback(false, err);
        }
        else {
          grunt.verbose.writeln('Successfully got project info');
          callback(null, response);
        }
      }
    });
  }

  /**
   *
   * @param method
   * @param uploadFilename
   * @param uploadFile
   * @param options
   * @param done
   */
  function updateFileAtCrowdin (method, uploadFilename, uploadFile, options, done) {
    var url = buildUrl(method, options['project-identifier'], options['api-key']);
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
        done();
      }
    });
  }

  function buildTranslations(options) {
    var url = buildUrl('build-translations', options['project-identifier'], options['api-key']);

    grunt.verbose.writeln('Making GET request to: ' + url);

    request.get({
      url: url
    }, function (err, httpResponse, body) {
      if (err) {
        grunt.fail.warn('Failed to build translations: ' + err);
        done(false);
      }
      else {
        var response = JSON.parse(body);

        if (response.error) {
          grunt.fail.warn('Failed to build translations: ' + response.error.message);
          done(false);
        }
        else {
          grunt.verbose.writeln('Built translations successfully');
          done(null);
        }
      }
    });
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

      case 'add-file':
        url += 'add-file';
        break;

      case 'update-file':
        url += 'update-file';
        break;

      case 'build-translations':
        url += 'export';
        break;
    }

    url += '?key=' + apiKey + '&json=1';

    return url;
  }


  /**
   * Crowdin interation class partly taken from https://github.com/hailocab/crowdin-node
   *
   * @param {object} config
   * @constructor
   */
  function Crowdin (config) {
    this.config = config || {};

    if (!this.config.apiKey) throw new Error('Missing apiKey');
    if (!this.config.endpointUrl) throw new Error('Missing endpointUrl');
  }

  Crowdin.prototype.formUrl = function (action) {
    return this.config.endpointUrl + '/project/' + this.config.projectIndentifier + '/' + action;
  };

  Crowdin.prototype.requestData = function (params) {
    return requestPromise(params)

      // Catch response errors
      .then(function (res) {
        if (!res || !res[0]) {
          throw new Error('No response');
        }

        if (res[0].statusCode >= 400) {
          grunt.log.error('Request failed: ' + res[1]);
          throw new Error(res[1]);
        }

        return res[1]; // Return response body
      })

      // Parse JSON
      .then(function (body) {
        if (body) return JSON.parse(body);
        return {};
      })

      // Throw error if present
      .then(function (data) {
        if (data.error) {
          throw new Error(data.error.message);
        }
        else {
          return data;
        }
      });
  };

  Crowdin.prototype.getRequest = function (uri) {
    var url = this.formUrl(uri);
    grunt.verbose.writeln('Making GET request to: ' + url);

    return this.requestData({
      uri: url,
      method: 'GET',
      qs: {
        key: this.config.apiKey,
        json: 'json'
      }
    });
  };

  Crowdin.prototype.postRequest = function (uri) {
    var url = this.formUrl(uri);
    grunt.verbose.writeln('Making POST request to: ' + url);

    return this.requestData({
      uri: url,
      method: 'POST',
      form: {
        key: this.config.apiKey
      },
      qs: {
        json: 'json'
      }
    });
  };

  Crowdin.prototype.export = function () {
    return this.getRequest('export');
  };

  Crowdin.prototype.download = function () {
    var url = this.formUrl('download/all.zip') + '?key=' + this.config.apiKey;

    grunt.verbose.writeln('Downloading translations from: ' + url);

    return request.get(url);
  };

  Crowdin.prototype.downloadToStream = function (toStream) {
    var that = this;
    return new Promise(function(resolve, reject) {
      that.download()
        .pipe(toStream)
        .on('error', reject)
        .on('close', resolve)
        .on('end', resolve);
    });
  };

  Crowdin.prototype.unzipTranslations = function (toPath) {
    return this.downloadToStream(unzip.Extract({path: toPath}));
  };


};
