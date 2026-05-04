/**
 * This module contains two response handlers.
 *
 * First, a generic BBOP handler for dealing with the gross parsing of
 * responses from a REST server. This is just an example pass-thru
 * handler that needs to be overridden.
 *
 * Second, a generic BBOP handler for dealing with the gross parsing
 * of responses from a REST JSON server. It will detect if the
 * incoming response is a string, and if so, try to parse it to JSON.
 * Otherwise, if the raw return is already an Object, we assume that
 * somebody got to it before us.
 *
 * @module bbop-rest-response
 */

import bbop from "bbop-core";

/**
 * Constructor for a REST query response object.
 *
 * The constructor argument is an object, not a string.
 *
 * @constructor
 * @param {String} in_data - the string returned from a request
 * @returns {Object} rest response object
 */
var response = function (in_data) {
  this._is_a = "bbop-rest-response";

  // The raw incoming document.
  this._raw = in_data;

  // Cache for repeated calls to okay().
  this._okay = null;
  this._message = null;
  this._message_type = null;
};

/**
 * Returns the initial response object, whatever it was.
 *
 * @returns {Object} object
 */
response.prototype.raw = function () {
  return this._raw;
};

/**
 * Simple return verification of sane response from server.
 *
 * @param {Boolean} [okay_p] - setter for okay
 * @returns {Boolean}
 */
response.prototype.okay = function (okay_p) {
  if (bbop.is_defined(okay_p)) {
    this._okay = okay_p;
  }

  if (this._okay == null) {
    if (!this._raw || this._raw === "") {
      this._okay = false;
    } else {
      this._okay = true;
    }
  }

  return this._okay;
};

/**
 * A message that the response wants to let you know about its
 * creation.
 *
 * @param {String} [message] - setter for message
 * @returns {String} message string
 */
response.prototype.message = function (message) {
  if (bbop.is_defined(message)) {
    this._message = message;
  }
  return this._message;
};

/**
 * A message about the message.
 *
 * @param {String} [message_type] - setter for message_type
 * @returns {String} message type string
 */
response.prototype.message_type = function (message_type) {
  if (bbop.is_defined(message_type)) {
    this._message_type = message_type;
  }
  return this._message_type;
};

/**
 * Constructor for a REST JSON response object.
 *
 * The constructor argument is an object or a string.
 *
 * @constructor
 * @param {Object|String} json_data - the JSON object as a string
 * @returns {response_json} rest response object
 */
var response_json = function (json_data) {
  response.call(this);
  this._is_a = "bbop-rest-response-json";

  this._raw_string = null;
  this._okay = null;

  if (json_data) {
    if (bbop.what_is(json_data) === "string") {
      try {
        this._raw = JSON.parse(json_data);
        this._okay = true;
      } catch (_error) {
        this._raw = json_data;
        this._okay = false;
      }
    } else if (bbop.what_is(json_data) === "object" || bbop.what_is(json_data) === "array") {
      this._raw = json_data;
      this._okay = true;
    } else {
      this._raw = null;
      this._okay = null;
    }
  }
};
bbop.extend(response_json, response);

export default {
  base: response,
  json: response_json,
};
