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

  grunt.registerMultiTask('crowdin-request', 'Upload a .pot file to crowdin.net', function() {

    var crowdin = new Crowdin({
      endpointUrl: 'https://api.crowdin.com/api',
      apiKey: this.options()['api-key'],
      projectIndentifier: this.options()['project-identifier'],
      branch: this.options()['branch'],
      targetLanguage: this.data.targetLanguage || 'all'
    });

    var done = this.async();
    var self = this;

    switch (this.target) {
      case 'upload':
        var config = {
          options: this.options(),
          uploadOptions: this.data
        };

        var remoteFilename;

        crowdin.getUploadFilename(this.options().filename)
          .then(function (filename) {
            remoteFilename = filename;
            return crowdin.getStatus();
          })
          .then(function (translationStatus) {
            return crowdin.getUpdateEndpoint(remoteFilename, translationStatus);
          })
          .then(function (apiMethod) {
            return crowdin.uploadTranslations(apiMethod, remoteFilename, config);
          })
          .then(function () {
              done(true);
          })
          .catch(function () {
              done(false);
          });

        break;

      case 'download':
        crowdin.export()
          .then(function (response) {
            grunt.verbose.writeln('Crowdin export result: ', response.success);
          })
          .then(function () {
            return crowdin.unzipTranslations(self.data.outputDir);
          })
          .then(function () {
            if (self.data.renameFileTo) {
              return crowdin.renamePoFiles(self.options().filename, self.data.outputDir, self.data.renameFileTo);
            }
          })
          .then(function () {
            done(true);
          })
          .catch(Error, function (e) {
            done(false);
            grunt.fail.fatal(e);
          });

        break;

      default:
        grunt.fail.warn('Unknown job: ' + this.target);
        done(false);
    }
  });

  /**
   * Crowdin interaction class partly taken from https://github.com/hailocab/crowdin-node
   *
   * @param {object} config
   * @constructor
   */
  function Crowdin (config) {
    this.config = config || {};

    if (!this.config.apiKey) throw new Error('Missing apiKey');
    if (!this.config.endpointUrl) throw new Error('Missing endpointUrl');
  }

  /**
   *
   * @param {String} filename
   * @returns {Promise}
   */
  Crowdin.prototype.getUploadFilename = function (filename) {
    var gitPattern = '#GIT_BRANCH#';

    return new Promise(function(resolve) {
      if (filename.indexOf(gitPattern) !== -1) {
        var git = require('git-rev');

        // get the current branch name from Git
        git.branch(function (branchName) {
          grunt.verbose.writeln('Detected git branch: ' + branchName);

          resolve(filename.replace(gitPattern, branchName));
        })
      }
      else {
        resolve(filename);
      }
    });
  };

  /**
   *
   * @returns {Promise}
   */
  Crowdin.prototype.getStatus = function () {
    return this.getRequest('info');
  };

  /**
   *
   * @param {String} remoteFilename
   * @param {Object} translationStatus
   * @returns {Promise}
   */
  Crowdin.prototype.getUpdateEndpoint = function (remoteFilename, translationStatus) {

    return new Promise(function(resolve) {

      var apiMethod = 'add-file';

      for (var i = 0, len = translationStatus.files.length; i < len; i++) {
        if (translationStatus.files[i].name === remoteFilename) {
          apiMethod = 'update-file';
          break;
        }
      }

      resolve(apiMethod);
    });
  };

  /**
   *
   * @param action
   * @returns {string}
   */
  Crowdin.prototype.formUrl = function (action) {
    return this.config.endpointUrl + '/project/' + this.config.projectIndentifier + '/' + action;
  };

  /**
   *
   * @param params
   * @returns {Promise}
   */
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

  /**
   *
   * @param {String} uri
   * @returns {Promise}
   */
  Crowdin.prototype.getRequest = function (uri) {
    var url = this.formUrl(uri);
    grunt.verbose.writeln('Making GET request to: ' + url);

    return this.requestData({
      uri: url,
      method: 'GET',
      qs: this.getQueryString()
    });
  };

  /**
   *
   * @param {String} uri
   * @param {Object} formData
   * @returns {Promise}
   */
  Crowdin.prototype.postRequest = function (uri, formData) {
    var url = this.formUrl(uri);
    grunt.verbose.writeln('Making POST request to: ' + url);

    return this.requestData({
      uri: url,
      method: 'POST',
      formData: formData,
      qs: this.getQueryString()
    });
  };

  /**
   *
   * @returns {Promise}
   */
  Crowdin.prototype.export = function () {
    return this.getRequest('export');
  };

  /**
   *
   * @returns {String}
   */
  Crowdin.prototype.download = function () {
    var file = this.config.targetLanguage + '.zip';
    var url = this.formUrl('download/' + file) + '?key=' + this.config.apiKey;
    if (this.config.branch) {
      url += '&branch=' + this.config.branch;
    }

    grunt.verbose.writeln('Downloading translations from: ' + url);

    return request.get(url);
  };

  /**
   *
   * @param {Stream} toStream
   * @returns {Promise}
   */
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

  /**
   *
   * @param {String} toPath
   * @returns {Promise}
   */
  Crowdin.prototype.unzipTranslations = function (toPath) {
    return this.downloadToStream(unzip.Extract({path: toPath}));
  };

  /**
   *
   * @param {String} apiMethod
   * @param {String} remoteFilename
   * @param {Object} config
   * @returns {Promise}
   */
  Crowdin.prototype.uploadTranslations = function (apiMethod, remoteFilename, config) {
    var formData = {};
    formData['files[' + remoteFilename + ']'] = fs.createReadStream(config.uploadOptions.srcFile);

    return this.postRequest(apiMethod, formData);
  };

  /**
   * Rename files from Crowdin
   *
   * @param {Object} uploadConfig
   * @param {String} outputDir
   * @param {String} renameFileTo
   * @returns {Promise}
   */
  Crowdin.prototype.renamePoFiles = function (uploadConfig, outputDir, renameFileTo) {

    return this.getUploadFilename(uploadConfig)
      .then(function (filename) {
        return new Promise(function(resolve, reject) {
          var fileToFind = filename.substring(0, filename.length - 4);

          fs.readdir(outputDir, function (err, files) {
            if (err !== null) {
              reject(new Error(err));
            }
            else {
              var dir, poFile, parts, newFilename, i, j, len, lenJ, poFiles;

              for (i = 0, len = files.length; i < len; i++) {
                dir = outputDir + '/' + files[i];

                if (fs.lstatSync(dir).isDirectory()) {
                  poFiles = fs.readdirSync(dir);

                  for (j = 0, lenJ = poFiles.length; j < lenJ; j++) {
                    poFile = poFiles[j];
                    parts = poFile.match(/(\w+)-(.+)\.po/);

                    // ensure we have a .po file
                    if (parts.length === 3) {

                      newFilename = renameFileTo.replace('#LOCALE#', parts[2]);

                      // match the upload filename with a file contained in the ZIP
                      if (poFile === fileToFind + '-' + parts[2] + '.po') {
                        grunt.verbose.writeln('Renaming: ' + poFile + ' to ' + newFilename);

                        fs.renameSync(dir + '/' + poFile, dir + '/' + newFilename);
                      }
                      else if (poFile !== newFilename) {
                        // delete this file
                        grunt.verbose.writeln('Deleting: ' + poFile);
                        fs.unlinkSync(dir + '/' + poFile);
                      }
                    }
                  }
                }
              }
              resolve();
            }
          });

        });
      });
  }

  /**
   *
   * @returns {Object}
   */
  Crowdin.prototype.getQueryString = function () {
    var ret = {
      json: 'json',
      key: this.config.apiKey
    };
    if (this.config.branch) {
      ret.branch = this.config.branch;
    }
    grunt.verbose.writeln('QueryString: ' , ret);
    return ret;
  };
};
